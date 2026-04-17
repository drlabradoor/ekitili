// Сервис для работы с регистрацией и аутентификацией.
// Сессия хранится в httpOnly-cookie на сервере (см. server.js),
// клиент лишь помнит user_id/username для отрисовки UI.

// URL бэкенд API. На Vercel используется относительный путь, локально :3000
export function getApiBaseUrl() {
    if (typeof window === 'undefined') {
        return 'http://localhost:3000/api';
    }

    if (window.location.protocol === 'file:' || !window.location.hostname || !window.location.hostname.trim()) {
        return 'http://localhost:3000/api';
    }

    // На Vercel и в продакшене: относительный путь /api (API на том же домене)
    // Локально на localhost:3000 тоже работает
    return '/api';
}

const API_BASE_URL = getApiBaseUrl();

// Все запросы к API должны ходить с сессионной кукой.
const FETCH_OPTS = { credentials: 'include' };

function jsonPost(path, body) {
    return fetch(`${API_BASE_URL}${path}`, {
        ...FETCH_OPTS,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
}

/**
 * Регистрация нового пользователя
 */
export async function registerUser(username, password) {
    try {
        const response = await jsonPost('/register', { username, password });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { success: false, error: data.error || 'Ошибка при регистрации' };
        }

        return {
            success: true,
            userId: data.user_id,
            username: data.username
        };
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        const errorMessage = error.message || 'Неизвестная ошибка';
        return {
            success: false,
            error: `Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000. (${errorMessage})`
        };
    }
}

/**
 * Вход пользователя
 */
export async function loginUser(username, password) {
    try {
        const response = await jsonPost('/login', { username, password });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return { success: false, error: data.error || 'Неверное имя пользователя или пароль' };
        }

        return {
            success: true,
            userId: data.user_id,
            username: data.username
        };
    } catch (error) {
        console.error('Ошибка входа:', error);
        const errorMessage = error.message || 'Неизвестная ошибка';
        return {
            success: false,
            error: `Не удалось подключиться к серверу. Проверьте, запущен ли бэкенд сервер на порту 3000. (${errorMessage})`
        };
    }
}

import { resetUserProfile } from '../data/user.js';
import { resetStreakData } from './streak.js';

/**
 * Выход пользователя — дропаем куку на сервере и локальные данные.
 */
export async function logoutUser() {
    try {
        await jsonPost('/logout', {});
    } catch (error) {
        console.warn('Logout request failed:', error);
    }

    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    resetUserProfile();
    resetStreakData();
}

/**
 * Получить данные текущего пользователя из localStorage (для UI).
 * Это не авторитативный источник — сервер всегда проверяет куку.
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
 * Сохранить данные пользователя в localStorage (только для UI-отрисовки).
 */
export function saveUser(userId, username) {
    localStorage.setItem('userId', userId.toString());
    localStorage.setItem('username', username);
    localStorage.setItem('user', JSON.stringify({ userId, username }));
}

/**
 * Проверить, есть ли локально помеченный пользователь.
 */
export function isAuthenticated() {
    return getCurrentUser() !== null;
}

/**
 * Спросить сервер, авторизован ли пользователь (по куке).
 * Используется при старте, чтобы восстановить сессию после перезагрузки.
 */
export async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/me`, FETCH_OPTS);
        if (!response.ok) return null;
        const data = await response.json();
        return data && data.user ? data.user : null;
    } catch (error) {
        console.error('fetchCurrentUser failed:', error);
        return null;
    }
}

/**
 * Проверить доступность API сервера
 */
export async function checkApiConnection() {
    try {
        const healthUrl = `${API_BASE_URL}/health`;
        const response = await fetch(healthUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
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
