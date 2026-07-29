require('dotenv').config();
const { Sequelize } = require('sequelize');

async function check() {
  const seq = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });

  const [teachers] = await seq.query('SELECT id, name, email, role FROM "Teachers"');
  console.log('=== PROFESSORES NO SUPABASE ===');
  teachers.forEach(t => console.log('  ' + t.name + ' (' + t.email + ') - role: ' + t.role));

  const [classes] = await seq.query('SELECT c.id, c.name, c.subject, c."teacherId", t.name as turma FROM "Classes" c LEFT JOIN "Turmas" t ON c."turmaId" = t.id');
  console.log('\n=== TOTAL DE CLASSES: ' + classes.length + ' ===');
  classes.slice(0, 5).forEach(c => console.log('  ' + c.name + ' - ' + c.subject + ' - teacherId: ' + c.teacherId));

  const tony = teachers.find(t => t.email === 'tonyferreira13@gmail.com');
  if (tony) {
    console.log('\n=== TONY ENCONTRADO: ' + tony.id + ' ===');
    const tonyClasses = classes.filter(c => c.teacherId === tony.id);
    console.log('Classes vinculadas a ele: ' + tonyClasses.length);
    tonyClasses.forEach(c => console.log('  ' + c.name + ' - ' + c.subject));

    const unlinked = classes.filter(c => !c.teacherId);
    console.log('\nClasses sem professor: ' + unlinked.length);
    unlinked.slice(0, 5).forEach(c => console.log('  ' + c.name + ' - ' + c.subject));
  }

  const [series] = await seq.query('SELECT * FROM "Series"');
  console.log('\n=== SERIES: ' + series.length + ' ===');
  series.forEach(s => console.log('  ' + s.name + ' - cor: ' + s.color));

  const [turmas] = await seq.query('SELECT t.id, t.name, t."serieId", s.name as serie FROM "Turmas" t LEFT JOIN "Series" s ON t."serieId" = s.id');
  console.log('\n=== TURMAS: ' + turmas.length + ' ===');
  turmas.slice(0, 5).forEach(t => console.log('  ' + t.name + ' - serie: ' + (t.serie || 'sem')));

  await seq.close();
}

check().catch(console.error);
