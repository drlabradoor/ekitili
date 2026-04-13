// Ударный режим (streak): учёт ежедневной активности пользователя.
// Кешируется в localStorage, синхронизируется с сервером (Supabase jsonb)
// при каждой учебной активности. Вехи 3/7/30 дней дают достижения.
import { addDays } from '../utils/date.js';
import { getCurrentUser, getApiBaseUrl } from './auth.js';
import { unlockAchievement } from './achievements.js';

const STORAGE_KEY = 'ekitili_streak_v1';
const HISTORY_DAYS_KEPT = 90;

// Пороги → соответствующие достижения (см. REQUIRED_ACHIEVEMENTS)
const MILESTONE_ACHIEVEMENTS = {
    3: 'streak_3',
    7: 'streak_7',
    30: 'streak_30'
};

export const STREAK_UPDATED_EVENT = 'streak-updated';

/**
 * @returns {string} локальная дата в формате YYYY-MM-DD
 */
function toDateStr(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function todayStr() {
    return toDateStr(new Date());
}

function yesterdayStr() {
    return toDateStr(addDays(new Date(), -1));
}

function createEmpty() {
    return {
        current: 0,
        longest: 0,
        lastActive: null,
        history: {}
    };
}

function loadRaw() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmpty();
        const parsed = JSON.parse(raw);
        return {
            current: parsed.current || 0,
            longest: parsed.longest || 0,
            lastActive: parsed.lastActive || null,
            history: parsed.history || {}
        };
    } catch (e) {
        console.error('Ошибка загрузки стрика:', e);
        return createEmpty();
    }
}

function pruneHistory(history) {
    const cutoff = toDateStr(addDays(new Date(), -HISTORY_DAYS_KEPT));
    const pruned = {};
    for (const [date, count] of Object.entries(history)) {
        if (date >= cutoff) pruned[date] = count;
    }
    return pruned;
}

function save(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Ошибка сохранения стрика:', e);
    }
}

/**
 * Эффективное значение стрика: если пользователь не занимался
 * сегодня или вчера, стрик считается прерванным.
 */
function effectiveCurrent(data) {
    if (!data.lastActive) return 0;
    const today = todayStr();
    const yesterday = yesterdayStr();
    if (data.lastActive === today || data.lastActive === yesterday) {
        return data.current;
    }
    return 0;
}

/**
 * Зарегистрировать учебную активность. Увеличивает счётчик
 * сегодняшнего дня и обновляет текущий стрик по правилам:
 *   - уже занимался сегодня → только инкремент счётчика
 *   - последний раз был вчера → +1 к стрику
 *   - был раньше или впервые → стрик = 1
 * Диспатчит событие STREAK_UPDATED_EVENT, синкает на сервер,
 * разблокирует достижение при вехе (3/7/30 дней).
 * @returns {{ current: number, longest: number, milestoneHit: number | null, startedToday: boolean }}
 */
export function recordActivity() {
    const data = loadRaw();
    const today = todayStr();
    const yesterday = yesterdayStr();

    const alreadyToday = data.lastActive === today;
    data.history[today] = (data.history[today] || 0) + 1;

    let milestoneHit = null;
    let startedToday = false;

    if (!alreadyToday) {
        startedToday = true;
        if (data.lastActive === yesterday) {
            data.current = (data.current || 0) + 1;
        } else {
            data.current = 1;
        }
        data.lastActive = today;
        if (data.current > data.longest) {
            data.longest = data.current;
        }
        if (MILESTONE_ACHIEVEMENTS[data.current]) {
            milestoneHit = data.current;
        }
    }

    data.history = pruneHistory(data.history);
    save(data);

    document.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT, {
        detail: { current: data.current, longest: data.longest, milestoneHit, startedToday }
    }));

    // Вехи → достижения. Само уведомление показывается из achievements.js
    if (milestoneHit) {
        const achievementId = MILESTONE_ACHIEVEMENTS[milestoneHit];
        if (achievementId) {
            unlockAchievement(achievementId);
        }
    }

    // Фоновая синхронизация с сервером (fire-and-forget)
    syncStreakToServer(data);

    return { current: data.current, longest: data.longest, milestoneHit, startedToday };
}

/**
 * Получить актуальные данные о стрике для отображения.
 * Эффективный `current` учитывает разрыв стрика.
 */
export function getStreakData() {
    const data = loadRaw();
    const current = effectiveCurrent(data);
    const today = todayStr();
    const completedToday = data.lastActive === today;

    // Активность за последние 7 дней, от 6 дней назад до сегодня
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = toDateStr(addDays(new Date(), -i));
        last7Days.push({
            date,
            count: data.history[date] || 0,
            isToday: i === 0
        });
    }

    return {
        current,
        longest: data.longest || 0,
        completedToday,
        last7Days
    };
}

/**
 * Сброс стрика (при выходе из аккаунта).
 */
export function resetStreakData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Ошибка сброса стрика:', e);
    }
    document.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT, {
        detail: { current: 0, longest: 0, milestoneHit: null, startedToday: false }
    }));
}

/**
 * Push local streak blob to the server. Silent on failure —
 * localStorage остаётся источником правды оффлайн.
 */
async function syncStreakToServer(data) {
    const user = getCurrentUser();
    if (!user || !user.userId) return;

    try {
        await fetch(`${getApiBaseUrl()}/user/streak`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streak: data })
        });
    } catch (error) {
        console.error('Ошибка синхронизации стрика:', error);
    }
}

/**
 * Слить серверный стрик с локальным: берём максимумы по current/longest,
 * объединяем history, берём более позднюю lastActive. Вызывается при
 * загрузке профиля, чтобы подтянуть прогресс с другого устройства.
 */
export async function loadStreakFromServer() {
    const user = getCurrentUser();
    if (!user || !user.userId) return;

    try {
        const response = await fetch(`${getApiBaseUrl()}/user/streak`, { credentials: 'include' });
        if (!response.ok) return;
        const payload = await response.json();
        const serverStreak = payload && payload.streak ? payload.streak : null;
        if (!serverStreak || typeof serverStreak !== 'object') return;

        const local = loadRaw();
        const merged = mergeStreaks(local, serverStreak);
        save(merged);

        // Если локальная версия содержала больше данных — докатываем на сервер
        const localHasMoreHistory = Object.keys(local.history || {}).length >
                                    Object.keys(serverStreak.history || {}).length;
        const localMoreRecent = local.lastActive && (!serverStreak.lastActive ||
                                local.lastActive > serverStreak.lastActive);
        if (localHasMoreHistory || localMoreRecent) {
            syncStreakToServer(merged);
        }

        document.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT, {
            detail: { current: merged.current, longest: merged.longest, milestoneHit: null, startedToday: false }
        }));
    } catch (error) {
        console.error('Ошибка загрузки стрика с сервера:', error);
    }
}

function mergeStreaks(a, b) {
    const safe = (x) => ({
        current: x && typeof x.current === 'number' ? x.current : 0,
        longest: x && typeof x.longest === 'number' ? x.longest : 0,
        lastActive: x && typeof x.lastActive === 'string' ? x.lastActive : null,
        history: x && x.history && typeof x.history === 'object' ? x.history : {}
    });
    const sa = safe(a);
    const sb = safe(b);

    const lastActive = (sa.lastActive && sb.lastActive)
        ? (sa.lastActive > sb.lastActive ? sa.lastActive : sb.lastActive)
        : (sa.lastActive || sb.lastActive);

    // current берём из записи с более свежей lastActive (иначе стрик может
    // "ожить" из устаревших данных)
    const current = (lastActive === sa.lastActive) ? sa.current : sb.current;

    const mergedHistory = { ...sb.history };
    for (const [date, count] of Object.entries(sa.history)) {
        mergedHistory[date] = Math.max(mergedHistory[date] || 0, count);
    }

    return {
        current,
        longest: Math.max(sa.longest, sb.longest),
        lastActive,
        history: pruneHistory(mergedHistory)
    };
}
