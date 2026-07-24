const { Sequelize } = require('sequelize');
const { SyncQueue } = require('../models');

let sequelizeOnline = null;

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

  const pendingItems = await SyncQueue.findAll({ where: { synced: false }, order: [['createdAt', 'ASC']] });
  let pushed = 0, errors = 0;

  for (const item of pendingItems) {
    try {
      const recordData = item.data ? JSON.parse(item.data) : null;
      const tableName = item.tableName;

      let Model;
      try { Model = require('../models')[tableName]; } catch { Model = null; }

      if (!Model) {
        await item.update({ synced: true, syncError: 'Model not found' });
        continue;
      }

      if (item.operation === 'CREATE') {
        try {
          await conn.query(
            `INSERT INTO "${tableName}" ("id","name","email","password","subject","enrollment","active","date","lessonNumber","status","lessonTopic","activityName","type","value","startDate","endDate","teacherId","classId","studentId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT ("id") DO NOTHING`,
            { bind: Object.values(recordData || {}), logging: false }
          );
        } catch {
          const data = recordData || {};
          const cols = Object.keys(data).map(k => `"${k}"`).join(',');
          const vals = Object.keys(data).map((_, i) => `$${i + 1}`).join(',');
          const binds = Object.values(data);
          await conn.query(`INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) ON CONFLICT ("id") DO NOTHING`, { bind: binds });
        }
      } else if (item.operation === 'UPDATE') {
        const data = recordData || {};
        const id = item.recordId;
        const sets = Object.keys(data).filter(k => k !== 'id').map((k, i) => `"${k}"=$${i + 1}`).join(',');
        const binds = Object.keys(data).filter(k => k !== 'id').map(k => data[k]);
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

  const { sequelize, Teacher, Class, Student, Attendance, Grade, Bimester } = require('../models');
  let pulled = 0, errors = 0;

  const models = [
    { name: 'Teacher', model: Teacher, columns: ['id', 'name', 'email', 'password', 'createdAt', 'updatedAt'] },
    { name: 'Class', model: Class, columns: ['id', 'name', 'subject', 'teacherId', 'createdAt', 'updatedAt'] },
    { name: 'Student', model: Student, columns: ['id', 'name', 'enrollment', 'active', 'classId', 'createdAt', 'updatedAt'] },
    { name: 'Attendance', model: Attendance, columns: ['id', 'date', 'lessonNumber', 'status', 'lessonTopic', 'studentId', 'classId', 'createdAt', 'updatedAt'] },
    { name: 'Grade', model: Grade, columns: ['id', 'activityName', 'type', 'date', 'value', 'status', 'studentId', 'classId', 'createdAt', 'updatedAt'] },
    { name: 'Bimester', model: Bimester, columns: ['id', 'name', 'startDate', 'endDate', 'teacherId', 'createdAt', 'updatedAt'] },
  ];

  for (const { name, model, columns } of models) {
    try {
      const localIds = (await model.findAll({ attributes: ['id'], raw: true })).map(r => r.id);
      const remoteRows = await conn.query(
        `SELECT * FROM public."${name}"`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      for (const row of remoteRows) {
        try {
          if (localIds.includes(row.id)) {
            // Update local
            const local = await model.findByPk(row.id);
            if (local && new Date(row.updatedAt) > new Date(local.updatedAt)) {
              await model.update(row, { where: { id: row.id } });
              pulled++;
            }
          } else {
            // Insert local
            await model.create(row);
            pulled++;
          }
        } catch (err) {
          // Skip records that fail (might be related to missing parent references)
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
