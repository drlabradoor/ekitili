// Бэкенд сервер для EkiTili
// PostgreSQL / Supabase + API для регистрации/входа/достижений/лидерборда

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =====================================================
// PostgreSQL (Supabase) connection pool
// =====================================================
// Читаем настройки из env: PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE
// Supabase требует SSL — включаем всегда.
const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

let dbReady = false;

pool.on('error', (err) => {
    console.error('Unexpected PG pool error:', err.message);
});

async function testConnection() {
    try {
        const { rows } = await pool.query('SELECT NOW() as now');
        dbReady = true;
        console.log(`✓ PostgreSQL connected (server time: ${rows[0].now})`);
        return true;
    } catch (err) {
        dbReady = false;
        console.error('✗ PostgreSQL connection failed:', err.message);
        return false;
    }
}

// Хеширование пароля на сервере (SHA-256) — оставляем двойной хеш клиент+сервер,
// чтобы не ломать уже работающий фронт.
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function dbUnavailable(res) {
    return res.status(503).json({ error: 'Database unavailable. Check Supabase connection.' });
}

// =====================================================
// API: Регистрация пользователя
// =====================================================
app.post('/api/register', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { username, password, password_hash } = req.body;
        if (!username || (!password && !password_hash)) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const hashedPassword = password ? hashPassword(password) : password_hash;

        try {
            const { rows } = await pool.query(
                `INSERT INTO user_accounts (username, password_hash)
                 VALUES ($1, $2)
                 RETURNING user_id, username`,
                [username, hashedPassword]
            );
            const row = rows[0];
            res.json({ user_id: Number(row.user_id), username: row.username });
        } catch (dbError) {
            // 23505 = unique_violation
            if (dbError.code === '23505') {
                return res.status(400).json({ error: 'User with this username already exists' });
            }
            console.error('Register DB error:', dbError);
            res.status(400).json({ error: dbError.message || 'Registration error' });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Вход пользователя
// =====================================================
app.post('/api/login', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { username, password, password_hash } = req.body;
        if (!username || (!password && !password_hash)) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const hashedPassword = password ? hashPassword(password) : password_hash;

        const { rows } = await pool.query(
            `SELECT user_id, username
             FROM user_accounts
             WHERE username = $1 AND password_hash = $2`,
            [username, hashedPassword]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.json({ user_id: Number(rows[0].user_id), username: rows[0].username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Сохранение результата теста
// =====================================================
app.post('/api/test-result', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { user_id, score, total_questions } = req.body;
        if (!user_id || score === undefined || !total_questions) {
            return res.status(400).json({ error: 'user_id, score, and total_questions are required' });
        }

        await pool.query(
            `INSERT INTO test_results (user_id, score, total_questions)
             VALUES ($1, $2, $3)`,
            [user_id, score, total_questions]
        );

        res.json({ success: true, message: 'Test result saved successfully' });
    } catch (error) {
        console.error('Save test result error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Выдача одного достижения (atomic grant через read-modify-write в транзакции)
// =====================================================
app.post('/api/user/achievement/grant', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const { user_id, achievement_id } = req.body;
    if (!user_id || !achievement_id) {
        return res.status(400).json({ error: 'user_id and achievement_id required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT achievements FROM user_accounts WHERE user_id = $1 FOR UPDATE`,
            [user_id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        // pg отдаёт jsonb как уже распарсенный JS-объект
        const current = Array.isArray(rows[0].achievements) ? rows[0].achievements : [];

        const exists = current.find(a =>
            (typeof a === 'string' && a === achievement_id) ||
            (typeof a === 'object' && a && a.id === achievement_id)
        );

        if (exists) {
            await client.query('COMMIT');
            return res.json({ success: true, message: 'Achievement already granted' });
        }

        current.push({
            id: achievement_id,
            awardedDate: new Date().toISOString(),
            progress: 1
        });

        await client.query(
            `UPDATE user_accounts SET achievements = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(current), user_id]
        );
        await client.query('COMMIT');

        res.json({ success: true, achievement: achievement_id });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Grant achievement error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    } finally {
        client.release();
    }
});

// =====================================================
// API: Полная синхронизация списка достижений (JSON blob overwrite)
// =====================================================
app.post('/api/user/achievements', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { user_id, achievements } = req.body;
        if (!user_id || !achievements) {
            return res.status(400).json({ error: 'user_id and achievements array required' });
        }

        await pool.query(
            `UPDATE user_accounts SET achievements = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(achievements), user_id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Save achievements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Получение достижений пользователя
// =====================================================
app.get('/api/user/:userId/achievements', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const userId = parseInt(req.params.userId, 10);
        if (!userId) return res.status(400).json({ error: 'Invalid userId' });

        const { rows } = await pool.query(
            `SELECT achievements FROM user_accounts WHERE user_id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const achievements = Array.isArray(rows[0].achievements) ? rows[0].achievements : [];
        res.json({ achievements });
    } catch (error) {
        console.error('Get achievements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Получение стрика пользователя
// =====================================================
app.get('/api/user/:userId/streak', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const userId = parseInt(req.params.userId, 10);
        if (!userId) return res.status(400).json({ error: 'Invalid userId' });

        const { rows } = await pool.query(
            `SELECT streak FROM user_accounts WHERE user_id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const streak = (rows[0].streak && typeof rows[0].streak === 'object') ? rows[0].streak : {};
        res.json({ streak });
    } catch (error) {
        console.error('Get streak error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Сохранение стрика (full overwrite jsonb blob)
// =====================================================
app.post('/api/user/streak', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { user_id, streak } = req.body;
        if (!user_id || !streak || typeof streak !== 'object') {
            return res.status(400).json({ error: 'user_id and streak object required' });
        }

        await pool.query(
            `UPDATE user_accounts SET streak = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(streak), user_id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Save streak error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// Лидерборд: общий SQL для недели/месяца
// =====================================================
async function fetchLeaderboard(intervalDays) {
    const { rows } = await pool.query(
        `SELECT u.username AS name,
                COALESCE(SUM(t.score), 0)::int AS points
         FROM user_accounts u
         LEFT JOIN test_results t
                ON u.user_id = t.user_id
               AND t.test_date >= NOW() - ($1::int || ' days')::interval
         GROUP BY u.user_id, u.username
         HAVING COALESCE(SUM(t.score), 0) > 0
         ORDER BY points DESC
         LIMIT 10`,
        [intervalDays]
    );
    return rows.map(r => ({ name: r.name, points: r.points || 0 }));
}

app.get('/api/leaderboard/week', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);
    try {
        res.json(await fetchLeaderboard(7));
    } catch (error) {
        console.error('Get week leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/leaderboard/month', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);
    try {
        res.json(await fetchLeaderboard(30));
    } catch (error) {
        console.error('Get month leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Место пользователя в лидерборде (за месяц)
// =====================================================
app.get('/api/leaderboard/user/:user_id', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const userId = parseInt(req.params.user_id, 10);
        if (!userId) return res.status(400).json({ error: 'Invalid user_id' });

        const pointsRes = await pool.query(
            `SELECT COALESCE(SUM(score), 0)::int AS points
             FROM test_results
             WHERE user_id = $1 AND test_date >= NOW() - INTERVAL '30 days'`,
            [userId]
        );
        const userPoints = pointsRes.rows[0].points || 0;

        const placeRes = await pool.query(
            `SELECT COUNT(*) + 1 AS place FROM (
                SELECT user_id, SUM(score) AS total_points
                FROM test_results
                WHERE test_date >= NOW() - INTERVAL '30 days'
                GROUP BY user_id
                HAVING SUM(score) > $1
             ) sub`,
            [userPoints]
        );

        res.json({
            place: Number(placeRes.rows[0].place) || null,
            points: userPoints
        });
    } catch (error) {
        console.error('Get user leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Health check
// =====================================================
app.get('/api/health', async (req, res) => {
    const ok = await testConnection();
    res.json({
        status: 'ok',
        database: ok ? 'connected' : 'disconnected',
        provider: 'supabase-postgres'
    });
});

// SPA catch-all — должен быть после всех /api/* маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

async function startServer() {
    await testConnection();

    const localIP = getLocalIPAddress();
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  EkiTili Server (Supabase / PostgreSQL)');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  ✓ Local:    http://localhost:${PORT}`);
        console.log(`  ✓ Network:  http://${localIP}:${PORT}`);
        console.log(`  ✓ API:      http://${localIP}:${PORT}/api`);
        console.log(`  ✓ Health:   http://${localIP}:${PORT}/api/health`);
        console.log('');
        console.log(dbReady
            ? '  ✓ Database ready — регистрация/логин/лидерборд доступны'
            : '  ⚠ Database unavailable — проверь .env (PGHOST/PGUSER/PGPASSWORD)');
        console.log('');
        console.log('  Press Ctrl+C to stop the server');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
    });
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

startServer().catch(console.error);
