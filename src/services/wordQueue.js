// Приоритетная очередь ревью и дневная норма.

import { getDueTasks } from './srsEngine.js';
import { userWords } from '../data/userWords.js';
import { WORDS } from '../data/words.js';

export const DEFAULT_DAILY_GOAL = 10;

const GOAL_KEY = 'ekitili_daily_goal_v1';
const PROGRESS_KEY = 'ekitili_daily_progress_v1';

export function getDailyGoal() {
    return parseInt(localStorage.getItem(GOAL_KEY) ?? DEFAULT_DAILY_GOAL, 10);
}

export function setDailyGoal(n) {
    localStorage.setItem(GOAL_KEY, String(n));
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadDailyProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        const p = raw ? JSON.parse(raw) : {};
        if (p.date !== todayStr()) return { date: todayStr(), done: 0 };
        return p;
    } catch {
        return { date: todayStr(), done: 0 };
    }
}

function saveDailyProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
}

export function getDailyProgress() {
    const p = loadDailyProgress();
    return { done: p.done, goal: getDailyGoal() };
}

export function incrementDailyProgress() {
    const p = loadDailyProgress();
    p.done = (p.done || 0) + 1;
    saveDailyProgress(p);
    return p;
}

export function isGoalReached() {
    const p = loadDailyProgress();
    return p.done >= getDailyGoal();
}

export function clearDailyProgress() {
    try {
        localStorage.removeItem(PROGRESS_KEY);
        localStorage.removeItem(GOAL_KEY);
    } catch {}
}

/**
 * Собирает упорядоченный список заданий для сегодняшней сессии.
 * Задание: { wordId, direction }
 *
 * Приоритет:
 *   P0  Просроченные из 3 последних уроков (по enrolledAt)
 *   P1  Остальные просроченные
 *   P2  Новые карты последнего урока (status='new')
 *
 * Внутри групп: nextReview ASC, totalIncorrect DESC.
 *
 * @param {string[]} recentLessonIds — последние 3 пройденных урока
 * @param {number} limit
 */
export function buildReviewQueue(recentLessonIds = [], limit = Infinity) {
    const today = todayStr();
    const due = getDueTasks(userWords, today);

    const recentSet = new Set(recentLessonIds.slice(-3));

    // Разделяем на P0 (недавние уроки) и P1 (остальное)
    const p0 = [], p1 = [], p2 = [];

    due.forEach(task => {
        const uw = userWords[task.wordId];
        if (!uw) return;
        if (recentSet.has(uw.enrolledFromLessonId)) {
            p0.push(task);
        } else if (uw.status === 'new' && uw.nextReview === today) {
            // Новые слова текущего урока — P2
            if (recentSet.has(uw.enrolledFromLessonId)) {
                p2.push(task);
            } else {
                p1.push(task);
            }
        } else {
            p1.push(task);
        }
    });

    const sortFn = (a, b) => {
        const ua = userWords[a.wordId], ub = userWords[b.wordId];
        if (!ua || !ub) return 0;
        const nextA = a.direction === 'kz_to_ru' ? ua.nextReview : ua.ruNextReview;
        const nextB = b.direction === 'kz_to_ru' ? ub.nextReview : ub.ruNextReview;
        if (nextA < nextB) return -1;
        if (nextA > nextB) return 1;
        return (ub.totalIncorrect || 0) - (ua.totalIncorrect || 0);
    };

    p0.sort(sortFn);
    p1.sort(sortFn);
    p2.sort(sortFn);

    const queue = [...p0, ...p1, ...p2];
    return limit === Infinity ? queue : queue.slice(0, limit);
}

/**
 * Возвращает слова из WORDS, которых у пользователя ещё нет.
 * Сортировка: difficulty ASC.
 */
export function suggestExtraWords(count = 10) {
    return Object.values(WORDS)
        .filter(w => !userWords[w.id])
        .sort((a, b) => (a.difficulty ?? 1) - (b.difficulty ?? 1))
        .slice(0, count);
}
