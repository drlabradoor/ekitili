// Вычисление статистики
import { lessonsProgress } from '../data/lessons.js';
import { userFlashcards } from '../data/flashcards.js';
import { getToday } from '../utils/date.js';

// Процент прохождения курса
export function getCourseProgressPercent() {
    const completed = lessonsProgress.filter(x => x === true).length;
    return Math.round((completed / lessonsProgress.length) * 100);
}

// Количество новых карточек
export function getNewFlashcardsCount() {
    return userFlashcards.filter(c => c.status === 'new').length;
}

// Количество повторенных сегодня карточек
export function getReviewedTodayCount() {
    const today = getToday();
    return userFlashcards.filter(c => {
        if (!c.lastReview) return false;
        const lastReview = new Date(c.lastReview);
        lastReview.setHours(0, 0, 0, 0);
        return lastReview >= today;
    }).length;
}

