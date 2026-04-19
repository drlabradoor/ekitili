// Централизованный API-клиент.
// Единая точка для fetch-запросов: base URL, credentials, обработка 401/503.

import { BACKEND_URL } from '../config/env.js';

const BASE = `${BACKEND_URL}/api`;

function handleStatus(res) {
    if (res.status === 401) {
        document.dispatchEvent(new CustomEvent('api-session-expired'));
        return null;
    }
    if (res.status === 503) {
        document.dispatchEvent(new CustomEvent('api-backend-down'));
        return null;
    }
    return res;
}

export async function apiGet(path) {
    const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
    return handleStatus(res);
}

export async function apiPost(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    });
    return handleStatus(res);
}

/**
 * GET без credentials (для публичных эндпоинтов типа /leaderboard)
 */
export async function apiGetPublic(path) {
    const res = await fetch(`${BASE}${path}`);
    return handleStatus(res);
}

/**
 * Проверить доступность API сервера
 */
export async function checkApiConnection() {
    try {
        const response = await fetch(`${BASE}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('[API] сервер доступен:', data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[API] сервер недоступен:', error);
        return false;
    }
}
