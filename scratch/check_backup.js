// Script simples para inspecionar o banco de backup via SQL puro
const { Sequelize } = require('sequelize');
const path = require('path');

const backup = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite.backup.20260724_083513'),
  logging: false
});

async function inspect() {
  await backup.authenticate();
  console.log('Backup aberto!\n');

  const [tables] = await backup.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tabelas encontradas:', tables.map(t => t.name).join(', '), '\n');

  // Tenta diferentes nomes de tabela
  for (const tbl of ['Teachers', 'Teacher']) {
    try {
      const [rows] = await backup.query(`SELECT * FROM "${tbl}"`);
      console.log(`=== ${tbl} (${rows.length} registros) ===`);
      rows.forEach(t => console.log(`  id:${t.id} | ${t.email} | role:${t.role}`));
      
      const tony = rows.find(t => t.email && t.email.toLowerCase().includes('tony'));
      if (tony) {
        console.log(`\n>>> CONTA ENCONTRADA: ${tony.email} com id=${tony.id}\n`);

        // Tenta Classes / Class
        for (const ct of ['Classes', 'Class']) {
          try {
            const [classes] = await backup.query(`SELECT * FROM "${ct}" WHERE teacherId = ?`, { replacements: [tony.id] });
            console.log(`=== TURMAS (${ct}) de ${tony.email}: ${classes.length} turmas ===`);
            classes.forEach(c => console.log(`  id:${c.id} | ${c.name} | ${c.subject}`));
            
            if (classes.length > 0) {
              const ids = classes.map(c => `'${c.id}'`).join(',');
              for (const st of ['Students', 'Student']) {
                try {
                  const [s] = await backup.query(`SELECT COUNT(*) as n FROM "${st}" WHERE classId IN (${ids})`);
                  console.log(`  Alunos: ${s[0].n}`);
                } catch {}
              }
              for (const at of ['Attendances', 'Attendance']) {
                try {
                  const [a] = await backup.query(`SELECT COUNT(*) as n FROM "${at}" WHERE classId IN (${ids})`);
                  console.log(`  Chamadas: ${a[0].n}`);
                } catch {}
              }
              for (const gt of ['Grades', 'Grade']) {
                try {
                  const [g] = await backup.query(`SELECT COUNT(*) as n FROM "${gt}" WHERE classId IN (${ids})`);
                  console.log(`  Notas: ${g[0].n}`);
                } catch {}
              }
            }
            break;
          } catch(e) { /* tenta o próximo */ }
        }
      }
      break;
    } catch(e) { /* tenta o próximo nome */ }
  }
}

inspect().catch(e => console.error('ERRO:', e.message));
