// Синхронизация SRS-прогресса с сервером.

import { apiGet, apiPost } from './apiClient.js';
import { userWords, mergeServerWords, saveUserWords } from '../data/userWords.js';
import { syncFlashcardsShim } from '../data/flashcards.js';

let pendingReviews = [];
const PENDING_KEY = 'ekitili_srs_pending_v1';

function loadPending() {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        pendingReviews = raw ? JSON.parse(raw) : [];
    } catch {
        pendingReviews = [];
    }
}

function savePending() {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(pendingReviews));
    } catch {}
}

/**
 * Загружает SRS-состояние с сервера и мёрджит с локальным.
 * Вызывается при логине/старте приложения.
 */
export async function fetchAndMergeWords() {
    try {
        const res = await apiGet('/user/words');
        if (!res) return;
        const data = await res.json();
        if (Array.isArray(data.words)) {
            mergeServerWords(data.words);
            syncFlashcardsShim();
        }
    } catch (err) {
        console.warn('[srsSync] fetchAndMergeWords failed:', err.message);
    }
}

/**
 * Отправляет результат одного ревью на сервер.
 * Если запрос провалился — сохраняем в очередь для flush.
 */
export async function postReview({ wordId, direction, outcome, attemptNumber, newUserWord }) {
    const payload = {
        wordId,
        direction,
        outcome,
        attemptNumber,
        clientTimestamp: new Date().toISOString(),
        userWord: newUserWord
    };

    try {
        const res = await apiPost('/user/words/review', payload);
        if (!res) throw new Error('no response');
    } catch {
        loadPending();
        pendingReviews.push(payload);
        savePending();
    }
}

/**
 * Отправляет слова на enroll на сервер.
 */
export async function postEnroll(wordIds, fromLesson = null) {
    try {
        await apiPost('/user/words/enroll', { wordIds, fromLesson });
    } catch (err) {
        console.warn('[srsSync] postEnroll failed:', err.message);
    }
}

export function clearPendingReviews() {
    pendingReviews = [];
    try { localStorage.removeItem(PENDING_KEY); } catch {}
}

/**
 * Сбрасывает накопленную очередь ревью (offline → online).
 */
export async function flushPending() {
    loadPending();
    if (pendingReviews.length === 0) return;

    try {
        const res = await apiPost('/user/words/bulk', {
            words: Object.values(userWords)
        });
        if (res) {
            pendingReviews = [];
            savePending();
        }
    } catch (err) {
        console.warn('[srsSync] flushPending failed:', err.message);
    }
}
