const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

// Конфигурация БД (копия из server.js)
const dbConfig = {
    user: process.env.ORACLE_USER || 'SYSTEM',
    password: process.env.ORACLE_PASSWORD || 'system228',
    connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1521/XE',
    autoCommit: true
};

async function runMigration() {
    let connection;

    try {
        await oracledb.initOracleClient();
        console.log('✓ Oracle Client initialized');

        connection = await oracledb.getConnection(dbConfig);
        console.log('✓ Connected to Oracle Database');

        const sqlPath = path.join(__dirname, '../database/add_achievements_column.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Разбиваем на команды по '/' (для Oracle)
        const statements = sql.split('/').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement}`);
            try {
                await connection.execute(statement);
                console.log('✓ Success');
            } catch (err) {
                if (err.errorNum === 1430) {
                    console.log('⚠ Column already exists (ORA-01430), skipping...');
                } else {
                    throw err;
                }
            }
        }

        console.log('\nMigration completed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

runMigration();
