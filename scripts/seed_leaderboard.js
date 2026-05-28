// Применяет database/seed_leaderboard.sql к Supabase через те же креды, что и сервер.
// Использование: node scripts/seed_leaderboard.js
//
// Берёт PGHOST/PGUSER/PGPASSWORD/PGDATABASE из .env (тот же файл, что app.js).
// Идемпотентен — можно гонять повторно.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
    const client = new Client({
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT, 10) || 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false }
    });

    const sqlPath = path.join(__dirname, '..', 'database', 'seed_leaderboard.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await client.connect();
        console.log('Connected to Supabase');
        const result = await client.query(sql);
        // Последний SELECT возвращает сводку
        const summary = Array.isArray(result) ? result[result.length - 1] : result;
        if (summary && summary.rows) {
            console.log('\nPlaceholder users in the leaderboard (last 7 days):');
            console.table(summary.rows);
        }
        console.log('\nSeed complete.');
    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
