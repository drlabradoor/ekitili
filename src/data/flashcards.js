// Данные карточек
export const flashcardsData = {
    food: [
        { front: 'bread', back: 'хлеб', phonetic: '[брэд]', stats: { correct: 0, incorrect: 0 } },
        { front: 'milk', back: 'молоко', phonetic: '[милк]', stats: { correct: 0, incorrect: 0 } },
        { front: 'apple', back: 'яблоко', phonetic: '[эпл]', stats: { correct: 0, incorrect: 0 } },
        { front: 'orange', back: 'апельсин', phonetic: '[орандж]', stats: { correct: 0, incorrect: 0 } }
    ],
    transport: [
        { front: 'bus', back: 'автобус', phonetic: '[бас]', stats: { correct: 0, incorrect: 0 } },
        { front: 'car', back: 'машина', phonetic: '[кар]', stats: { correct: 0, incorrect: 0 } }
    ],
    work: [
        { front: 'office', back: 'офис', phonetic: '[офис]', stats: { correct: 0, incorrect: 0 } },
        { front: 'job', back: 'работа', phonetic: '[джоб]', stats: { correct: 0, incorrect: 0 } }
    ]
};

// Переменные для карточек
export let currentCategory = 'food';
export let currentIndex = 0;
export let isFlipped = false;
export let srsQueue = [];

// База карточек пользователя
export let userFlashcards = [
    { front: 'Сәлем', back: 'Привет', phonetic: '[sælem]', svgShape: 'wave', srsLevel: 1, status: 'new', stats: { correct: 0, incorrect: 0 } },
    { front: 'Кітап', back: 'Книга', phonetic: '[kitap]', svgShape: 'book', srsLevel: 1, status: 'new', stats: { correct: 0, incorrect: 0 } },
    { front: 'Су', back: 'Вода', phonetic: '[su]', svgShape: 'water', srsLevel: 1, status: 'new', stats: { correct: 0, incorrect: 0 } },
    { front: 'Ана', back: 'Мама', phonetic: '[ana]', svgShape: 'heart', srsLevel: 2, status: 'learning', stats: { correct: 1, incorrect: 0 } },
    { front: 'Әке', back: 'Папа', phonetic: '[äke]', svgShape: 'shield', srsLevel: 2, status: 'learning', stats: { correct: 1, incorrect: 0 } },
    { front: 'Үй', back: 'Дом', phonetic: '[üi]', svgShape: 'house', srsLevel: 2, status: 'learning', stats: { correct: 1, incorrect: 0 } },
    { front: 'Дос', back: 'Друг', phonetic: '[dos]', svgShape: 'people', srsLevel: 3, status: 'learning', stats: { correct: 2, incorrect: 0 } },
    { front: 'Жол', back: 'Дорога', phonetic: '[jol]', svgShape: 'road', srsLevel: 3, status: 'learning', stats: { correct: 2, incorrect: 0 } },
    { front: 'Күн', back: 'День', phonetic: '[kün]', svgShape: 'sun', srsLevel: 3, status: 'learning', stats: { correct: 2, incorrect: 0 } },
    { front: 'Тіл', back: 'Язык', phonetic: '[til]', svgShape: 'speech', srsLevel: 4, status: 'learning', stats: { correct: 3, incorrect: 0 } },
    { front: 'Мектеп', back: 'Школа', phonetic: '[mektep]', svgShape: 'school', srsLevel: 4, status: 'learning', stats: { correct: 3, incorrect: 0 } },
    { front: 'Оқушы', back: 'Ученик', phonetic: '[oqūshy]', svgShape: 'person', srsLevel: 4, status: 'learning', stats: { correct: 3, incorrect: 0 } },
    { front: 'Қала', back: 'Город', phonetic: '[qala]', svgShape: 'city', srsLevel: 5, status: 'reviewed', stats: { correct: 4, incorrect: 0 } },
    { front: 'Адам', back: 'Человек', phonetic: '[adam]', svgShape: 'person', srsLevel: 5, status: 'reviewed', stats: { correct: 4, incorrect: 0 } },
    { front: 'Бала', back: 'Ребёнок', phonetic: '[bala]', svgShape: 'child', srsLevel: 5, status: 'reviewed', stats: { correct: 4, incorrect: 0 } },
];

// Инициализация nextReview для новых карточек (вызывается из main.js)
export function initializeFlashcards() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    userFlashcards.forEach(card => {
        if (card.srsLevel === 1 || card.status === 'new') {
            if (!card.nextReview) {
                card.nextReview = new Date(today);
            }
        }
    });
    
    // При загрузке страницы сбрасываем сегодняшние карточки (srsLevel=1)
    userFlashcards.forEach(card => {
        if (card.srsLevel === 1) card.status = 'new';
    });
}

