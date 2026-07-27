require('dotenv').config();
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const { sequelize, Teacher, Class, Student, Attendance, Grade, Bimester } = require('../models');

function uuid() { return crypto.randomUUID(); }

async function recoverData() {
  console.log('=== RECUPERANDO DADOS ANTIGOS DO SUPABASE ===\n');

  const pgSeq = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });

  await pgSeq.authenticate();
  console.log('[OK] Conectado ao Supabase antigo');

  console.log('Lendo tabelas no plural...');
  const teachers = await pgSeq.query('SELECT * FROM "Teachers"', {type: Sequelize.QueryTypes.SELECT});
  const classes = await pgSeq.query('SELECT * FROM "Classes"', {type: Sequelize.QueryTypes.SELECT});
  const students = await pgSeq.query('SELECT * FROM "Students"', {type: Sequelize.QueryTypes.SELECT});
  const attendances = await pgSeq.query('SELECT * FROM "Attendances"', {type: Sequelize.QueryTypes.SELECT});
  const grades = await pgSeq.query('SELECT * FROM "Grades"', {type: Sequelize.QueryTypes.SELECT});
  
  // Alguns bancos não têm Bimesters, vamos tentar
  let bimesters = [];
  try {
    bimesters = await pgSeq.query('SELECT * FROM "Bimesters"', {type: Sequelize.QueryTypes.SELECT});
  } catch(e) {}

  console.log(`Encontrados: ${teachers.length} professores, ${classes.length} turmas, ${students.length} alunos, ${attendances.length} chamadas, ${grades.length} notas`);
  
  await pgSeq.close();

  // Mapeamento ID Inteiro -> UUID
  const teacherMap = new Map(teachers.map(t => [t.id, uuid()]));
  const classMap = new Map(classes.map(c => [c.id, uuid()]));
  const studentMap = new Map(students.map(s => [s.id, uuid()]));
  const attendanceMap = new Map(attendances.map(a => [a.id, uuid()]));
  const gradeMap = new Map(grades.map(g => [g.id, uuid()]));
  const bimesterMap = new Map(bimesters.map(b => [b.id, uuid()]));

  // Recriar o banco de dados SQLite local
  await sequelize.sync({ force: true });
  console.log('\nTabelas locais recriadas. Inserindo dados...');

  // Inserir dados no SQLite com os novos UUIDs
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
  
  const firstTeacherId = teacherMap.values().next().value;
  const firstClassId = classMap.values().next().value;
  const firstStudentId = studentMap.values().next().value;

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

  await sequelize.close();
  console.log('\n=== RECUPERACAO CONCLUIDA! ===');
  console.log(`Suas ${classes.length} turmas foram salvas no SQLite.`);
}

recoverData().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
