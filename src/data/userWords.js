// Per-user SRS состояние — Map<wordId, UserWord>.
// Хранится в localStorage и синкается с сервером.

import { WORDS } from './words.js';
import { clearDailyProgress } from '../services/wordQueue.js';
import { clearFuzzyStats } from '../services/fuzzyMatch.js';
import { clearPendingReviews } from '../services/srsSync.js';
import { clearLessonsCompleted } from './lessons.js';

const STORAGE_KEY = 'ekitili_user_words_v1';

// Минимальное ядро: слова первого урока. Остальные добавляются юзером из библиотеки
// или автоматически при завершении соответствующих уроков.
const CORE_SEED_IDS = ['greet_hello', 'greet_sau_bol', 'book_kitap', 'water_su'];

/**
 * userWords: объект Map<wordId, UserWord>
 *
 * UserWord shape:
 * {
 *   wordId: string,
 *   srsLevel: 1-5,              — уровень kz→ru (основной)
 *   status: 'new'|'learning'|'reviewed'|'mastered',
 *   nextReview: 'YYYY-MM-DD',
 *   lastReview: ISO string | null,
 *   totalReviews: number,
 *   totalCorrect: number,
 *   totalIncorrect: number,
 *   totalNear: number,
 *   enrolledFromLessonId: string | null,
 *   enrolledAt: ISO string,
 *   ruLevel: 0-5,               — 0 = обратная сторона не активирована
 *   ruNextReview: 'YYYY-MM-DD' | null,
 *   ruLastReview: ISO string | null,
 *   updatedAt: ISO string
 * }
 */
export let userWords = {};

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function loadUserWords() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            Object.assign(userWords, parsed);
            return;
        }
    } catch {}
    // Первый запуск: засеиваем только ядро (слова первого урока).
    // Дополнительные слова пользователь добавляет сам из библиотеки.
    seedCoreWords();
}

/**
 * Засеивает ядро — слова первого урока на level=1 со статусом 'new'.
 * Вызывается при первом запуске нового пользователя (localStorage пусто
 * и сервер вернул пустой массив).
 */
export function seedCoreWords() {
    const now = new Date().toISOString();
    const today = todayStr();

    CORE_SEED_IDS.forEach(wordId => {
        if (!WORDS[wordId]) return;
        if (userWords[wordId]) return;  // не затираем существующие
        userWords[wordId] = {
            wordId,
            srsLevel: 1,
            status: 'new',
            nextReview: today,
            lastReview: null,
            totalReviews: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalNear: 0,
            enrolledFromLessonId: 'lesson_greeting',
            enrolledAt: now,
            ruLevel: 0,
            ruNextReview: null,
            ruLastReview: null,
            updatedAt: now
        };
    });
    saveUserWords();
}

export function saveUserWords() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userWords));
    } catch {}
}

export function enrollWord({ wordId, fromLessonId = null, overwrite = false }) {
    if (userWords[wordId] && !overwrite) return;
    const today = todayStr();
    const now = new Date().toISOString();
    userWords[wordId] = {
        wordId,
        srsLevel: 1,
        status: 'new',
        nextReview: today,
        lastReview: null,
        totalReviews: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalNear: 0,
        enrolledFromLessonId: fromLessonId,
        enrolledAt: now,
        ruLevel: 0,
        ruNextReview: null,
        ruLastReview: null,
        updatedAt: now
    };
    saveUserWords();
}

export function enrollWords(wordIds, fromLessonId = null) {
    wordIds.forEach(wordId => enrollWord({ wordId, fromLessonId }));
}

export function updateUserWord(wordId, updates) {
    if (!userWords[wordId]) return;
    Object.assign(userWords[wordId], updates, { updatedAt: new Date().toISOString() });
    saveUserWords();
}

export function mergeServerWords(serverWords) {
    serverWords.forEach(sw => {
        const local = userWords[sw.wordId];
        if (!local || sw.updatedAt > local.updatedAt) {
            userWords[sw.wordId] = sw;
        }
    });
    saveUserWords();
}

export function clearUserWords() {
    Object.keys(userWords).forEach(k => delete userWords[k]);
    saveUserWords();
}

/**
 * Полностью очищает все SRS-связанные localStorage ключи и in-memory
 * состояние. Вызывается на логауте и перед логином, чтобы данные не
 * утекали между пользователями на одном браузере.
 */
export function clearLocalSrsState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    Object.keys(userWords).forEach(k => delete userWords[k]);
    clearDailyProgress();
    clearFuzzyStats();
    clearPendingReviews();
    clearLessonsCompleted();
}
