// Express-приложение EkiTili — чистый экспорт без .listen().
// Используется локальным server.js и serverless-функцией api/index.js (Vercel).
// dotenv загружается в entry-points (server.js / api/index.js), не тут.

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const BCRYPT_ROUNDS = 12;
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

// =====================================================
// Session secret — в production/Vercel обязателен.
// Без него каждая serverless-инвокация получит свой одноразовый секрет
// и будет инвалидировать чужие сессии.
// =====================================================
if (!process.env.SESSION_SECRET) {
    if (IS_PROD) {
        throw new Error(
            'SESSION_SECRET must be set. Generate: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
        );
    }
    console.warn('⚠ SESSION_SECRET не задан — генерирую одноразовый. Сессии не переживут рестарт.');
}
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

// =====================================================
// CORS — свой origin + локальная сеть в dev.
// В проде разрешаем только то, что явно указано в ALLOWED_ORIGINS.
// =====================================================
const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const localOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/;

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true); // same-origin (fetch без Origin)
        if (allowedOriginsEnv.includes(origin)) return cb(null, true);
        if (!IS_PROD && localOriginRegex.test(origin)) return cb(null, true);
        return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true
}));

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Vercel отдаёт X-Forwarded-For — нужно для rate-limiter'а и корректного req.ip.
app.set('trust proxy', 1);

// Статика: локально раздаём корень репо. На Vercel файлы index.html/src/**
// перехватываются CDN до вызова функции, так что этот middleware там не мешает.
app.use(express.static(path.join(__dirname)));

// =====================================================
// PostgreSQL (Supabase) connection pool
// Для Vercel используйте Transaction Pooler (порт 6543) — Session pool
// держит долгоживущие соединения, которые serverless не переиспользует.
// =====================================================
const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
    // В serverless один контейнер обычно обслуживает одну инвокацию за раз —
    // большой пул бесполезен и жрёт слоты Supabase.
    max: IS_PROD ? 1 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
    console.error('Unexpected PG pool error:', err.message);
});

function isDbConnectionError(err) {
    if (!err) return false;
    const code = err.code || '';
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(code)) return true;
    const msg = err.message || '';
    return /connection|timeout|ENOTFOUND|ECONNREFUSED/i.test(msg);
}

// =====================================================
// Password hashing — bcrypt с миграцией с legacy SHA-256.
// Legacy-хэши (64 hex) апгрейдятся до bcrypt при следующем успешном входе.
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
// HttpOnly + SameSite=Lax (Strict ломает некоторые flows на Vercel preview).
// Secure включается автоматически в проде (NODE_ENV=production или VERCEL=1).
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
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return userId;
}

function setSessionCookie(res, userId) {
    res.cookie(SESSION_COOKIE, signSession(userId), {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
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

const MAX_ACHIEVEMENTS = 200;
const MAX_STREAK_HISTORY_DAYS = 3000;

// =====================================================
// Rate limiting
// На serverless in-memory store сбрасывается между cold start'ами — защита
// получается частичной. Для жёсткого лимита нужен распределённый store
// (Upstash Redis). Пока держим as-is — хоть какая-то защита.
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
// API: Регистрация
// =====================================================
app.post('/api/register', authLimiter, async (req, res, next) => {
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
        next(dbError);
    }
});

// =====================================================
// API: Вход
// =====================================================
app.post('/api/login', authLimiter, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Logout
// =====================================================
app.post('/api/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
});

// =====================================================
// API: Кто я (восстановление сессии на клиенте)
// =====================================================
app.get('/api/me', async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Сохранение результата теста
// =====================================================
app.post('/api/test-result', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Выдача одного достижения (атомарно)
// =====================================================
app.post('/api/user/achievement/grant', requireAuth, async (req, res, next) => {
    const achievementId = req.body && req.body.achievement_id;
    if (typeof achievementId !== 'string' || achievementId.length === 0 || achievementId.length > 64) {
        return res.status(400).json({ error: 'achievement_id required (string, 1-64 chars)' });
    }

    let client;
    try {
        client = await pool.connect();
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
        if (client) await client.query('ROLLBACK').catch(() => {});
        next(error);
    } finally {
        if (client) client.release();
    }
});

// =====================================================
// API: Полная синхронизация списка достижений
// =====================================================
app.post('/api/user/achievements', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Получение достижений пользователя
// =====================================================
app.get('/api/user/achievements', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Получение стрика
// =====================================================
app.get('/api/user/streak', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Сохранение стрика
// =====================================================
app.post('/api/user/streak', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// Лидерборд
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

app.get('/api/leaderboard/week', async (req, res, next) => {
    try {
        res.json(await fetchLeaderboard(7));
    } catch (error) {
        next(error);
    }
});

app.get('/api/leaderboard/month', async (req, res, next) => {
    try {
        res.json(await fetchLeaderboard(30));
    } catch (error) {
        next(error);
    }
});

app.get('/api/leaderboard/me', requireAuth, async (req, res, next) => {
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
        next(error);
    }
});

// =====================================================
// API: Health check — активная проверка коннекта к БД.
// =====================================================
app.get('/api/health', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT NOW() as now');
        res.json({
            status: 'ok',
            database: 'connected',
            time: rows[0].now,
            provider: 'supabase-postgres',
            runtime: process.env.VERCEL ? 'vercel' : 'node'
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            database: 'disconnected',
            error: err.message,
            runtime: process.env.VERCEL ? 'vercel' : 'node'
        });
    }
});

// SPA catch-all — только для локального dev. На Vercel статика отдаётся CDN,
// а несуществующие пути (мимо /api/*) вернут 404 от платформы.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Централизованный error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err && err.message, err && err.stack);
    if (res.headersSent) return;
    const isConn = isDbConnectionError(err);
    const status = isConn ? 503 : (err.status || 500);
    res.status(status).json({
        error: status === 503 ? 'Database unavailable'
             : status === 400 ? 'Bad request'
             : 'Internal server error'
    });
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

module.exports = app;
