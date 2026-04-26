// Вычисление статистики
import { lessonsProgress } from '../data/lessons.js';
import { userWords } from '../data/userWords.js';

export function getCourseProgressPercent() {
    const completed = lessonsProgress.filter(x => x === true).length;
    return Math.round((completed / lessonsProgress.length) * 100);
}

export function getNewFlashcardsCount() {
    return Object.values(userWords).filter(uw => uw.status === 'new').length;
}

export function getReviewedTodayCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Object.values(userWords).filter(uw => {
        if (!uw.lastReview) return false;
        return new Date(uw.lastReview) >= today;
    }).length;
}
