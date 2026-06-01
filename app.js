// Express-приложение EkiTili — чистый экспорт без .listen().
// Используется локальным server.js (dev) и Render (production).
// dotenv загружается в entry-point (server.js), не тут.

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const BCRYPT_ROUNDS = 12;
const IS_PROD = process.env.NODE_ENV === 'production';

// =====================================================
// Session secret — в production обязателен.
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

if (IS_PROD && allowedOriginsEnv.length === 0) {
    console.warn('[CORS] WARNING: ALLOWED_ORIGINS not set in production!');
}
console.log('[CORS] allowedOrigins:', allowedOriginsEnv);

const localOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/;

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (allowedOriginsEnv.includes(origin)) return cb(null, true);
        if (!IS_PROD && localOriginRegex.test(origin)) return cb(null, true);
        if (/^https:\/\/ekitili[a-z0-9-]*\.vercel\.app$/.test(origin)) return cb(null, true);
        console.warn(`[CORS] blocked: ${origin}`);
        return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Request log
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const uid = (req.user && req.user.userId) || '-';
        console.log(`[${req.method}] ${req.path} ${res.statusCode} ${Date.now() - start}ms uid=${uid}`);
    });
    next();
});

// Render/Railway проксируют через load balancer — нужно для rate-limiter'а.
app.set('trust proxy', 1);

// Статика — только для локальной разработки. В production фронтенд на Vercel.
if (!IS_PROD) {
    app.use(express.static(path.join(__dirname)));
}

// =====================================================
// PostgreSQL (Supabase) connection pool.
// Supabase free tier ~15 соединений всего. 5 оставляет место для Dashboard/Studio.
// =====================================================
const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
    max: 5,
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
// HttpOnly + SameSite=None (cross-origin: frontend на Vercel, backend на Render).
// Secure включается автоматически в проде.
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
        sameSite: IS_PROD ? 'none' : 'lax',
        secure: IS_PROD,
        maxAge: SESSION_MAX_AGE_MS,
        path: '/'
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Токен берём из заголовка Authorization: Bearer <token> ИЛИ из cookie.
// Заголовок нужен для устройств/браузеров, блокирующих сторонние cookie
// (Safari/iOS, Brave, строгий Firefox/Chrome), т.к. фронтенд и бэкенд на разных сайтах.
function getSessionToken(req) {
    const auth = req.headers && req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        return auth.slice(7);
    }
    return (req.cookies && req.cookies[SESSION_COOKIE]) || null;
}

function requireAuth(req, res, next) {
    const token = getSessionToken(req);
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
// Rate limiting (in-memory store, подходит для single-process на Render)
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
        res.json({
            user_id: Number(row.user_id),
            username: row.username,
            token: signSession(Number(row.user_id))
        });
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
        res.json({
            user_id: Number(user.user_id),
            username: user.username,
            token: signSession(Number(user.user_id))
        });
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
    const token = getSessionToken(req);
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
            runtime: 'node'
        });
    } catch (err) {
        res.status(503).json({
            status: 'degraded',
            database: 'disconnected',
            error: err.message,
            runtime: 'node'
        });
    }
});

// =====================================================
// API: SRS — получить все слова пользователя
// =====================================================
app.get('/api/user/words', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT word_id, srs_level, status, next_review, last_review,
                    total_reviews, total_correct, total_incorrect, total_near,
                    enrolled_from_lesson, enrolled_at, ru_level,
                    ru_next_review, ru_last_review, updated_at
             FROM user_words WHERE user_id = $1
             ORDER BY updated_at DESC`,
            [req.user.userId]
        );
        const words = rows.map(r => ({
            wordId: r.word_id,
            srsLevel: r.srs_level,
            status: r.status,
            nextReview: r.next_review,
            lastReview: r.last_review,
            totalReviews: r.total_reviews,
            totalCorrect: r.total_correct,
            totalIncorrect: r.total_incorrect,
            totalNear: r.total_near,
            enrolledFromLessonId: r.enrolled_from_lesson,
            enrolledAt: r.enrolled_at,
            ruLevel: r.ru_level,
            ruNextReview: r.ru_next_review,
            ruLastReview: r.ru_last_review,
            updatedAt: r.updated_at
        }));
        res.json({ words });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// API: SRS — результат одного ревью
// =====================================================
app.post('/api/user/words/review', requireAuth, async (req, res, next) => {
    const { wordId, direction, outcome, attemptNumber, clientTimestamp, userWord } = req.body || {};
    if (!wordId || typeof wordId !== 'string' || wordId.length > 100) {
        return res.status(400).json({ error: 'wordId required' });
    }
    if (!['kz_to_ru', 'ru_to_kz'].includes(direction)) {
        return res.status(400).json({ error: 'direction must be kz_to_ru or ru_to_kz' });
    }
    if (!['exact', 'near', 'wrong'].includes(outcome)) {
        return res.status(400).json({ error: 'outcome must be exact, near, or wrong' });
    }
    if (!userWord || typeof userWord !== 'object') {
        return res.status(400).json({ error: 'userWord required' });
    }

    const srsLevel  = Math.max(1, Math.min(5, Number(userWord.srsLevel) || 1));
    const ruLevel   = Math.max(0, Math.min(5, Number(userWord.ruLevel) || 0));
    const status    = ['new', 'learning', 'reviewed', 'mastered'].includes(userWord.status) ? userWord.status : 'learning';
    const nextReview = userWord.nextReview || null;
    const ruNextReview = userWord.ruNextReview || null;
    const ruLastReview = userWord.ruLastReview || null;

    try {
        await pool.query(
            `INSERT INTO user_words (
                user_id, word_id, srs_level, status, next_review, last_review,
                total_reviews, total_correct, total_incorrect, total_near,
                enrolled_from_lesson, enrolled_at, ru_level, ru_next_review, ru_last_review, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12,$13,$14,NOW())
             ON CONFLICT (user_id, word_id) DO UPDATE SET
                srs_level       = EXCLUDED.srs_level,
                status          = EXCLUDED.status,
                next_review     = EXCLUDED.next_review,
                last_review     = EXCLUDED.last_review,
                total_reviews   = EXCLUDED.total_reviews,
                total_correct   = EXCLUDED.total_correct,
                total_incorrect = EXCLUDED.total_incorrect,
                total_near      = EXCLUDED.total_near,
                ru_level        = EXCLUDED.ru_level,
                ru_next_review  = EXCLUDED.ru_next_review,
                ru_last_review  = EXCLUDED.ru_last_review,
                updated_at      = NOW()`,
            [
                req.user.userId, wordId, srsLevel, status,
                nextReview, new Date().toISOString(),
                (userWord.totalReviews || 0), (userWord.totalCorrect || 0),
                (userWord.totalIncorrect || 0), (userWord.totalNear || 0),
                userWord.enrolledFromLessonId || null,
                ruLevel, ruNextReview, ruLastReview
            ]
        );

        // Обновляем daily_goal счётчик в user_accounts
        const { rows: dailyRows } = await pool.query(
            `SELECT daily_goal FROM user_accounts WHERE user_id = $1`,
            [req.user.userId]
        );
        const goal = dailyRows[0]?.daily_goal ?? 15;

        res.json({ success: true, daily: { goal } });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// API: SRS — зачислить слова в базу пользователя
// =====================================================
app.post('/api/user/words/enroll', requireAuth, async (req, res, next) => {
    const { wordIds, fromLesson } = req.body || {};
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
        return res.status(400).json({ error: 'wordIds array required' });
    }
    if (wordIds.length > 200) {
        return res.status(400).json({ error: 'Too many wordIds' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lesson = typeof fromLesson === 'string' && fromLesson.length <= 100 ? fromLesson : null;

    try {
        for (const wordId of wordIds) {
            if (typeof wordId !== 'string' || wordId.length > 100) continue;
            await pool.query(
                `INSERT INTO user_words (user_id, word_id, next_review, enrolled_from_lesson)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, word_id) DO NOTHING`,
                [req.user.userId, wordId, today, lesson]
            );
        }
        res.json({ success: true, enrolled: wordIds.length });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// API: SRS — bulk sync (offline → online)
// =====================================================
app.post('/api/user/words/bulk', requireAuth, async (req, res, next) => {
    const { words } = req.body || {};
    if (!Array.isArray(words)) {
        return res.status(400).json({ error: 'words array required' });
    }
    if (words.length > 500) {
        return res.status(400).json({ error: 'Too many words in bulk' });
    }

    try {
        for (const uw of words) {
            if (!uw || typeof uw.wordId !== 'string') continue;
            const srsLevel = Math.max(1, Math.min(5, Number(uw.srsLevel) || 1));
            const ruLevel  = Math.max(0, Math.min(5, Number(uw.ruLevel) || 0));
            const status   = ['new', 'learning', 'reviewed', 'mastered'].includes(uw.status) ? uw.status : 'learning';

            await pool.query(
                `INSERT INTO user_words (
                    user_id, word_id, srs_level, status, next_review, last_review,
                    total_reviews, total_correct, total_incorrect, total_near,
                    enrolled_from_lesson, enrolled_at, ru_level, ru_next_review, ru_last_review, updated_at
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                 ON CONFLICT (user_id, word_id) DO UPDATE SET
                    srs_level       = EXCLUDED.srs_level,
                    status          = EXCLUDED.status,
                    next_review     = EXCLUDED.next_review,
                    last_review     = EXCLUDED.last_review,
                    total_reviews   = EXCLUDED.total_reviews,
                    total_correct   = EXCLUDED.total_correct,
                    total_incorrect = EXCLUDED.total_incorrect,
                    total_near      = EXCLUDED.total_near,
                    ru_level        = EXCLUDED.ru_level,
                    ru_next_review  = EXCLUDED.ru_next_review,
                    ru_last_review  = EXCLUDED.ru_last_review,
                    updated_at      = EXCLUDED.updated_at
                 WHERE EXCLUDED.updated_at > user_words.updated_at`,
                [
                    req.user.userId, uw.wordId, srsLevel, status,
                    uw.nextReview || null, uw.lastReview || null,
                    uw.totalReviews || 0, uw.totalCorrect || 0,
                    uw.totalIncorrect || 0, uw.totalNear || 0,
                    uw.enrolledFromLessonId || null, uw.enrolledAt || new Date().toISOString(),
                    ruLevel, uw.ruNextReview || null, uw.ruLastReview || null,
                    uw.updatedAt || new Date().toISOString()
                ]
            );
        }
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// API: ИИ-помощник по уроку (Groq · Llama)
// Прокси: ключ Groq живёт только на сервере, клиент к нему не обращается.
// =====================================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Слишком много запросов к ИИ. Попробуйте через минуту.' }
});

function stripHtml(s) {
    return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildLessonSystemPrompt(lesson) {
    const lines = [
        'Ты — дружелюбный ИИ-помощник в приложении EkiTili для изучения казахского языка.',
        'Отвечай по-русски, тепло и кратко (1–3 предложения).',
        'Помогай по текущему шагу урока: объясняй слова, перевод, произношение, простую грамматику.',
        'Если просят прямой ответ на тестовое задание — не выдавай его напрямую, дай подсказку.',
        'Если вопрос не по уроку — мягко верни к уроку, но коротко ответь.'
    ];
    if (lesson && lesson.title) {
        const sub = lesson.subtitle ? ` (${lesson.subtitle})` : '';
        lines.push(`Текущий урок: «${lesson.title}»${sub}.`);
    }
    const s = lesson && lesson.step;
    if (s && s.type) {
        if (s.type === 'theory') {
            const t = stripHtml(s.html).slice(0, 500);
            lines.push(`Шаг теории «${s.title || ''}». Содержание: ${t}`);
        } else if (s.type === 'choice') {
            const opts = Array.isArray(s.options) ? s.options.join(' / ') : '';
            lines.push(`Шаг выбора. Вопрос: «${s.question || ''}». Варианты: ${opts}.`);
        } else if (s.type === 'match' && Array.isArray(s.pairs)) {
            const pairs = s.pairs.map(p => `${p.kz}↔${p.ru}`).join(', ');
            lines.push(`Шаг соединения пар: ${pairs}.`);
        } else if (s.type === 'build') {
            const toks = Array.isArray(s.tokens) ? s.tokens.join(' ') : '';
            lines.push(`Шаг сборки фразы. Перевод: «${s.ru || ''}». Правильный порядок: ${toks}.`);
        } else if (s.type === 'words') {
            lines.push('Финальный шаг урока — список новых слов.');
        }
    }
    return lines.join('\n');
}

app.post('/api/chat', chatLimiter, async (req, res) => {
    if (!GROQ_API_KEY) {
        return res.status(503).json({ error: 'ИИ-помощник пока не настроен.' });
    }
    const body = req.body || {};
    const raw = Array.isArray(body.messages) ? body.messages : [];
    if (raw.length === 0 || raw.length > 30) {
        return res.status(400).json({ error: 'Bad messages payload' });
    }

    const safeMessages = raw
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12)
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (safeMessages.length === 0) {
        return res.status(400).json({ error: 'Bad messages payload' });
    }

    const systemPrompt = buildLessonSystemPrompt(body.lesson || {});

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const groqRes = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: 'system', content: systemPrompt }, ...safeMessages],
                temperature: 0.6,
                max_tokens: 400
            }),
            signal: controller.signal
        }).finally(() => clearTimeout(timer));

        if (!groqRes.ok) {
            const errText = await groqRes.text().catch(() => '');
            console.error('[Groq] error:', groqRes.status, errText.slice(0, 300));
            return res.status(502).json({ error: 'Не удалось получить ответ от ИИ.' });
        }
        const data = await groqRes.json();
        const reply = (data && data.choices && data.choices[0]
            && data.choices[0].message && data.choices[0].message.content) || '…';
        res.json({ reply });
    } catch (err) {
        console.error('[Groq] fetch failed:', err && err.message);
        res.status(502).json({ error: 'Не удалось связаться с ИИ.' });
    }
});

// SPA catch-all — только для локального dev.
if (!IS_PROD) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
}

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
