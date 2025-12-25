// Бэкенд сервер для EkiTili
// Подключение к Oracle Database и API для регистрации/входа

const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Настройка подключения к Oracle
// Измените эти параметры под вашу конфигурацию Oracle
const dbConfig = {
    user: process.env.ORACLE_USER || 'SYSTEM',
    password: process.env.ORACLE_PASSWORD || 'system228',
    connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1521/XE'
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
        const { username, password_hash } = req.body;

        if (!username || !password_hash) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Вызываем процедуру REGISTER_USER
            await connection.execute(
                `BEGIN REGISTER_USER(:username, :password_hash); END;`,
                {
                    username: username,
                    password_hash: password_hash
                }
            );
            
            await connection.commit();
            
            // Получаем ID созданного пользователя
            const result = await connection.execute(
                `SELECT USER_ID FROM USER_ACCOUNTS WHERE USERNAME = :username`,
                { username: username }
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
        const { username, password_hash } = req.body;

        if (!username || !password_hash) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const connection = await oracledb.getConnection(dbConfig);
        
        try {
            // Вызываем функцию AUTHENTICATE_USER
            const result = await connection.execute(
                `SELECT AUTHENTICATE_USER(:username, :password_hash) as user_id FROM DUAL`,
                {
                    username: username,
                    password_hash: password_hash
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

// API: Проверка здоровья сервера
app.get('/api/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        oracle_initialized: oracleInitialized
    });
});

// Запуск сервера
async function startServer() {
    await initializeOracle();
    
    if (oracleInitialized) {
        await testConnection();
    }
    
    // Listen on all interfaces so LAN clients can reach it
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  EkiTili Backend API Server');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  ✓ Server running: http://localhost:${PORT}`);
        console.log(`  ✓ API available: http://localhost:${PORT}/api`);
        console.log(`  ✓ Health check: http://localhost:${PORT}/api/health`);
        console.log('');
        
        if (!oracleInitialized) {
            console.log('  ⚠ Database unavailable');
            console.log('  Install Oracle Instant Client to work with database');
        }
        
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

