require('dotenv').config();
const { Sequelize } = require('sequelize');

async function fix() {
  const local = new Sequelize({dialect:'sqlite', storage:'database.sqlite', logging:false});
  await local.authenticate();
  const ts = await local.query('SELECT * FROM Teachers WHERE email=\'tonyferreira13@gmail.com\'', {type:Sequelize.QueryTypes.SELECT});
  const tonyLocal = ts[0];
  await local.close();

  if (!tonyLocal) {
    console.log('Erro: Tony não encontrado localmente');
    return;
  }

  const cloud = new Sequelize(process.env.DATABASE_URL, {
    dialect:'postgres', logging:false, dialectOptions:{ssl:{require:true,rejectUnauthorized:false}}
  });
  await cloud.authenticate();
  
  // Remove o Tony antigo do banco online (para evitar conflito de email quando sincronizar)
  await cloud.query('DELETE FROM "Teacher" WHERE email=\'tonyferreira13@gmail.com\'');
  
  // Insere o Tony exato que está no local, já com a nova senha
  await cloud.query(
    'INSERT INTO "Teacher" (id, name, email, password, role, "createdAt", "updatedAt") VALUES (:id, :name, :email, :password, :role, :createdAt, :updatedAt)',
    {
      replacements: {
        id: tonyLocal.id, 
        name: tonyLocal.name, 
        email: tonyLocal.email, 
        password: tonyLocal.password, 
        role: tonyLocal.role || 'professor', 
        createdAt: new Date(), 
        updatedAt: new Date()
      }
    }
  );
  console.log('CONTA ONLINE ATUALIZADA COM SUCESSO!');
  await cloud.close();
}

fix().catch(console.error);
