// Сервис для работы с регистрацией и аутентификацией.
// Сессия хранится в httpOnly-cookie на сервере (см. app.js),
// клиент лишь помнит user_id/username для отрисовки UI.

import { apiPost, apiGet } from './apiClient.js';


/**
 * Регистрация нового пользователя
 */
export async function registerUser(username, password) {
    try {
        const response = await apiPost('/register', { username, password });
        if (!response) return { success: false, error: 'Сервер недоступен' };

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Ошибка при регистрации' };
        }

        return {
            success: true,
            userId: data.user_id,
            username: data.username,
            token: data.token
        };
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return {
            success: false,
            error: `Не удалось подключиться к серверу. (${error.message || 'Неизвестная ошибка'})`
        };
    }
}

/**
 * Вход пользователя
 */
export async function loginUser(username, password) {
    try {
        const response = await apiPost('/login', { username, password });
        if (!response) return { success: false, error: 'Сервер недоступен' };

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Неверное имя пользователя или пароль' };
        }

        return {
            success: true,
            userId: data.user_id,
            username: data.username,
            token: data.token
        };
    } catch (error) {
        console.error('Ошибка входа:', error);
        return {
            success: false,
            error: `Не удалось подключиться к серверу. (${error.message || 'Неизвестная ошибка'})`
        };
    }
}

import { resetUserProfile } from '../data/user.js';
import { resetStreakData } from './streak.js';
import { clearLocalSrsState } from '../data/userWords.js';
import { syncFlashcardsShim } from '../data/flashcards.js';

/**
 * Выход пользователя — дропаем куку на сервере и локальные данные.
 */
export async function logoutUser() {
    try {
        await apiPost('/logout', {});
    } catch (error) {
        console.warn('Logout request failed:', error);
    }

    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('sessionToken');

    resetUserProfile();
    resetStreakData();
    clearLocalSrsState();
    syncFlashcardsShim();
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
 * token — подписанный сессионный токен; шлётся в заголовке Authorization,
 * чтобы авторизация работала там, где браузер блокирует сторонние cookie.
 */
export function saveUser(userId, username, token) {
    localStorage.setItem('userId', userId.toString());
    localStorage.setItem('username', username);
    localStorage.setItem('user', JSON.stringify({ userId, username }));
    if (token) {
        localStorage.setItem('sessionToken', token);
    }
}

/**
 * Получить сессионный токен для заголовка Authorization (или null).
 */
export function getSessionToken() {
    return localStorage.getItem('sessionToken');
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
        const response = await apiGet('/me');
        if (!response || !response.ok) return null;
        const data = await response.json();
        return data && data.user ? data.user : null;
    } catch (error) {
        console.error('fetchCurrentUser failed:', error);
        return null;
    }
}
