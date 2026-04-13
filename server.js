// Бэкенд сервер для EkiTili
// PostgreSQL / Supabase + API для регистрации/входа/достижений/лидерборда

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const BCRYPT_ROUNDS = 12;

// Session secret: ДОЛЖЕН быть задан в продакшене. В dev генерируем разовый
// секрет при старте — это инвалидирует все сессии при рестарте, что безопасно.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.SESSION_SECRET) {
    console.warn('⚠ SESSION_SECRET не задан в .env — генерирую одноразовый. Все сессии инвалидируются при рестарте.');
}

// =====================================================
// CORS — только свой собственный origin и LAN-адрес.
// Разрешённые origins можно переопределить через ALLOWED_ORIGINS (CSV).
// =====================================================
const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const allowedOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/;

app.use(cors({
    origin(origin, cb) {
        // Same-origin fetch не шлёт Origin — пропускаем.
        if (!origin) return cb(null, true);
        if (allowedOriginsEnv.includes(origin)) return cb(null, true);
        if (allowedOriginRegex.test(origin)) return cb(null, true);
        return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true
}));

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

// =====================================================
// PostgreSQL (Supabase) connection pool
// =====================================================
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

function dbUnavailable(res) {
    return res.status(503).json({ error: 'Database unavailable. Check Supabase connection.' });
}

// =====================================================
// Password hashing — bcrypt с миграцией с legacy SHA-256.
// Legacy-хэши (64 hex-символа) апгрейдятся до bcrypt при следующем успешном входе.
// =====================================================
function legacySha256(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function isLegacyHash(hash) {
    return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
}

async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    if (isLegacyHash(storedHash)) {
        return legacySha256(password) === storedHash;
    }
    try {
        return await bcrypt.compare(password, storedHash);
    } catch {
        return false;
    }
}

// =====================================================
// Сессии — подписанная кука session=<user_id>.<hmac>
// HttpOnly + SameSite=Strict. Secure включаем когда сервер за TLS.
// =====================================================
const SESSION_COOKIE = 'ekitili_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

function signSession(userId) {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET)
        .update(String(userId))
        .digest('hex');
    return `${userId}.${hmac}`;
}

function verifySession(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const [userIdStr, sig] = token.split('.', 2);
    const userId = parseInt(userIdStr, 10);
    if (!userId || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET)
        .update(String(userId))
        .digest('hex');
    // timing-safe compare
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return userId;
}

function setSessionCookie(res, userId) {
    res.cookie(SESSION_COOKIE, signSession(userId), {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_MAX_AGE_MS,
        path: '/'
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function requireAuth(req, res, next) {
    const token = req.cookies && req.cookies[SESSION_COOKIE];
    const userId = verifySession(token);
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = { userId };
    next();
}

// =====================================================
// Валидация входных данных
// =====================================================
const USERNAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,32}$/;

function validateCredentials(body) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!USERNAME_RE.test(username)) {
        return { error: 'Username must be 3-32 chars (letters, digits, _ . -)' };
    }
    if (password.length < 6 || password.length > 128) {
        return { error: 'Password must be 6-128 chars' };
    }
    return { username, password };
}

// Лимит на размер массива/jsonb-блоба, чтобы не забить колонку мегабайтами.
const MAX_ACHIEVEMENTS = 200;
const MAX_STREAK_HISTORY_DAYS = 3000;

// =====================================================
// Rate limiting
// =====================================================
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts. Try again in a minute.' }
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests.' }
});

app.use('/api/', apiLimiter);

// =====================================================
// API: Регистрация пользователя
// =====================================================
app.post('/api/register', authLimiter, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const v = validateCredentials(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });

    try {
        const hashedPassword = await hashPassword(v.password);
        const { rows } = await pool.query(
            `INSERT INTO user_accounts (username, password_hash)
             VALUES ($1, $2)
             RETURNING user_id, username`,
            [v.username, hashedPassword]
        );
        const row = rows[0];
        setSessionCookie(res, Number(row.user_id));
        res.json({ user_id: Number(row.user_id), username: row.username });
    } catch (dbError) {
        if (dbError.code === '23505') {
            return res.status(400).json({ error: 'User with this username already exists' });
        }
        console.error('Register DB error:', dbError);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// =====================================================
// API: Вход пользователя
// =====================================================
app.post('/api/login', authLimiter, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const v = validateCredentials(req.body || {});
    if (v.error) return res.status(401).json({ error: 'Invalid username or password' });

    try {
        const { rows } = await pool.query(
            `SELECT user_id, username, password_hash
             FROM user_accounts
             WHERE username = $1`,
            [v.username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = rows[0];
        const ok = await verifyPassword(v.password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Апгрейд legacy SHA-256 → bcrypt при успешном логине.
        if (isLegacyHash(user.password_hash)) {
            try {
                const newHash = await hashPassword(v.password);
                await pool.query(
                    `UPDATE user_accounts SET password_hash = $1 WHERE user_id = $2`,
                    [newHash, user.user_id]
                );
            } catch (upgradeErr) {
                console.error('Password hash upgrade failed:', upgradeErr.message);
            }
        }

        setSessionCookie(res, Number(user.user_id));
        res.json({ user_id: Number(user.user_id), username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Выход
// =====================================================
app.post('/api/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
});

// =====================================================
// API: Кто я (для восстановления сессии на клиенте)
// =====================================================
app.get('/api/me', async (req, res) => {
    if (!dbReady) return dbUnavailable(res);
    const token = req.cookies && req.cookies[SESSION_COOKIE];
    const userId = verifySession(token);
    if (!userId) return res.json({ user: null });

    try {
        const { rows } = await pool.query(
            `SELECT user_id, username FROM user_accounts WHERE user_id = $1`,
            [userId]
        );
        if (rows.length === 0) {
            clearSessionCookie(res);
            return res.json({ user: null });
        }
        res.json({ user: { user_id: Number(rows[0].user_id), username: rows[0].username } });
    } catch (error) {
        console.error('Me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Сохранение результата теста
// =====================================================
app.post('/api/test-result', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const score = Number(req.body && req.body.score);
    const total = Number(req.body && req.body.total_questions);
    if (!Number.isInteger(score) || score < 0 || score > 10000) {
        return res.status(400).json({ error: 'Invalid score' });
    }
    if (!Number.isInteger(total) || total <= 0 || total > 10000) {
        return res.status(400).json({ error: 'Invalid total_questions' });
    }
    if (score > total) {
        return res.status(400).json({ error: 'score cannot exceed total_questions' });
    }

    try {
        await pool.query(
            `INSERT INTO test_results (user_id, score, total_questions)
             VALUES ($1, $2, $3)`,
            [req.user.userId, score, total]
        );
        res.json({ success: true, message: 'Test result saved successfully' });
    } catch (error) {
        console.error('Save test result error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// API: Выдача одного достижения
// =====================================================
app.post('/api/user/achievement/grant', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const achievementId = req.body && req.body.achievement_id;
    if (typeof achievementId !== 'string' || achievementId.length === 0 || achievementId.length > 64) {
        return res.status(400).json({ error: 'achievement_id required (string, 1-64 chars)' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT achievements FROM user_accounts WHERE user_id = $1 FOR UPDATE`,
            [req.user.userId]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        const current = Array.isArray(rows[0].achievements) ? rows[0].achievements : [];
        const exists = current.find(a =>
            (typeof a === 'string' && a === achievementId) ||
            (typeof a === 'object' && a && a.id === achievementId)
        );

        if (exists) {
            await client.query('COMMIT');
            return res.json({ success: true, message: 'Achievement already granted' });
        }

        if (current.length >= MAX_ACHIEVEMENTS) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Achievements limit reached' });
        }

        current.push({
            id: achievementId,
            awardedDate: new Date().toISOString(),
            progress: 1
        });

        await client.query(
            `UPDATE user_accounts SET achievements = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(current), req.user.userId]
        );
        await client.query('COMMIT');

        res.json({ success: true, achievement: achievementId });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Grant achievement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// =====================================================
// API: Полная синхронизация списка достижений
// =====================================================
app.post('/api/user/achievements', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const achievements = req.body && req.body.achievements;
    if (!Array.isArray(achievements)) {
        return res.status(400).json({ error: 'achievements array required' });
    }
    if (achievements.length > MAX_ACHIEVEMENTS) {
        return res.status(400).json({ error: 'Too many achievements' });
    }

    try {
        await pool.query(
            `UPDATE user_accounts SET achievements = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(achievements), req.user.userId]
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
app.get('/api/user/achievements', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { rows } = await pool.query(
            `SELECT achievements FROM user_accounts WHERE user_id = $1`,
            [req.user.userId]
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
app.get('/api/user/streak', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const { rows } = await pool.query(
            `SELECT streak FROM user_accounts WHERE user_id = $1`,
            [req.user.userId]
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
// API: Сохранение стрика
// =====================================================
app.post('/api/user/streak', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    const streak = req.body && req.body.streak;
    if (!streak || typeof streak !== 'object' || Array.isArray(streak)) {
        return res.status(400).json({ error: 'streak object required' });
    }
    if (streak.history && typeof streak.history === 'object') {
        const historyKeys = Object.keys(streak.history);
        if (historyKeys.length > MAX_STREAK_HISTORY_DAYS) {
            return res.status(400).json({ error: 'Streak history too large' });
        }
    }

    try {
        await pool.query(
            `UPDATE user_accounts SET streak = $1::jsonb WHERE user_id = $2`,
            [JSON.stringify(streak), req.user.userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Save streak error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =====================================================
// Лидерборд: публичный (только топ-10 по никам, чувствительных данных нет).
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
// API: Место текущего пользователя в лидерборде (за месяц)
// =====================================================
app.get('/api/leaderboard/me', requireAuth, async (req, res) => {
    if (!dbReady) return dbUnavailable(res);

    try {
        const pointsRes = await pool.query(
            `SELECT COALESCE(SUM(score), 0)::int AS points
             FROM test_results
             WHERE user_id = $1 AND test_date >= NOW() - INTERVAL '30 days'`,
            [req.user.userId]
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

// Обработчик ошибок — generic responses, detalis только в лог.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    const status = err.status || 500;
    res.status(status).json({ error: status === 400 ? 'Bad request' : 'Internal server error' });
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
