require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

function uuid() {
  return crypto.randomUUID();
}

async function pullFromCloud() {
  console.log('=== Importando dados da nuvem (Supabase) ===\n');

  if (!process.env.DATABASE_URL) {
    console.log('[ERRO] DATABASE_URL nao configurada no arquivo .env');
    console.log('Configure o .env com a URL do seu Supabase e tente novamente.');
    process.exit(1);
  }

  // Connect to PostgreSQL (old schema with integer IDs)
  const pgSeq = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });

  // Define old models (integer IDs) to read from PostgreSQL
  const PgTeacher = pgSeq.define('Teacher', {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    role: DataTypes.STRING
  });

  const PgClass = pgSeq.define('Class', {
    name: DataTypes.STRING,
    subject: DataTypes.STRING,
    teacherId: DataTypes.INTEGER
  });

  const PgStudent = pgSeq.define('Student', {
    name: DataTypes.STRING,
    enrollment: DataTypes.STRING,
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    classId: DataTypes.INTEGER
  });

  const PgAttendance = pgSeq.define('Attendance', {
    date: DataTypes.DATEONLY,
    lessonNumber: DataTypes.INTEGER,
    status: DataTypes.STRING,
    lessonTopic: DataTypes.STRING,
    studentId: DataTypes.INTEGER,
    classId: DataTypes.INTEGER
  });

  const PgGrade = pgSeq.define('Grade', {
    activityName: DataTypes.STRING,
    type: DataTypes.STRING,
    date: DataTypes.DATEONLY,
    value: DataTypes.DECIMAL(5, 2),
    status: DataTypes.BOOLEAN,
    studentId: DataTypes.INTEGER,
    classId: DataTypes.INTEGER
  });

  const PgBimester = pgSeq.define('Bimester', {
    name: DataTypes.STRING,
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY,
    teacherId: DataTypes.INTEGER
  });

  console.log('Conectando ao banco online (Supabase)...');
  try {
    await pgSeq.authenticate();
    console.log('[OK] Conectado ao Supabase\n');
  } catch (err) {
    console.log('[ERRO] Nao foi possivel conectar ao Supabase: ' + err.message);
    process.exit(1);
  }

  console.log('Lendo dados do Supabase...');
  const teachers = await PgTeacher.findAll({ raw: true });
  const classes = await PgClass.findAll({ raw: true });
  const students = await PgStudent.findAll({ raw: true });
  const attendances = await PgAttendance.findAll({ raw: true });
  const grades = await PgGrade.findAll({ raw: true });
  const bimesters = await PgBimester.findAll({ raw: true });

  console.log('  Teachers: ' + teachers.length);
  console.log('  Classes: ' + classes.length);
  console.log('  Students: ' + students.length);
  console.log('  Attendances: ' + attendances.length);
  console.log('  Grades: ' + grades.length);
  console.log('  Bimesters: ' + bimesters.length + '\n');

  await pgSeq.close();

  // Generate UUID mappings for old integer IDs
  const teacherMap = new Map(teachers.map(t => [t.id, uuid()]));
  const classMap = new Map(classes.map(c => [c.id, uuid()]));
  const studentMap = new Map(students.map(s => [s.id, uuid()]));
  const attendanceMap = new Map(attendances.map(a => [a.id, uuid()]));
  const gradeMap = new Map(grades.map(g => [g.id, uuid()]));
  const bimesterMap = new Map(bimesters.map(b => [b.id, uuid()]));

  // Prepare to write to SQLite with new UUID schema
  const { sequelize, Teacher, Class, Student, Attendance, Grade, Bimester } = require('../models');

  // Force recreate all tables (data will be re-inserted)
  await sequelize.sync({ force: true });
  console.log('Tabelas locais recriadas com schema UUID.\n');

  console.log('Importando dados...');

  // Teachers
  for (const t of teachers) {
    await Teacher.create({
      id: teacherMap.get(t.id),
      name: t.name,
      email: t.email,
      password: t.password,
      role: t.role || 'professor',
      createdAt: t.createdAt || new Date(),
      updatedAt: t.updatedAt || new Date()
    });
  }
  console.log('  ' + teachers.length + ' professores importados');

  const firstTeacherId = teacherMap.get(teachers[0]?.id) || teacherMap.values().next().value;
  const firstClassId = classMap.get(classes[0]?.id) || classMap.values().next().value;
  const firstStudentId = studentMap.get(students[0]?.id) || studentMap.values().next().value;

  for (const c of classes) {
    await Class.create({
      id: classMap.get(c.id),
      name: c.name,
      subject: c.subject || null,
      teacherId: teacherMap.get(c.teacherId) || firstTeacherId,
      createdAt: c.createdAt || new Date(),
      updatedAt: c.updatedAt || new Date()
    });
  }
  console.log('  ' + classes.length + ' turmas importadas');

  for (const s of students) {
    await Student.create({
      id: studentMap.get(s.id),
      name: s.name,
      enrollment: s.enrollment || null,
      active: s.active !== undefined ? !!s.active : true,
      classId: classMap.get(s.classId) || firstClassId,
      createdAt: s.createdAt || new Date(),
      updatedAt: s.updatedAt || new Date()
    });
  }
  console.log('  ' + students.length + ' alunos importados');

  for (const a of attendances) {
    await Attendance.create({
      id: attendanceMap.get(a.id),
      date: a.date,
      lessonNumber: a.lessonNumber,
      status: a.status,
      lessonTopic: a.lessonTopic || null,
      studentId: studentMap.get(a.studentId) || firstStudentId,
      classId: classMap.get(a.classId) || firstClassId,
      createdAt: a.createdAt || new Date(),
      updatedAt: a.updatedAt || new Date()
    });
  }
  console.log('  ' + attendances.length + ' presencas importadas');

  for (const g of grades) {
    await Grade.create({
      id: gradeMap.get(g.id),
      activityName: g.activityName,
      type: g.type,
      date: g.date,
      value: g.value != null ? parseFloat(g.value) : null,
      status: g.status != null ? !!g.status : null,
      studentId: studentMap.get(g.studentId) || firstStudentId,
      classId: classMap.get(g.classId) || firstClassId,
      createdAt: g.createdAt || new Date(),
      updatedAt: g.updatedAt || new Date()
    });
  }
  console.log('  ' + grades.length + ' notas/vistos importados');

  for (const b of bimesters) {
    await Bimester.create({
      id: bimesterMap.get(b.id),
      name: b.name,
      startDate: b.startDate || null,
      endDate: b.endDate || null,
      teacherId: teacherMap.get(b.teacherId) || firstTeacherId,
      createdAt: b.createdAt || new Date(),
      updatedAt: b.updatedAt || new Date()
    });
  }
  console.log('  ' + bimesters.length + ' bimestres importados');

  await sequelize.close();
  console.log('\n=== Importacao concluida com sucesso! ===');
  console.log('Suas ' + classes.length + ' turmas agora estao disponiveis localmente.');
  console.log('Inicie o sistema com npm start e faca login.');
}

pullFromCloud().catch(err => {
  console.error('Erro na importacao:', err);
  process.exit(1);
});
