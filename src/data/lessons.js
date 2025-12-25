// Данные уроков
export const lessonsData = [
    {
        title: 'Приветствие',
        theory: 'В этом уроке вы узнаете, как здороваться и прощаться на казахском языке.\n\n<b>Сәлем!</b> — Привет!<br><b>Сау бол!</b> — Пока!<br><b>Қайырлы таң!</b> — Доброе утро!<br><b>Қайырлы кеш!</b> — Добрый вечер!',
        tasks: [
            { type: 'choice', question: 'Как будет "Привет!"', options: ['Сәлем!', 'Сау бол!', 'Рахмет!'], answer: 0 },
            { type: 'choice', question: 'Как сказать "Пока!"?', options: ['Сәлем!', 'Сау бол!', 'Кеш жарық!'], answer: 1 }
        ]
    },
    {
        title: 'Семья',
        theory: 'Слова для членов семьи на казахском языке:<br><b>Әке</b> — Отец<br><b>Ана</b> — Мать<br><b>Бала</b> — Ребёнок',
        tasks: [
            { type: 'choice', question: 'Как будет "Отец"?', options: ['Ана', 'Әке', 'Бала'], answer: 1 },
            { type: 'choice', question: 'Как будет "Мать"?', options: ['Әке', 'Ана', 'Аға'], answer: 1 }
        ]
    },
    {
        title: 'Еда',
        theory: 'Основные слова по теме "Еда":<br><b>Нан</b> — Хлеб<br><b>Сүт</b> — Молоко<br><b>Су</b> — Вода',
        tasks: [
            { type: 'choice', question: 'Как будет "Хлеб"?', options: ['Су', 'Нан', 'Сүт'], answer: 1 },
            { type: 'choice', question: 'Как будет "Молоко"?', options: ['Сүт', 'Нан', 'Су'], answer: 0 }
        ]
    }
];

// Прогресс уроков
export let lessonsProgress = Array(lessonsData.length).fill(false);
lessonsProgress[0] = null; // первый урок активен по умолчанию

