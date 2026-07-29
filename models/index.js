require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: path.join(__dirname, '..', 'database.sqlite'),
      logging: false
    });

const Teacher = require('./Teacher')(sequelize, DataTypes);
const Serie = require('./Serie')(sequelize, DataTypes);
const Class = require('./Class')(sequelize, DataTypes);
const Turma = require('./Turma')(sequelize, DataTypes);
const Student = require('./Student')(sequelize, DataTypes);
const Attendance = require('./Attendance')(sequelize, DataTypes);
const Grade = require('./Grade')(sequelize, DataTypes);
const Bimester = require('./Bimester')(sequelize, DataTypes);
const SyncQueue = require('./SyncQueue')(sequelize, DataTypes);

Teacher.hasMany(Class, { foreignKey: 'teacherId' });
Class.belongsTo(Teacher, { foreignKey: 'teacherId' });

Serie.hasMany(Turma, { foreignKey: 'serieId' });
Turma.belongsTo(Serie, { foreignKey: 'serieId' });

Turma.hasMany(Class, { foreignKey: 'turmaId' });
Class.belongsTo(Turma, { foreignKey: 'turmaId' });

Teacher.hasMany(Bimester, { foreignKey: 'teacherId' });
Bimester.belongsTo(Teacher, { foreignKey: 'teacherId' });

Class.hasMany(Student, { foreignKey: 'classId' });
Student.belongsTo(Class, { foreignKey: 'classId' });

Student.hasMany(Attendance, { foreignKey: 'studentId' });
Attendance.belongsTo(Student, { foreignKey: 'studentId' });

Class.hasMany(Attendance, { foreignKey: 'classId' });
Attendance.belongsTo(Class, { foreignKey: 'classId' });

Student.hasMany(Grade, { foreignKey: 'studentId' });
Grade.belongsTo(Student, { foreignKey: 'studentId' });

Class.hasMany(Grade, { foreignKey: 'classId' });
Grade.belongsTo(Class, { foreignKey: 'classId' });

async function addToSyncQueue(tableName, recordId, operation, recordData) {
  try {
    await SyncQueue.create({
      tableName,
      recordId,
      operation,
      data: recordData ? JSON.stringify(recordData) : null
    });
  } catch (err) {
    console.error('sync error:', err.message);
  }
}

[Teacher, Serie, Turma, Class, Student, Attendance, Grade, Bimester].forEach(Model => {
  Model.addHook('afterCreate', (instance) => {
    addToSyncQueue(Model.name, instance.id, 'CREATE', instance.toJSON());
  });

  Model.addHook('afterUpdate', (instance) => {
    addToSyncQueue(Model.name, instance.id, 'UPDATE', instance.toJSON());
  });

  Model.addHook('afterDestroy', (instance) => {
    addToSyncQueue(Model.name, instance.id, 'DELETE', { id: instance.id });
  });
});

module.exports = {
  sequelize,
  Teacher,
  Serie,
  Turma,
  Class,
  Student,
  Attendance,
  Grade,
  Bimester,
  SyncQueue
};
