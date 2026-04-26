// Backward-compat shim: игры (battle, training, memory) продолжают
// использовать `userFlashcards` как массив с полями front/back/srsLevel.
// Данные берутся из нового userWords + WORDS.

import { userWords } from './userWords.js';
import { getWord } from './words.js';

export let userFlashcards = [];

export function syncFlashcardsShim() {
    const cards = Object.values(userWords).map(uw => {
        const word = getWord(uw.wordId);
        if (!word) return null;
        return {
            front: word.kz,
            back: word.ru,
            phonetic: word.phonetic,
            svgShape: word.svgShape,
            srsLevel: uw.srsLevel,
            status: uw.status,
            nextReview: uw.nextReview,
            lastReview: uw.lastReview,
            stats: { correct: uw.totalCorrect, incorrect: uw.totalIncorrect },
            _wordId: uw.wordId
        };
    }).filter(Boolean);
    userFlashcards.splice(0, userFlashcards.length, ...cards);
}

// Для обратной совместимости с кодом, который вызывает initializeFlashcards()
export function initializeFlashcards() {
    syncFlashcardsShim();
}

// Устаревшая seed-база (оставлена для совместимости импортов в memory.js)
export const flashcardsData = { food: [], transport: [], work: [] };
