// SRS state-machine (Anki-like).
// Чистые функции — нет сайд-эффектов, легко тестировать.
// Используется и на клиенте, и зеркально на сервере.

export const SRS_INTERVALS = [0, 1, 3, 7, 21]; // индексы 0..4 = уровни 1..5

function toDateStr(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDaysToDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toDateStr(d);
}

function todayStr() {
    return toDateStr(new Date());
}

function nextReviewForLevel(level, today) {
    const intervalDays = SRS_INTERVALS[Math.min(level, SRS_INTERVALS.length) - 1] ?? 21;
    return intervalDays === 0 ? today : addDaysToDate(today, intervalDays);
}

function levelToStatus(level) {
    if (level >= 5) return 'mastered';
    if (level > 1) return 'learning';
    return 'new';
}

/**
 * Применяет результат одного ревью к userWord.
 * Возвращает { newUserWord, creditsDailyGoal }.
 *
 * @param {object} opts
 * @param {object} opts.userWord     — текущее состояние UserWord
 * @param {'kz_to_ru'|'ru_to_kz'} opts.direction
 * @param {'exact'|'near'|'wrong'} opts.outcome
 * @param {number} opts.attemptNumber — 1 = первая попытка, 2+ = повторная ошибка
 * @param {string} [opts.today]      — YYYY-MM-DD (по умолчанию сегодня)
 */
export function applyReview({ userWord, direction, outcome, attemptNumber = 1, today = todayStr() }) {
    const uw = { ...userWord };
    const now = new Date().toISOString();
    let creditsDailyGoal = false;

    uw.totalReviews = (uw.totalReviews || 0) + 1;
    uw.lastReview = now;

    if (direction === 'kz_to_ru') {
        if (outcome === 'exact' || outcome === 'near') {
            if (outcome === 'exact') uw.totalCorrect = (uw.totalCorrect || 0) + 1;
            else uw.totalNear = (uw.totalNear || 0) + 1;

            uw.srsLevel = Math.min((uw.srsLevel || 1) + 1, 5);
            uw.nextReview = nextReviewForLevel(uw.srsLevel, today);
            uw.status = levelToStatus(uw.srsLevel);
            creditsDailyGoal = true;

            // Разблокировать обратное направление
            if (uw.srsLevel >= 4 && (uw.ruLevel ?? 0) === 0) {
                uw.ruLevel = 1;
                uw.ruNextReview = addDaysToDate(today, 1);
                uw.ruLastReview = null;
            }
        } else {
            // wrong
            uw.totalIncorrect = (uw.totalIncorrect || 0) + 1;
            if (attemptNumber <= 1) {
                // Первая ошибка: понижаем на 1
                uw.srsLevel = Math.max(1, (uw.srsLevel || 1) - 1);
            } else {
                // Вторая+ ошибка: полный сброс
                uw.srsLevel = 1;
            }
            uw.nextReview = today;
            uw.status = 'learning';
        }
    } else {
        // ru_to_kz
        if (outcome === 'exact' || outcome === 'near') {
            if (outcome === 'exact') uw.totalCorrect = (uw.totalCorrect || 0) + 1;
            else uw.totalNear = (uw.totalNear || 0) + 1;

            uw.ruLevel = Math.min((uw.ruLevel || 1) + 1, 5);
            uw.ruNextReview = nextReviewForLevel(uw.ruLevel, today);
            uw.ruLastReview = now;
            creditsDailyGoal = true;
        } else {
            uw.totalIncorrect = (uw.totalIncorrect || 0) + 1;
            if (attemptNumber <= 1) {
                uw.ruLevel = Math.max(1, (uw.ruLevel || 1) - 1);
            } else {
                uw.ruLevel = 1;
            }
            uw.ruNextReview = today;
            uw.ruLastReview = now;
        }
    }

    uw.updatedAt = now;
    return { newUserWord: uw, creditsDailyGoal };
}

/**
 * Создаёт новую UserWord запись (для enrollWord).
 */
export function createUserWord({ wordId, fromLessonId = null, today = todayStr() }) {
    const now = new Date().toISOString();
    return {
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
}

/**
 * Возвращает список «заданий» для сессии сегодня:
 * { wordId, direction } пары.
 *
 * @param {object} userWords  — Map<wordId, UserWord>
 * @param {string} [today]
 * @returns {{ wordId: string, direction: 'kz_to_ru'|'ru_to_kz' }[]}
 */
export function getDueTasks(userWords, today = todayStr()) {
    const tasks = [];
    Object.values(userWords).forEach(uw => {
        if (!uw || !uw.wordId) return;

        // kz→ru: всегда добавляем если просроченная
        if (uw.nextReview && uw.nextReview <= today && uw.status !== 'mastered') {
            tasks.push({ wordId: uw.wordId, direction: 'kz_to_ru' });
        }

        // ru→kz: только если разблокирована (ruLevel >= 1) и просрочена
        if ((uw.ruLevel ?? 0) >= 1 && uw.ruNextReview && uw.ruNextReview <= today) {
            tasks.push({ wordId: uw.wordId, direction: 'ru_to_kz' });
        }
    });
    return tasks;
}
