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

    const hash = await bcrypt.hash('admin123', 10);
    
    // First check if admin exists
    const [results] = await s.query('SELECT * FROM "Teacher" WHERE email = \'admin@escola.com\'');
    
    if (results.length === 0) {
      console.log('Admin account does not exist in cloud DB! Creating it...');
      const { v4: uuidv4 } = require('uuid');
      await s.query(
        'INSERT INTO "Teacher" (id, name, email, password, role, "createdAt", "updatedAt") VALUES (:id, :name, :email, :password, :role, :createdAt, :updatedAt)',
        {
          replacements: {
            id: uuidv4(),
            name: 'Professor Admin',
            email: 'admin@escola.com',
            password: hash,
            role: 'professor',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
    } else {
      await s.query('UPDATE "Teacher" SET password = :hash WHERE email = :email', {
        replacements: { hash, email: 'admin@escola.com' }
      });
    }

    console.log('Admin password updated to admin123 in cloud DB');
    await s.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
