require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

function uuid() {
  return crypto.randomUUID();
}

async function migrate() {
  console.log('=== Iniciando migracao INTEGER -> UUID ===\n');

  const backupPath = DB_PATH.replace('.sqlite', `.backup.${Date.now()}.sqlite`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`Backup criado: ${backupPath}\n`);

  // Read old data using old schema (integer IDs)
  const oldSeq = new Sequelize({
    dialect: 'sqlite',
    storage: DB_PATH,
    logging: false
  });

  const OldTeacher = oldSeq.define('Teacher', {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING
  });

  const OldClass = oldSeq.define('Class', {
    name: DataTypes.STRING,
    subject: DataTypes.STRING,
    teacherId: DataTypes.INTEGER
  });

  const OldStudent = oldSeq.define('Student', {
    name: DataTypes.STRING,
    enrollment: DataTypes.STRING,
    classId: DataTypes.INTEGER
  }, { tableName: 'Students' });

  const OldAttendance = oldSeq.define('Attendance', {
    date: DataTypes.DATEONLY,
    lessonNumber: DataTypes.INTEGER,
    status: DataTypes.STRING,
    lessonTopic: DataTypes.STRING,
    studentId: DataTypes.INTEGER,
    classId: DataTypes.INTEGER
  });

  const OldGrade = oldSeq.define('Grade', {
    activityName: DataTypes.STRING,
    type: DataTypes.STRING,
    date: DataTypes.DATEONLY,
    value: DataTypes.DECIMAL(5, 2),
    status: DataTypes.BOOLEAN,
    studentId: DataTypes.INTEGER,
    classId: DataTypes.INTEGER
  });

  const OldBimester = oldSeq.define('Bimester', {
    name: DataTypes.STRING,
    startDate: DataTypes.DATEONLY,
    endDate: DataTypes.DATEONLY,
    teacherId: DataTypes.INTEGER
  });

  console.log('Lendo dados existentes...');

  const oldTeachers = await OldTeacher.findAll({ raw: true });
  const oldClasses = await OldClass.findAll({ raw: true });
  const oldStudents = await OldStudent.findAll({ raw: true });
  const oldAttendances = await OldAttendance.findAll({ raw: true });
  const oldGrades = await OldGrade.findAll({ raw: true });
  const oldBimesters = await OldBimester.findAll({ raw: true });

  console.log(`  Teachers: ${oldTeachers.length}`);
  console.log(`  Classes: ${oldClasses.length}`);
  console.log(`  Students: ${oldStudents.length}`);
  console.log(`  Attendances: ${oldAttendances.length}`);
  console.log(`  Grades: ${oldGrades.length}`);
  console.log(`  Bimesters: ${oldBimesters.length}\n`);

  // Close old connection
  await oldSeq.close();

  // Generate UUID mappings
  const teacherMap = new Map(oldTeachers.map(t => [t.id, uuid()]));
  const classMap = new Map(oldClasses.map(c => [c.id, uuid()]));
  const studentMap = new Map(oldStudents.map(s => [s.id, uuid()]));
  const attendanceMap = new Map(oldAttendances.map(a => [a.id, uuid()]));
  const gradeMap = new Map(oldGrades.map(g => [g.id, uuid()]));
  const bimesterMap = new Map(oldBimesters.map(b => [b.id, uuid()]));

  // Now sync new models (force: true drops and recreates tables)
  const { sequelize, Teacher, Class, Student, Attendance, Grade, Bimester, SyncQueue } = require('../models');
  await sequelize.sync({ force: true });
  console.log('Novas tabelas criadas com schema UUID.\n');

  console.log('Migrando dados...');

  // Teachers
  for (const t of oldTeachers) {
    await Teacher.create({
      id: teacherMap.get(t.id),
      name: t.name,
      email: t.email,
      password: t.password,
      createdAt: t.createdAt || new Date(),
      updatedAt: t.updatedAt || new Date()
    });
  }
  console.log(`  ${oldTeachers.length} professores migrados`);

  const firstTeacherId = teacherMap.get(oldTeachers[0]?.id) || teacherMap.values().next().value;
  const firstClassId = classMap.get(oldClasses[0]?.id) || classMap.values().next().value;
  const firstStudentId = studentMap.get(oldStudents[0]?.id) || studentMap.values().next().value;

  // Classes
  for (const c of oldClasses) {
    await Class.create({
      id: classMap.get(c.id),
      name: c.name,
      subject: c.subject || null,
      teacherId: teacherMap.get(c.teacherId) || firstTeacherId,
      createdAt: c.createdAt || new Date(),
      updatedAt: c.updatedAt || new Date()
    });
  }
  console.log(`  ${oldClasses.length} turmas migradas`);

  // Students
  for (const s of oldStudents) {
    await Student.create({
      id: studentMap.get(s.id),
      name: s.name,
      enrollment: s.enrollment || null,
      active: true,
      classId: classMap.get(s.classId) || firstClassId,
      createdAt: s.createdAt || new Date(),
      updatedAt: s.updatedAt || new Date()
    });
  }
  console.log(`  ${oldStudents.length} alunos migrados`);

  // Attendances
  for (const a of oldAttendances) {
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
  console.log(`  ${oldAttendances.length} registros de presenca migrados`);

  // Grades
  for (const g of oldGrades) {
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
  console.log(`  ${oldGrades.length} notas/vistos migrados`);

  // Bimesters
  for (const b of oldBimesters) {
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
  console.log(`  ${oldBimesters.length} bimestres migrados`);

  await sequelize.close();
  console.log('\n=== Migracao concluida com sucesso! ===');
  console.log(`Backup disponivel em: ${backupPath}`);
}

migrate().catch(err => {
  console.error('Erro na migracao:', err);
  process.exit(1);
});
