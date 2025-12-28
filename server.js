// Бэкенд сервер для EkiTili
// Подключение к Oracle Database и API для регистрации/входа

const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Раздача статических файлов
app.use(express.static(path.join(__dirname)));

// Настройка подключения к Oracle
// Измените эти параметры под вашу конфигурацию Oracle
const dbConfig = {
    user: process.env.ORACLE_USER || 'SYSTEM',
    password: process.env.ORACLE_PASSWORD || 'system228',
    connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1521/XE',
    autoCommit: false, // Управляем коммитами вручную
    stmtCacheSize: 30
};

// Инициализация Oracle Client
let oracleInitialized = false;

async function initializeOracle() {
    try {
        // Попытка инициализации Oracle Client
        // Если не установлен, будет ошибка, но приложение продолжит работу
        await oracledb.initOracleClient();
        oracleInitialized = true;
        console.log('✓ Oracle Client initialized');
    } catch (error) {
        console.warn('⚠ Oracle Client not found. Install Oracle Instant Client to work with database.');
        console.warn('  Download: https://www.oracle.com/database/technologies/instant-client/downloads.html');
        oracleInitialized = false;
    }
}

// Хеширование пароля на сервере (SHA-256)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Проверка подключения к базе данных
async function testConnection() {
    if (!oracleInitialized) {
        return false;
    }
    
    try {
        const connection = await oracledb.getConnection(dbConfig);
        await connection.close();
        console.log('✓ Connection to Oracle Database successful');
        return true;
    } catch (error) {
        console.error('✗ Error connecting to Oracle Database:', error.message);
        console.error('  Check connection parameters in server.js');
        return false;
    }
}

// API: Регистрация пользователя
app.post('/api/register', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const { username, password, password_hash } = req.body;

        if (!username || (!password && !password_hash)) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Хешируем пароль на сервере (если передан обычный пароль)
        const hashedPassword = password ? hashPassword(password) : password_hash;

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Вызываем процедуру REGISTER_USER
            await connection.execute(
                `BEGIN REGISTER_USER(:username, :password_hash); END;`,
                {
                    username: username,
                    password_hash: hashedPassword
                }
            );
            
            // Коммитим транзакцию
            await connection.commit();
            
            // Получаем ID созданного пользователя
            const result = await connection.execute(
                `SELECT USER_ID FROM USER_ACCOUNTS WHERE USERNAME = :username`,
                { username: username },
                { outFormat: oracledb.OUT_FORMAT_ARRAY }
            );
            
            const userId = result.rows[0][0];
            
            res.json({ 
                user_id: userId, 
                username: username 
            });
        } catch (dbError) {
            await connection.rollback();
            
            // Обработка ошибок Oracle
            if (dbError.errorNum === 1) {
                // ORA-00001: unique constraint violated
                res.status(400).json({ error: 'User with this username already exists' });
            } else {
                res.status(400).json({ error: dbError.message || 'Registration error' });
            }
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Вход пользователя
app.post('/api/login', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const { username, password, password_hash } = req.body;

        if (!username || (!password && !password_hash)) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Хешируем пароль на сервере (если передан обычный пароль)
        const hashedPassword = password ? hashPassword(password) : password_hash;

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Вызываем функцию AUTHENTICATE_USER
            const result = await connection.execute(
                `SELECT AUTHENTICATE_USER(:username, :password_hash) as user_id FROM DUAL`,
                {
                    username: username,
                    password_hash: hashedPassword
                }
            );
            
            const userId = result.rows[0][0];
            
            if (userId) {
                res.json({ 
                    user_id: userId, 
                    username: username 
                });
            } else {
                res.status(401).json({ error: 'Invalid username or password' });
            }
        } catch (dbError) {
            res.status(401).json({ error: 'Invalid username or password' });
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Сохранение результата теста
app.post('/api/test-result', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const { user_id, score, total_questions } = req.body;

        if (!user_id || score === undefined || !total_questions) {
            return res.status(400).json({ error: 'user_id, score, and total_questions are required' });
        }

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Вызываем процедуру SAVE_TEST_RESULT
            await connection.execute(
                `BEGIN SAVE_TEST_RESULT(:user_id, :score, :total_questions); END;`,
                {
                    user_id: user_id,
                    score: score,
                    total_questions: total_questions
                }
            );
            
            await connection.commit();
            
            res.json({ 
                success: true,
                message: 'Test result saved successfully'
            });
        } catch (dbError) {
            await connection.rollback();
            res.status(400).json({ error: dbError.message || 'Error saving test result' });
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Save test result error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Получение лидерборда за неделю
app.get('/api/leaderboard/week', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Используем прямой SQL запрос вместо функции с курсором
            const result = await connection.execute(
                `SELECT 
                    u.USERNAME as name,
                    NVL(SUM(t.SCORE), 0) as points
                FROM USER_ACCOUNTS u
                LEFT JOIN TEST_RESULTS t ON u.USER_ID = t.USER_ID AND t.TEST_DATE >= SYSDATE - 7
                GROUP BY u.USER_ID, u.USERNAME
                HAVING NVL(SUM(t.SCORE), 0) > 0
                ORDER BY points DESC
                FETCH FIRST 10 ROWS ONLY`,
                {},
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            
            const leaderboard = result.rows.map(row => ({
                name: row.NAME,
                points: row.POINTS || 0
            }));
            
            res.json(leaderboard);
        } catch (dbError) {
            res.status(400).json({ error: dbError.message || 'Error fetching leaderboard' });
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Получение лидерборда за месяц
app.get('/api/leaderboard/month', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Используем прямой SQL запрос вместо функции с курсором
            const result = await connection.execute(
                `SELECT 
                    u.USERNAME as name,
                    NVL(SUM(t.SCORE), 0) as points
                FROM USER_ACCOUNTS u
                LEFT JOIN TEST_RESULTS t ON u.USER_ID = t.USER_ID AND t.TEST_DATE >= SYSDATE - 30
                GROUP BY u.USER_ID, u.USERNAME
                HAVING NVL(SUM(t.SCORE), 0) > 0
                ORDER BY points DESC
                FETCH FIRST 10 ROWS ONLY`,
                {},
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            
            const leaderboard = result.rows.map(row => ({
                name: row.NAME,
                points: row.POINTS || 0
            }));
            
            res.json(leaderboard);
        } catch (dbError) {
            res.status(400).json({ error: dbError.message || 'Error fetching leaderboard' });
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Получение места пользователя в лидерборде
app.get('/api/leaderboard/user/:user_id', async (req, res) => {
    if (!oracleInitialized) {
        return res.status(503).json({ 
            error: 'Database unavailable. Install Oracle Instant Client and check connection.' 
        });
    }

    try {
        const userId = parseInt(req.params.user_id);
        if (!userId) {
            return res.status(400).json({ error: 'Invalid user_id' });
        }

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Получаем очки пользователя за месяц
            const pointsResult = await connection.execute(
                `SELECT NVL(SUM(SCORE), 0) as points FROM TEST_RESULTS WHERE USER_ID = :user_id AND TEST_DATE >= SYSDATE - 30`,
                { user_id: userId }
            );
            
            const userPoints = pointsResult.rows[0][0] || 0;
            
            // Считаем место пользователя
            const placeResult = await connection.execute(
                `SELECT COUNT(*) + 1 as place
                FROM (
                    SELECT USER_ID, SUM(SCORE) as total_points
                    FROM TEST_RESULTS
                    WHERE TEST_DATE >= SYSDATE - 30
                    GROUP BY USER_ID
                    HAVING SUM(SCORE) > :user_points
                )`,
                { user_points: userPoints }
            );
            
            res.json({
                place: placeResult.rows[0][0] || null,
                points: userPoints
            });
        } catch (dbError) {
            res.status(400).json({ error: dbError.message || 'Error fetching user leaderboard data' });
        } finally {
            await connection.close();
        }
    } catch (error) {
        console.error('Get user leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Проверка здоровья сервера
app.get('/api/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        oracle_initialized: oracleInitialized
    });
});

// Отдача index.html для всех остальных маршрутов (SPA)
// Должен быть после всех API маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Получение локального IP адреса
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Пропускаем внутренние и не-IPv4 адреса
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Запуск сервера
async function startServer() {
    await initializeOracle();
    
    if (oracleInitialized) {
        await testConnection();
    }
    
    const localIP = getLocalIPAddress();
    
    // Listen on all interfaces so LAN clients can reach it
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  EkiTili Server');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  ✓ Local:    http://localhost:${PORT}`);
        console.log(`  ✓ Network:  http://${localIP}:${PORT}`);
        console.log(`  ✓ API:      http://${localIP}:${PORT}/api`);
        console.log(`  ✓ Health:   http://${localIP}:${PORT}/api/health`);
        console.log('');
        console.log('  📱 Доступно по локальной сети!');
        console.log('  ⚠ ВАЖНО: Используйте HTTP (не HTTPS)!');
        console.log('  Откройте в браузере на других устройствах:');
        console.log(`  http://${localIP}:${PORT}`);
        console.log('');
        console.log('  Если браузер показывает ошибку безопасности:');
        console.log('  - Убедитесь, что используете http:// (не https://)');
        console.log('  - Нажмите "Дополнительно" → "Перейти на сайт"');
        console.log('');
        
        if (!oracleInitialized) {
            console.log('  ⚠ Database unavailable');
            console.log('  Install Oracle Instant Client to work with database');
            console.log('  Регистрация будет недоступна без базы данных');
        } else {
            console.log('  ✓ Database ready - регистрация доступна');
        }
        
        console.log('');
        console.log('  Press Ctrl+C to stop the server');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
    });
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

// Запуск
startServer().catch(console.error);

