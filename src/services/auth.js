// Сервис для работы с регистрацией и аутентификацией
// Подключение к Oracle через бэкенд API

// URL бэкенд API. Берём hostname из открытой страницы, чтобы работало по LAN.
const API_BASE_URL = typeof window !== 'undefined'
    ? `http://${window.location.hostname}:3000/api`
    : 'http://localhost:3000/api';

/**
 * Хеширование пароля (простая реализация для демо)
 * В продакшене используйте более безопасные методы (bcrypt, argon2 и т.д.)
 */
async function hashPassword(password) {
    // Простая реализация для демо - в реальном приложении используйте Web Crypto API или бэкенд
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Регистрация нового пользователя
 * @param {string} username - Имя пользователя
 * @param {string} password - Пароль
 * @returns {Promise<{success: boolean, userId?: number, error?: string}>}
 */
export async function registerUser(username, password) {
    try {
        // Хешируем пароль
        const passwordHash = await hashPassword(password);
        
        // Отправляем запрос на регистрацию
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password_hash: passwordHash
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Ошибка при регистрации'
            };
        }
        
        return {
            success: true,
            userId: data.user_id,
            username: data.username
        };
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return {
            success: false,
            error: 'Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000.'
        };
    }
}

/**
 * Вход пользователя
 * @param {string} username - Имя пользователя
 * @param {string} password - Пароль
 * @returns {Promise<{success: boolean, userId?: number, username?: string, error?: string}>}
 */
export async function loginUser(username, password) {
    try {
        // Хешируем пароль
        const passwordHash = await hashPassword(password);
        
        // Отправляем запрос на вход
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                password_hash: passwordHash
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Неверное имя пользователя или пароль'
            };
        }
        
        return {
            success: true,
            userId: data.user_id,
            username: data.username
        };
    } catch (error) {
        console.error('Ошибка входа:', error);
        return {
            success: false,
            error: 'Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000.'
        };
    }
}

/**
 * Выход пользователя
 */
export function logoutUser() {
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
}

/**
 * Получить данные текущего пользователя из localStorage
 * @returns {{userId: number, username: string} | null}
 */
export function getCurrentUser() {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    if (userId && username) {
        return {
            userId: parseInt(userId),
            username: username
        };
    }
    
    return null;
}

/**
 * Сохранить данные пользователя в localStorage
 * @param {number} userId - ID пользователя
 * @param {string} username - Имя пользователя
 */
export function saveUser(userId, username) {
    localStorage.setItem('userId', userId.toString());
    localStorage.setItem('username', username);
    localStorage.setItem('user', JSON.stringify({ userId, username }));
}

/**
 * Проверить, авторизован ли пользователь
 * @returns {boolean}
 */
export function isAuthenticated() {
    return getCurrentUser() !== null;
}

