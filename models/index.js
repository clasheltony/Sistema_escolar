require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const dns = require('dns');

// Alguns provedores (e redes locais) nao resolvem corretamente os hosts do Supabase.
// Forcamos DNS publico + prioridade IPv4, como o projeto ja fazia antes.
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// O sistema opera exclusivamente com o banco na nuvem (Supabase/PostgreSQL).
// Sem DATABASE_URL nao ha como iniciar com seguranca.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('\n[ERRO FATAL] A variavel DATABASE_URL nao esta configurada.');
  console.error('Este sistema usa exclusivamente o banco na nuvem (Supabase/PostgreSQL).');
  console.error('Crie um arquivo .env na raiz do projeto com a linha:');
  console.error('  DATABASE_URL=postgresql://USUARIO:SENHA@SEU_HOST:6543/postgres\n');
  process.exit(1);
}

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false
    },
    keepAlive: true
  }
});

const Teacher = require('./Teacher')(sequelize, DataTypes);
const Serie = require('./Serie')(sequelize, DataTypes);
const Class = require('./Class')(sequelize, DataTypes);
const Turma = require('./Turma')(sequelize, DataTypes);
const Student = require('./Student')(sequelize, DataTypes);
const Attendance = require('./Attendance')(sequelize, DataTypes);
const Grade = require('./Grade')(sequelize, DataTypes);
const Bimester = require('./Bimester')(sequelize, DataTypes);

Teacher.hasMany(Class, { foreignKey: 'teacherId' });
Class.belongsTo(Teacher, { foreignKey: 'teacherId' });

Serie.hasMany(Turma, { foreignKey: 'serieId' });
Turma.belongsTo(Serie, { foreignKey: 'serieId' });

Turma.hasMany(Class, { foreignKey: 'turmaId' });
Class.belongsTo(Turma, { foreignKey: 'turmaId' });

Teacher.hasMany(Bimester, { foreignKey: 'teacherId' });
Bimester.belongsTo(Teacher, { foreignKey: 'teacherId' });

Class.hasMany(Student, { foreignKey: 'classId', onDelete: 'CASCADE' });
Student.belongsTo(Class, { foreignKey: 'classId' });

Student.hasMany(Attendance, { foreignKey: 'studentId', onDelete: 'CASCADE' });
Attendance.belongsTo(Student, { foreignKey: 'studentId' });

Class.hasMany(Attendance, { foreignKey: 'classId', onDelete: 'CASCADE' });
Attendance.belongsTo(Class, { foreignKey: 'classId' });

Student.hasMany(Grade, { foreignKey: 'studentId', onDelete: 'CASCADE' });
Grade.belongsTo(Student, { foreignKey: 'studentId' });

Class.hasMany(Grade, { foreignKey: 'classId', onDelete: 'CASCADE' });
Grade.belongsTo(Class, { foreignKey: 'classId' });

module.exports = {
  sequelize,
  Teacher,
  Serie,
  Turma,
  Class,
  Student,
  Attendance,
  Grade,
  Bimester
};
