// Данные уроков — каждый урок ссылается на wordIds из src/data/words.js
export const lessonsData = [
    {
        id: 'lesson_greeting',
        title: 'Приветствие',
        theory: 'В этом уроке вы узнаете, как здороваться и прощаться на казахском языке.\n\n<b>Сәлем!</b> — Привет!<br><b>Сау бол!</b> — Пока!<br><b>Қайырлы таң!</b> — Доброе утро!<br><b>Қайырлы кеш!</b> — Добрый вечер!',
        wordIds: ['greet_hello', 'greet_sau_bol'],
        tasks: [
            { type: 'choice', question: 'Как будет "Привет!"', options: ['Сәлем!', 'Сау бол!', 'Рахмет!'], answer: 0 },
            { type: 'choice', question: 'Как сказать "Пока!"?', options: ['Сәлем!', 'Сау бол!', 'Кеш жарық!'], answer: 1 }
        ]
    },
    {
        id: 'lesson_family',
        title: 'Семья',
        theory: 'Слова для членов семьи на казахском языке:<br><b>Әке</b> — Отец<br><b>Ана</b> — Мать<br><b>Бала</b> — Ребёнок',
        wordIds: ['family_ake', 'family_ana', 'child_bala'],
        tasks: [
            { type: 'choice', question: 'Как будет "Отец"?', options: ['Ана', 'Әке', 'Бала'], answer: 1 },
            { type: 'choice', question: 'Как будет "Мать"?', options: ['Әке', 'Ана', 'Аға'], answer: 1 }
        ]
    },
    {
        id: 'lesson_food',
        title: 'Еда',
        theory: 'Основные слова по теме "Еда":<br><b>Нан</b> — Хлеб<br><b>Сүт</b> — Молоко<br><b>Су</b> — Вода',
        wordIds: ['food_nan', 'food_sut', 'water_su'],
        tasks: [
            { type: 'choice', question: 'Как будет "Хлеб"?', options: ['Су', 'Нан', 'Сүт'], answer: 1 },
            { type: 'choice', question: 'Как будет "Молоко"?', options: ['Сүт', 'Нан', 'Су'], answer: 0 }
        ]
    }
];

// Прогресс уроков
export let lessonsProgress = Array(lessonsData.length).fill(false);
lessonsProgress[0] = null; // первый урок активен по умолчанию

// Хранилище дат завершения для приоритизации SRS
const COMPLETED_KEY = 'ekitili_lessons_completed_v1';

export function loadLessonsCompleted() {
    try {
        const raw = localStorage.getItem(COMPLETED_KEY);
        const completed = raw ? JSON.parse(raw) : {};
        lessonsData.forEach((lesson, idx) => {
            if (completed[lesson.id]) lessonsProgress[idx] = true;
        });
        if (lessonsProgress.every(p => p === false)) lessonsProgress[0] = null;
    } catch {}
}

export function markLessonCompleted(lessonId) {
    try {
        const raw = localStorage.getItem(COMPLETED_KEY);
        const completed = raw ? JSON.parse(raw) : {};
        completed[lessonId] = new Date().toISOString();
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
    } catch {}
}

export function clearLessonsCompleted() {
    try { localStorage.removeItem(COMPLETED_KEY); } catch {}
    for (let i = 0; i < lessonsProgress.length; i++) lessonsProgress[i] = false;
    lessonsProgress[0] = null;
}

export function getRecentLessonIds(count = 3) {
    try {
        const raw = localStorage.getItem(COMPLETED_KEY);
        if (!raw) return [];
        const completed = JSON.parse(raw);
        return Object.entries(completed)
            .sort((a, b) => b[1].localeCompare(a[1]))
            .slice(0, count)
            .map(([id]) => id);
    } catch {
        return [];
    }
}
