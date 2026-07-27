require('dotenv').config();
const { Sequelize } = require('sequelize');

const conn = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function check() {
  await conn.authenticate();
  console.log('Conectado ao Supabase!\n');

  const teachers = await conn.query('SELECT id, email, name FROM "Teacher"', { type: Sequelize.QueryTypes.SELECT });
  console.log('=== PROFESSORES NO SUPABASE ===');
  teachers.forEach(t => console.log(`  ${t.email} | id: ${t.id}`));

  const classes = await conn.query('SELECT id, name, "teacherId" FROM "Class"', { type: Sequelize.QueryTypes.SELECT });
  console.log('\n=== TURMAS NO SUPABASE ===');
  classes.forEach(c => console.log(`  ${c.name} | teacherId: ${c.teacherId}`));

  const students = await conn.query('SELECT COUNT(*) as total FROM "Student"', { type: Sequelize.QueryTypes.SELECT });
  console.log('\n=== TOTAL ALUNOS NO SUPABASE ===', students[0].total);

  const att = await conn.query('SELECT COUNT(*) as total FROM "Attendance"', { type: Sequelize.QueryTypes.SELECT });
  console.log('=== TOTAL CHAMADAS NO SUPABASE ===', att[0].total);

  const grades = await conn.query('SELECT COUNT(*) as total FROM "Grade"', { type: Sequelize.QueryTypes.SELECT });
  console.log('=== TOTAL NOTAS NO SUPABASE ===', grades[0].total);

  await conn.close();
}

check().catch(e => console.error('ERRO:', e.message));
