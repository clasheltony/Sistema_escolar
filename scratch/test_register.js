const { Teacher } = require('../models');
const bcrypt = require('bcrypt');

async function testCreateUser() {
  try {
    const email = 'test@test.com';
    const hashedPassword = await bcrypt.hash('test123', 10);
    const teacher = await Teacher.create({
      name: 'Test User',
      email: email,
      password: hashedPassword
    });
    console.log('Usuário de teste criado:', teacher.email);
    
    const teachers = await Teacher.findAll();
    console.log('--- Professores no Banco ---');
    teachers.forEach(t => {
      console.log(`ID: ${t.id}, Nome: ${t.name}, Email: ${t.email}`);
    });
    console.log('---------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    process.exit(1);
  }
}

testCreateUser();
