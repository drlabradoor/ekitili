const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

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

        const sqlPath = path.join(__dirname, '../database/achievements_v2.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Разбиваем на команды по '/' (для Oracle)
        const statements = sql.split('/').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            try {
                await connection.execute(statement);
                console.log('✓ Success');
            } catch (err) {
                if (err.errorNum === 955) {
                    console.log('⚠ Object already exists (ORA-00955), skipping...');
                } else if (err.errorNum === 1) {
                    console.log('⚠ Unique constraint violated (ORA-00001), skipping insert...');
                } else {
                    console.error('✗ Error:', err.message);
                }
            }
        }

        console.log('\nMigration V2 completed successfully!');

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
