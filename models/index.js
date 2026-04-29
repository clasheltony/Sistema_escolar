require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: false
  });
}

const Teacher = require('./Teacher')(sequelize, DataTypes);
const Class = require('./Class')(sequelize, DataTypes);
const Student = require('./Student')(sequelize, DataTypes);
const Attendance = require('./Attendance')(sequelize, DataTypes);
const Grade = require('./Grade')(sequelize, DataTypes);
const Bimester = require('./Bimester')(sequelize, DataTypes);

// Relações
Teacher.hasMany(Class, { foreignKey: 'teacherId' });
Class.belongsTo(Teacher, { foreignKey: 'teacherId' });

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

module.exports = {
  sequelize,
  Teacher,
  Class,
  Student,
  Attendance,
  Grade,
  Bimester
};
