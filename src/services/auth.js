// Сервис для работы с регистрацией и аутентификацией
// Подключение к Oracle через бэкенд API

// URL бэкенд API. Берём hostname из открытой страницы, чтобы работало по LAN.
// Всегда используем HTTP для локальной сети (сервер не поддерживает HTTPS)
export function getApiBaseUrl() {
    if (typeof window === 'undefined') {
        return 'http://localhost:3000/api';
    }

    // Если открыто через file:// или hostname пустой, используем localhost
    if (window.location.protocol === 'file:' || !window.location.hostname || window.location.hostname === '') {
        return 'http://localhost:3000/api';
    }

    // Используем hostname текущей страницы
    return `http://${window.location.hostname}:3000/api`;
}

const API_BASE_URL = getApiBaseUrl();

/**
 * Хеширование пароля на клиенте (если доступно crypto.subtle)
 * Если недоступно, отправляем пароль на сервер для хеширования
 */
async function hashPassword(password) {
    // Проверяем доступность crypto.subtle (работает только в безопасных контекстах)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('crypto.subtle недоступен, пароль будет захеширован на сервере');
            return null; // Вернем null, чтобы сервер захешировал
        }
    }
    // crypto.subtle недоступен (небезопасный контекст), вернем null
    console.warn('crypto.subtle недоступен, пароль будет захеширован на сервере');
    return null;
}

/**
 * Регистрация нового пользователя
 * @param {string} username - Имя пользователя
 * @param {string} password - Пароль
 * @returns {Promise<{success: boolean, userId?: number, error?: string}>}
 */
export async function registerUser(username, password) {
    try {
        // Пытаемся захешировать пароль на клиенте
        const passwordHash = await hashPassword(password);

        // Отправляем запрос на регистрацию
        // Если passwordHash === null, сервер захеширует пароль сам
        const requestBody = passwordHash
            ? { username, password_hash: passwordHash }
            : { username, password };

        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
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
        console.error('API URL:', API_BASE_URL);
        const errorMessage = error.message || 'Неизвестная ошибка';
        return {
            success: false,
            error: `Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000. (${errorMessage})`
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
        // Пытаемся захешировать пароль на клиенте
        const passwordHash = await hashPassword(password);

        // Отправляем запрос на вход
        // Если passwordHash === null, сервер захеширует пароль сам
        const requestBody = passwordHash
            ? { username, password_hash: passwordHash }
            : { username, password };

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
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
        console.error('API URL:', API_BASE_URL);
        const errorMessage = error.message || 'Неизвестная ошибка';
        return {
            success: false,
            error: `Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000. (${errorMessage})`
        };
    }
}

import { resetUserProfile } from '../data/user.js';

/**
 * Выход пользователя
 */
export function logoutUser() {
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    // Сбрасываем профиль в памяти
    resetUserProfile();
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

/**
 * Проверить доступность API сервера
 * @returns {Promise<boolean>}
 */
export async function checkApiConnection() {
    try {
        const healthUrl = API_BASE_URL.replace('/api', '/api/health');
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✓ API сервер доступен:', data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('✗ API сервер недоступен:', error);
        console.error('Попытка подключения к:', API_BASE_URL);
        return false;
    }
}

