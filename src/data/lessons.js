// Данные уроков в стиле Duolingo.
// Источник вдохновения — школьные учебники казахского языка (A1).
// Каждый урок: набор шагов (steps) разных типов + wordIds для зачисления в SRS.
//
// Типы шагов:
//   theory  — карточка-объяснение (eyebrow, title, html)
//   choice  — выбор одного верного перевода (question, options, answer)
//   match   — соединить пары КЗ↔РУ (pairs:[{kz,ru}])
//   build   — собрать фразу из слов (ru — перевод, tokens — верный порядок, distractors — лишние)
//   words   — итоговый список новых слов (берётся из wordIds)
export const lessonsData = [
    {
        id: 'lesson_greeting',
        title: 'Сәлемдесу',
        subtitle: 'Приветствие',
        icon: '👋',
        wordIds: ['greet_hello', 'greet_salemetsiz', 'greet_sau_bol', 'greet_rahmet'],
        steps: [
            {
                type: 'theory',
                eyebrow: 'Жаңа сабақ · Приветствие',
                title: 'Как здороваться',
                html: 'В казахском языке есть простое и вежливое приветствие.<br><br>'
                    + '<b>Сәлем!</b> — Привет! <span class="t-soft">(другу, ровеснику)</span><br>'
                    + '<b>Сәлеметсіз бе?</b> — Здравствуйте! <span class="t-soft">(вежливо, на «вы»)</span><br>'
                    + '<b>Қайырлы таң!</b> — Доброе утро!<br>'
                    + '<b>Сау бол!</b> — Пока!<br>'
                    + '<b>Рахмет!</b> — Спасибо!'
            },
            { type: 'choice', eyebrow: 'Выберите перевод', question: '«Сәлем!» — это…', options: ['Привет!', 'Спасибо!', 'Пока!'], answer: 0 },
            { type: 'choice', eyebrow: 'Как сказать на казахском?', question: '«Спасибо»', options: ['Сау бол', 'Рахмет', 'Сәлем'], answer: 1 },
            {
                type: 'match',
                eyebrow: 'Соедините пары',
                prompt: 'Слово и его перевод',
                pairs: [
                    { kz: 'Сәлем', ru: 'Привет' },
                    { kz: 'Рахмет', ru: 'Спасибо' },
                    { kz: 'Сау бол', ru: 'Пока' },
                    { kz: 'Сәлеметсіз бе', ru: 'Здравствуйте' }
                ]
            },
            {
                type: 'build',
                eyebrow: 'Соберите фразу',
                prompt: 'Поздоровайтесь вежливо',
                ru: 'Здравствуйте!',
                tokens: ['Сәлеметсіз', 'бе'],
                distractors: ['Сәлем', 'Рахмет']
            },
            { type: 'words', eyebrow: 'Новые слова в копилку', title: 'Сәлемдесу' }
        ]
    },
    {
        id: 'lesson_family',
        title: 'Отбасы',
        subtitle: 'Семья',
        icon: '👪',
        wordIds: ['family_ake', 'family_ana', 'child_bala', 'family_aga', 'family_apke'],
        steps: [
            {
                type: 'theory',
                eyebrow: 'Жаңа сабақ · Семья',
                title: 'Члены семьи',
                html: '<b>Отбасы</b> — это семья.<br><br>'
                    + '<b>Әке</b> — папа<br>'
                    + '<b>Ана</b> — мама<br>'
                    + '<b>Аға</b> — старший брат<br>'
                    + '<b>Әпке</b> — старшая сестра<br>'
                    + '<b>Бала</b> — ребёнок'
            },
            { type: 'choice', eyebrow: 'Выберите перевод', question: '«Ана» — это…', options: ['Папа', 'Мама', 'Ребёнок'], answer: 1 },
            { type: 'choice', eyebrow: 'Как сказать на казахском?', question: '«Старший брат»', options: ['Әпке', 'Әке', 'Аға'], answer: 2 },
            {
                type: 'match',
                eyebrow: 'Соедините пары',
                prompt: 'Член семьи и перевод',
                pairs: [
                    { kz: 'Әке', ru: 'Папа' },
                    { kz: 'Ана', ru: 'Мама' },
                    { kz: 'Аға', ru: 'Старший брат' },
                    { kz: 'Бала', ru: 'Ребёнок' }
                ]
            },
            {
                type: 'build',
                eyebrow: 'Соберите фразу',
                prompt: 'Притяжание: «-м» в конце слова значит «мой»',
                ru: 'Это мой папа',
                tokens: ['Бұл', '—', 'менің', 'әкем'],
                distractors: ['анам', 'бала']
            },
            { type: 'words', eyebrow: 'Новые слова в копилку', title: 'Отбасы' }
        ]
    },
    {
        id: 'lesson_numbers',
        title: 'Сандар',
        subtitle: 'Числа 1–5',
        icon: '🔢',
        wordIds: ['num_one', 'num_two', 'num_three', 'num_four', 'num_five'],
        steps: [
            {
                type: 'theory',
                eyebrow: 'Жаңа сабақ · Числа',
                title: 'Считаем от 1 до 5',
                html: '<b>Бір</b> — 1<br>'
                    + '<b>Екі</b> — 2<br>'
                    + '<b>Үш</b> — 3<br>'
                    + '<b>Төрт</b> — 4<br>'
                    + '<b>Бес</b> — 5'
            },
            { type: 'choice', eyebrow: 'Выберите число', question: '«Үш» — это…', options: ['2', '3', '5'], answer: 1 },
            {
                type: 'match',
                eyebrow: 'Соедините пары',
                prompt: 'Число и цифра',
                pairs: [
                    { kz: 'Бір', ru: '1' },
                    { kz: 'Екі', ru: '2' },
                    { kz: 'Төрт', ru: '4' },
                    { kz: 'Бес', ru: '5' }
                ]
            },
            { type: 'choice', eyebrow: 'Как сказать на казахском?', question: '«Два»', options: ['Екі', 'Бес', 'Бір'], answer: 0 },
            {
                type: 'build',
                eyebrow: 'Соберите фразу',
                prompt: '«бар» значит «есть / имеется»',
                ru: 'У меня две книги',
                tokens: ['Менде', 'екі', 'кітап', 'бар'],
                distractors: ['бір', 'үй']
            },
            { type: 'words', eyebrow: 'Новые слова в копилку', title: 'Сандар' }
        ]
    },
    {
        id: 'lesson_colors',
        title: 'Түстер',
        subtitle: 'Цвета',
        icon: '🎨',
        wordIds: ['color_red', 'color_blue', 'color_green', 'color_white', 'color_black'],
        steps: [
            {
                type: 'theory',
                eyebrow: 'Жаңа сабақ · Цвета',
                title: 'Основные цвета',
                html: '<b>Қызыл</b> — красный<br>'
                    + '<b>Көк</b> — синий<br>'
                    + '<b>Жасыл</b> — зелёный<br>'
                    + '<b>Ақ</b> — белый<br>'
                    + '<b>Қара</b> — чёрный'
            },
            { type: 'choice', eyebrow: 'Выберите перевод', question: '«Қызыл» — это…', options: ['Синий', 'Красный', 'Чёрный'], answer: 1 },
            {
                type: 'match',
                eyebrow: 'Соедините пары',
                prompt: 'Цвет и перевод',
                pairs: [
                    { kz: 'Көк', ru: 'Синий' },
                    { kz: 'Жасыл', ru: 'Зелёный' },
                    { kz: 'Ақ', ru: 'Белый' },
                    { kz: 'Қара', ru: 'Чёрный' }
                ]
            },
            { type: 'choice', eyebrow: 'Как сказать на казахском?', question: '«Белый»', options: ['Қара', 'Ақ', 'Жасыл'], answer: 1 },
            {
                type: 'build',
                eyebrow: 'Соберите фразу',
                prompt: 'Прилагательное стоит перед существительным',
                ru: 'Красное яблоко',
                tokens: ['Қызыл', 'алма'],
                distractors: ['көк', 'қара']
            },
            { type: 'words', eyebrow: 'Новые слова в копилку', title: 'Түстер' }
        ]
    },
    {
        id: 'lesson_food',
        title: 'Тағам',
        subtitle: 'Еда',
        icon: '🍞',
        wordIds: ['food_nan', 'food_sut', 'water_su'],
        steps: [
            {
                type: 'theory',
                eyebrow: 'Жаңа сабақ · Еда',
                title: 'На столе',
                html: '<b>Нан</b> — хлеб<br>'
                    + '<b>Сүт</b> — молоко<br>'
                    + '<b>Су</b> — вода'
            },
            { type: 'choice', eyebrow: 'Выберите перевод', question: '«Нан» — это…', options: ['Вода', 'Хлеб', 'Молоко'], answer: 1 },
            { type: 'choice', eyebrow: 'Как сказать на казахском?', question: '«Молоко»', options: ['Сүт', 'Су', 'Нан'], answer: 0 },
            {
                type: 'match',
                eyebrow: 'Соедините пары',
                prompt: 'Продукт и перевод',
                pairs: [
                    { kz: 'Нан', ru: 'Хлеб' },
                    { kz: 'Сүт', ru: 'Молоко' },
                    { kz: 'Су', ru: 'Вода' }
                ]
            },
            {
                type: 'build',
                eyebrow: 'Соберите фразу',
                prompt: '«Бұл —» значит «Это —»',
                ru: 'Это хлеб',
                tokens: ['Бұл', '—', 'нан'],
                distractors: ['су', 'сүт']
            },
            { type: 'words', eyebrow: 'Новые слова в копилку', title: 'Тағам' }
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
