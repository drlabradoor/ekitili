// Централизованный API-клиент.
// Единая точка для fetch-запросов: base URL, credentials, обработка 401/503.

import { BACKEND_URL } from '../config/env.js';

const BASE = `${BACKEND_URL}/api`;
const DEFAULT_TIMEOUT = 15000;   // 15 с — Render free tier может отвечать долго
const RETRY_DELAYS = [0, 4000, 8000]; // первая попытка сразу, потом 4 с, потом 8 с

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

function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...opts, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

async function fetchWithRetry(url, opts = {}, retries = RETRY_DELAYS) {
    for (let i = 0; i < retries.length; i++) {
        if (i > 0) {
            await new Promise(r => setTimeout(r, retries[i]));
            console.log(`[API] retry ${i}/${retries.length - 1}: ${url}`);
        }
        try {
            const res = await fetchWithTimeout(url, opts);
            if (res.ok || res.status < 500) return res;
        } catch (err) {
            if (i === retries.length - 1) throw err;
        }
    }
}

export async function apiGet(path) {
    const res = await fetchWithRetry(`${BASE}${path}`, { credentials: 'include' });
    return handleStatus(res);
}

export async function apiPost(path, body) {
    const res = await fetchWithRetry(`${BASE}${path}`, {
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
    const res = await fetchWithRetry(`${BASE}${path}`);
    return handleStatus(res);
}

/**
 * Проверить доступность API сервера
 */
export async function checkApiConnection() {
    try {
        const response = await fetchWithTimeout(`${BASE}/health`, {}, 10000);
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
