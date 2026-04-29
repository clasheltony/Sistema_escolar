const { Teacher } = require('../models');

async function checkUsers() {
  try {
    const teachers = await Teacher.findAll();
    console.log('--- Professores no Banco ---');
    teachers.forEach(t => {
      console.log(`ID: ${t.id}, Nome: ${t.name}, Email: ${t.email}`);
    });
    console.log('---------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao buscar professores:', error);
    process.exit(1);
  }
}

checkUsers();
