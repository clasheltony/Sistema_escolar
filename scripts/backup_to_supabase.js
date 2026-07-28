require('dotenv').config();
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

async function backupToSupabase() {
  console.log('=== Backup do SQLite para Supabase ===\n');

  if (!process.env.DATABASE_URL) {
    console.log('[ERRO] DATABASE_URL nao configurada no arquivo .env');
    process.exit(1);
  }

  const local = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: false
  });

  const remote = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
  });

  async function getLocalData() {
    const tables = ['Teachers', 'Series', 'Turmas', 'Classes', 'Students', 'Attendances', 'Grades', 'Bimesters'];
    const data = {};
    for (const table of tables) {
      const [rows] = await local.query(`SELECT * FROM "${table}"`);
      data[table] = rows;
      console.log(`  ${table}: ${rows.length} registros lidos`);
    }
    return data;
  }

  async function recreateTables() {
    const dropOrder = ['Grades', 'Attendances', 'Students', 'Bimesters', 'Classes', 'Turmas', 'Series', 'Teachers', 'SyncQueues'];
    for (const table of dropOrder) {
      try { await remote.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`); } catch (e) {}
    }

    await remote.query(`
      CREATE TABLE "Teachers" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "role" TEXT DEFAULT 'professor',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Series" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "color" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Turmas" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "serieId" UUID REFERENCES "Series"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Classes" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "turmaId" UUID REFERENCES "Turmas"("id"),
        "subject" TEXT,
        "baseTecnica" TEXT,
        "teacherId" UUID REFERENCES "Teachers"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Students" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "enrollment" TEXT,
        "active" BOOLEAN DEFAULT true,
        "classId" UUID REFERENCES "Classes"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Bimesters" (
        "id" UUID PRIMARY KEY,
        "name" TEXT NOT NULL,
        "startDate" DATE,
        "endDate" DATE,
        "teacherId" UUID REFERENCES "Teachers"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Attendances" (
        "id" UUID PRIMARY KEY,
        "date" DATE NOT NULL,
        "lessonNumber" INTEGER,
        "status" TEXT,
        "lessonTopic" TEXT,
        "studentId" UUID REFERENCES "Students"("id"),
        "classId" UUID REFERENCES "Classes"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    await remote.query(`
      CREATE TABLE "Grades" (
        "id" UUID PRIMARY KEY,
        "activityName" TEXT,
        "type" TEXT,
        "date" DATE,
        "value" DECIMAL(5,2),
        "status" BOOLEAN,
        "studentId" UUID REFERENCES "Students"("id"),
        "classId" UUID REFERENCES "Classes"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    console.log('  Tabelas recriadas com schema UUID');
  }

  async function insertData(data) {
    const order = ['Teachers', 'Series', 'Turmas', 'Classes', 'Students', 'Bimesters', 'Attendances', 'Grades'];

    for (const table of order) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        console.log(`  ${table}: 0 registros (vazio)`);
        continue;
      }

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);

        const cols = Object.keys(batch[0]).map(c => `"${c}"`).join(', ');
        const booleanCols = ['active', 'status'];
        const placeholders = batch.map((row, ri) => {
          const vals = Object.values(row).map((v, ci) => {
            if (v === null || v === undefined) return 'NULL';
            const colName = Object.keys(row)[ci];
            if (booleanCols.includes(colName)) {
              return v === true || v === 1 || v === '1' || v === 'true' ? 'true' : 'false';
            }
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === 'number') return v.toString();
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          return `(${vals.join(', ')})`;
        }).join(', ');

        try {
          await remote.query(`INSERT INTO "${table}" (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING;`);
        } catch (err) {
          console.error(`  Erro ao inserir em ${table} (lote ${i}):`, err.message);
        }
      }
      console.log(`  ${table}: ${rows.length} registros copiados`);
    }
  }

  try {
    console.log('Lendo dados do SQLite...');
    const data = await getLocalData();

    console.log('\nRecriando tabelas no Supabase...');
    await recreateTables();

    console.log('\nInserindo dados no Supabase...');
    await insertData(data);

    console.log('\n=== Backup concluido com sucesso! ===');
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await local.close();
    await remote.close();
  }
}

backupToSupabase();
