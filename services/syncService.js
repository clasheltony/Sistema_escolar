const { Sequelize, DataTypes } = require('sequelize');
const { SyncQueue } = require('../models');
const dns = require('dns');

// Força o uso do DNS do Google para resolver endereços externos (como Supabase)
// Necessário pois o DNS padrão do ISP pode não resolver corretamente
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

let sequelizeOnline = null;
let schemaSynced = false;

function getOnlineConnection() {
  if (sequelizeOnline) return sequelizeOnline;
  if (!process.env.DATABASE_URL) return null;
  sequelizeOnline = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    },
    logging: false
  });
  return sequelizeOnline;
}

function getPgModels(conn) {
  const options = { freezeTableName: true, timestamps: false };
  return {
    Teacher: conn.define('Teacher', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      role: DataTypes.STRING,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Class: conn.define('Class', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      turmaId: DataTypes.UUID,
      subject: DataTypes.STRING,
      baseTecnica: DataTypes.STRING,
      teacherId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Turma: conn.define('Turma', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      serieId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Serie: conn.define('Serie', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      color: DataTypes.STRING,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Student: conn.define('Student', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      enrollment: DataTypes.STRING,
      active: DataTypes.BOOLEAN,
      classId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Attendance: conn.define('Attendance', {
      id: { type: DataTypes.UUID, primaryKey: true },
      date: DataTypes.DATEONLY,
      lessonNumber: DataTypes.INTEGER,
      status: DataTypes.STRING,
      lessonTopic: DataTypes.STRING,
      studentId: DataTypes.UUID,
      classId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Grade: conn.define('Grade', {
      id: { type: DataTypes.UUID, primaryKey: true },
      activityName: DataTypes.STRING,
      type: DataTypes.STRING,
      date: DataTypes.DATEONLY,
      value: DataTypes.DECIMAL(5, 2),
      status: DataTypes.BOOLEAN,
      studentId: DataTypes.UUID,
      classId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options),
    Bimester: conn.define('Bimester', {
      id: { type: DataTypes.UUID, primaryKey: true },
      name: DataTypes.STRING,
      startDate: DataTypes.DATEONLY,
      endDate: DataTypes.DATEONLY,
      teacherId: DataTypes.UUID,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    }, options)
  };
}

async function ensureSchema() {
  if (schemaSynced) return true;
  const conn = getOnlineConnection();
  if (!conn) return false;

  const models = getPgModels(conn);
  try {
    for (const Model of Object.values(models)) {
      await Model.sync({ alter: true });
    }
    console.log('[SYNC] Schema do PostgreSQL sincronizado (UUID)');
  } catch (alterErr) {
    try {
      for (const Model of Object.values(models)) {
        await Model.sync({ force: true });
      }
      console.log('[SYNC] Tabelas do PostgreSQL recriadas com schema UUID');
    } catch (forceErr) {
      console.error('[SYNC] Erro ao criar tabelas no PostgreSQL:', forceErr.message);
      return false;
    }
  }
  schemaSynced = true;
  return true;
}

async function checkConnection() {
  try {
    const conn = getOnlineConnection();
    if (!conn) return false;
    await conn.authenticate();
    return true;
  } catch {
    return false;
  }
}

async function addToSyncQueue(tableName, recordId, operation, recordData) {
  try {
    await SyncQueue.create({
      tableName,
      recordId,
      operation,
      data: recordData ? JSON.stringify(recordData) : null
    });
  } catch (err) {
    console.error('Erro ao adicionar a fila de sincronizacao:', err);
  }
}

async function pushChanges() {
  const conn = getOnlineConnection();
  if (!conn) return { pushed: 0, errors: 0 };

  const schemaOk = await ensureSchema();
  if (!schemaOk) return { pushed: 0, errors: 0, schemaError: true };

  const pendingItems = await SyncQueue.findAll({ where: { synced: false }, order: [['createdAt', 'ASC']] });
  let pushed = 0, errors = 0;

  for (const item of pendingItems) {
    try {
      const recordData = item.data ? JSON.parse(item.data) : null;
      const tableName = item.tableName;

      if (item.operation === 'CREATE') {
        const data = recordData || {};
        const cols = Object.keys(data).map(k => `"${k}"`).join(',');
        const vals = Object.keys(data).map((_, i) => `$${i + 1}`).join(',');
        const binds = Object.values(data);
        await conn.query(`INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT ("id") DO NOTHING`, { bind: binds });
      } else if (item.operation === 'UPDATE') {
        const data = recordData || {};
        const id = item.recordId;
        const entries = Object.entries(data).filter(([k]) => k !== 'id');
        const sets = entries.map((_, i) => `"${entries[i][0]}"=$${i + 1}`).join(',');
        const binds = entries.map(([, v]) => v);
        binds.push(id);
        await conn.query(`UPDATE "${tableName}" SET ${sets} WHERE "id"=$${binds.length}`, { bind: binds });
      } else if (item.operation === 'DELETE') {
        await conn.query(`DELETE FROM "${tableName}" WHERE "id"=$1`, { bind: [item.recordId] });
      }

      await item.update({ synced: true, syncError: null });
      pushed++;
    } catch (err) {
      await item.update({ syncError: err.message });
      errors++;
    }
  }

  return { pushed, errors };
}

async function pullChanges() {
  const conn = getOnlineConnection();
  if (!conn) return { pulled: 0, errors: 0 };

  const schemaOk = await ensureSchema();
  if (!schemaOk) return { pulled: 0, errors: 0, schemaError: true };

  const { Teacher, Serie, Turma, Class, Student, Attendance, Grade, Bimester } = require('../models');
  let pulled = 0, errors = 0;

  const models = [
    { name: 'Teacher', model: Teacher },
    { name: 'Serie', model: Serie },
    { name: 'Turma', model: Turma },
    { name: 'Class', model: Class },
    { name: 'Student', model: Student },
    { name: 'Attendance', model: Attendance },
    { name: 'Grade', model: Grade },
    { name: 'Bimester', model: Bimester },
  ];

  for (const { name, model } of models) {
    try {
      const localIds = (await model.findAll({ attributes: ['id'], raw: true })).map(r => r.id);
      const remoteRows = await conn.query(
        `SELECT * FROM "${name}"`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      for (const row of remoteRows) {
        try {
          if (localIds.includes(row.id)) {
            const local = await model.findByPk(row.id);
            if (local && new Date(row.updatedAt) > new Date(local.updatedAt)) {
              await model.update(row, { where: { id: row.id } });
              pulled++;
            }
          } else {
            await model.create(row);
            pulled++;
          }
        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      console.error(`Erro ao puxar ${name}:`, err.message);
      errors++;
    }
  }

  return { pulled, errors };
}

async function sync() {
  const online = await checkConnection();
  if (!online) return { online: false, pushResult: null, pullResult: null };

  const pushResult = await pushChanges();
  const pullResult = await pullChanges();
  return { online: true, pushResult, pullResult };
}

module.exports = { checkConnection, addToSyncQueue, pushChanges, pullChanges, sync };
