// Применяет database/supabase_setup.sql к Supabase PostgreSQL.
// Идемпотентно: можно запускать повторно. Использует настройки из .env.
//
// Usage:  node scripts/apply_supabase.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
    const sqlPath = path.join(__dirname, '..', 'database', 'supabase_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = new Client({
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT, 10) || 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false }
    });

    console.log(`Connecting to ${process.env.PGHOST}...`);
    await client.connect();
    console.log('✓ Connected');

    console.log(`Applying ${sqlPath}...`);
    try {
        await client.query(sql);
        console.log('✓ Schema applied successfully');
    } catch (err) {
        console.error('✗ Schema apply failed:', err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }

    // Быстрая верификация
    const check = new Client({
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT, 10) || 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false }
    });
    await check.connect();
    const { rows } = await check.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('user_accounts','test_results','achievements_def','user_achievements')
         ORDER BY table_name`
    );
    console.log('Tables present:', rows.map(r => r.table_name).join(', ') || '(none)');
    await check.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
