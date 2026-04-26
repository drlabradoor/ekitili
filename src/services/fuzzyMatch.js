// Нормализация + Левенштейн + адаптивная толерантность для проверки ответов.

// Таблица folding казахских кириллических букв к их визуально-близким эквивалентам.
// NFKD не декомпозирует Ә, Қ, Ң и т.д. — они атомарные Unicode кодпойнты.
// Смысл: если пользователь написал «Салем» вместо «Сәлем» — это exact-match.
const KZ_FOLD = new Map([
    ['ә', 'а'], ['Ә', 'А'],
    ['ғ', 'г'], ['Ғ', 'Г'],
    ['қ', 'к'], ['Қ', 'К'],
    ['ң', 'н'], ['Ң', 'Н'],
    ['ө', 'о'], ['Ө', 'О'],
    ['ұ', 'у'], ['Ұ', 'У'],
    ['ү', 'у'], ['Ү', 'У'],
    ['һ', 'х'], ['Һ', 'Х'],
    ['і', 'и'], ['І', 'И'],
]);

/**
 * Нормализует строку для fuzzy-сравнения:
 *   1) Fold казахских букв (Ә→А, Қ→К, ...)
 *   2) NFKD + удаление combining marks (для латинских диакритик)
 *   3) toLocaleLowerCase('kk-KZ')
 *   4) Схлопывание пробелов + trim
 */
export function normalize(str) {
    if (typeof str !== 'string') return '';
    const folded = Array.from(str, ch => KZ_FOLD.get(ch) ?? ch).join('');
    return folded
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('kk-KZ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Классический DP Левенштейн.
 * Ограничен 60 символами — достаточно для слов и коротких фраз.
 */
export function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length > 60 || b.length > 60) return Infinity;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

/**
 * Вычисляет максимально допустимое расстояние Левенштейна.
 * tolerance: -1 (строгий) | 0 (стандартный) | 1 (мягкий)
 */
function computeThreshold(maxLen, tolerance) {
    let base = maxLen <= 4 ? 0 : maxLen <= 8 ? 1 : 2;
    const adj = tolerance === -1 ? -1 : tolerance === 1 ? 1 : 0;
    return Math.max(0, base + adj);
}

/**
 * Сравнивает ответ пользователя с правильным вариантом (и альтернативами).
 *
 * @param {string} userInput
 * @param {string} expected   — основной правильный ответ
 * @param {string[]} alts     — необязательные альтернативы (синонимы)
 * @param {number} tolerance  — -1 | 0 | 1
 * @returns {'exact' | 'near' | 'wrong'}
 */
export function classifyAnswer(userInput, expected, alts = [], tolerance = 0) {
    const userNorm = normalize(userInput);

    const candidates = [expected, ...alts].map(c => normalize(c));

    let bestResult = 'wrong';

    for (const cand of candidates) {
        if (userNorm === cand) return 'exact';  // точное совпадение

        const d = levenshtein(userNorm, cand);
        const maxLen = Math.max(userNorm.length, cand.length);
        const threshold = computeThreshold(maxLen, tolerance);

        if (d <= threshold) {
            bestResult = 'near';  // найдено «почти» — продолжаем искать exact
        }
    }

    return bestResult;
}

// =====================================================
// Adaptive tolerance
// =====================================================

const WINDOW = 30;
const MIN_SAMPLES = 15;
const TIGHTEN_NEAR_RATIO = 0.30;
const LOOSEN_NEAR_RATIO  = 0.08;

const STATS_KEY = 'ekitili_fuzzy_stats_v1';

export function loadFuzzyStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        return raw ? JSON.parse(raw) : { tolerance: 0, window: [] };
    } catch {
        return { tolerance: 0, window: [] };
    }
}

function saveFuzzyStats(stats) {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
}

/**
 * Обновляет rolling window после каждого ревью и пересчитывает tolerance.
 * @param {'exact'|'near'|'wrong'} outcome
 * @returns {{ tolerance: number, window: string[] }}
 */
export function recalcTolerance(outcome) {
    const stats = loadFuzzyStats();
    const window = [...stats.window, outcome].slice(-WINDOW);

    let tolerance = 0;
    if (window.length >= MIN_SAMPLES) {
        const nearRatio = window.filter(o => o === 'near').length / window.length;
        if (nearRatio >= TIGHTEN_NEAR_RATIO) tolerance = -1;
        else if (nearRatio <= LOOSEN_NEAR_RATIO) tolerance = 1;
    }

    const newStats = { tolerance, window };
    saveFuzzyStats(newStats);
    return newStats;
}

export function getCurrentTolerance() {
    return loadFuzzyStats().tolerance;
}

export function clearFuzzyStats() {
    try { localStorage.removeItem(STATS_KEY); } catch {}
}
