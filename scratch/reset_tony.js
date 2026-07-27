const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
require('dotenv').config();

async function run() {
  try {
    const s = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    const hash = await bcrypt.hash('123456', 10);
    
    await s.query('UPDATE "Teacher" SET password = :hash WHERE email = :email', {
      replacements: { hash, email: 'tonyferreira13@gmail.com' }
    });

    console.log('Tony password updated to 123456 in cloud DB');
    await s.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
