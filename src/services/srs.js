// Логика SRS (Spaced Repetition System)
import { SRS_INTERVALS } from '../config/constants.js';
import { userFlashcards } from '../data/flashcards.js';
import { getToday, isDateBeforeOrEqual, addDays } from '../utils/date.js';

// Получение карточек на сегодня
export function getDueFlashcards() {
    const today = getToday();
    return userFlashcards.filter(card => {
        if (!card.nextReview) return false;
        const reviewDate = new Date(card.nextReview);
        reviewDate.setHours(0, 0, 0, 0);
        return isDateBeforeOrEqual(reviewDate, today);
    });
}

// Обновление уровня SRS при правильном ответе
export function updateCardSRSOnCorrect(card) {
    card.stats.correct++;
    card.srsLevel = Math.min(card.srsLevel + 1, SRS_INTERVALS.length);
    card.nextReview = calculateNextReview(card.srsLevel);
    card.lastReview = new Date();
    card.status = card.srsLevel >= SRS_INTERVALS.length ? 'reviewed' : 'learning';
}

// Обновление уровня SRS при неправильном ответе
export function updateCardSRSOnIncorrect(card) {
    card.stats.incorrect++;
    card.srsLevel = 1;
    card.nextReview = new Date(getToday());
    card.lastReview = new Date();
    card.status = 'learning';
}

// Расчет следующего повторения
export function calculateNextReview(srsLevel) {
    const nextDays = SRS_INTERVALS[srsLevel - 1] || 21;
    return addDays(new Date(), nextDays);
}

