// Глобальный словарь слов — единственный источник правды.
// IDs стабильны: после релиза их нельзя переименовывать,
// так как user_words.word_id на сервере ссылается на эти строки.

export const WORDS = {
    'greet_hello': {
        id: 'greet_hello',
        kz: 'Сәлем',
        ru: 'Привет',
        phonetic: '[sælem]',
        audioUrl: null,
        svgShape: 'wave',
        tags: ['greeting', 'basic'],
        difficulty: 1
    },
    'greet_sau_bol': {
        id: 'greet_sau_bol',
        kz: 'Сау бол',
        ru: 'Пока',
        phonetic: '[sau bol]',
        audioUrl: null,
        svgShape: 'wave',
        tags: ['greeting', 'basic'],
        difficulty: 1
    },
    'book_kitap': {
        id: 'book_kitap',
        kz: 'Кітап',
        ru: 'Книга',
        phonetic: '[kitap]',
        audioUrl: null,
        svgShape: 'book',
        tags: ['objects', 'school'],
        difficulty: 1
    },
    'water_su': {
        id: 'water_su',
        kz: 'Су',
        ru: 'Вода',
        phonetic: '[su]',
        audioUrl: null,
        svgShape: 'water',
        tags: ['food', 'basic'],
        difficulty: 1
    },
    'family_ana': {
        id: 'family_ana',
        kz: 'Ана',
        ru: 'Мама',
        ruAlt: ['Мать'],
        phonetic: '[ana]',
        audioUrl: null,
        svgShape: 'heart',
        tags: ['family', 'basic'],
        difficulty: 1
    },
    'family_ake': {
        id: 'family_ake',
        kz: 'Әке',
        ru: 'Папа',
        ruAlt: ['Отец'],
        phonetic: '[æke]',
        audioUrl: null,
        svgShape: 'shield',
        tags: ['family', 'basic'],
        difficulty: 1
    },
    'home_ui': {
        id: 'home_ui',
        kz: 'Үй',
        ru: 'Дом',
        phonetic: '[üi]',
        audioUrl: null,
        svgShape: 'house',
        tags: ['home', 'basic'],
        difficulty: 1
    },
    'friend_dos': {
        id: 'friend_dos',
        kz: 'Дос',
        ru: 'Друг',
        phonetic: '[dos]',
        audioUrl: null,
        svgShape: 'people',
        tags: ['social', 'basic'],
        difficulty: 2
    },
    'road_jol': {
        id: 'road_jol',
        kz: 'Жол',
        ru: 'Дорога',
        phonetic: '[jol]',
        audioUrl: null,
        svgShape: 'road',
        tags: ['transport', 'basic'],
        difficulty: 2
    },
    'day_kun': {
        id: 'day_kun',
        kz: 'Күн',
        ru: 'День',
        ruAlt: ['Солнце'],
        phonetic: '[kün]',
        audioUrl: null,
        svgShape: 'sun',
        tags: ['time', 'nature'],
        difficulty: 2
    },
    'language_til': {
        id: 'language_til',
        kz: 'Тіл',
        ru: 'Язык',
        phonetic: '[til]',
        audioUrl: null,
        svgShape: 'speech',
        tags: ['language', 'school'],
        difficulty: 2
    },
    'school_mektep': {
        id: 'school_mektep',
        kz: 'Мектеп',
        ru: 'Школа',
        phonetic: '[mektep]',
        audioUrl: null,
        svgShape: 'school',
        tags: ['school', 'places'],
        difficulty: 2
    },
    'student_okushy': {
        id: 'student_okushy',
        kz: 'Оқушы',
        ru: 'Ученик',
        phonetic: '[oqushy]',
        audioUrl: null,
        svgShape: 'person',
        tags: ['school', 'people'],
        difficulty: 2
    },
    'city_qala': {
        id: 'city_qala',
        kz: 'Қала',
        ru: 'Город',
        phonetic: '[qala]',
        audioUrl: null,
        svgShape: 'city',
        tags: ['places', 'basic'],
        difficulty: 3
    },
    'person_adam': {
        id: 'person_adam',
        kz: 'Адам',
        ru: 'Человек',
        phonetic: '[adam]',
        audioUrl: null,
        svgShape: 'person',
        tags: ['people', 'basic'],
        difficulty: 2
    },
    'child_bala': {
        id: 'child_bala',
        kz: 'Бала',
        ru: 'Ребёнок',
        phonetic: '[bala]',
        audioUrl: null,
        svgShape: 'child',
        tags: ['family', 'people'],
        difficulty: 1
    },
    'food_nan': {
        id: 'food_nan',
        kz: 'Нан',
        ru: 'Хлеб',
        phonetic: '[nan]',
        audioUrl: null,
        svgShape: 'book',
        tags: ['food', 'basic'],
        difficulty: 1
    },
    'food_sut': {
        id: 'food_sut',
        kz: 'Сүт',
        ru: 'Молоко',
        phonetic: '[süt]',
        audioUrl: null,
        svgShape: 'water',
        tags: ['food', 'basic'],
        difficulty: 1
    },

    // ===== Числа 1-10 (A1) =====
    'num_one':   { id: 'num_one',   kz: 'Бір',   ru: 'Один',   phonetic: '[bir]',    audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_two':   { id: 'num_two',   kz: 'Екі',   ru: 'Два',    phonetic: '[eki]',    audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_three': { id: 'num_three', kz: 'Үш',    ru: 'Три',    phonetic: '[üsh]',    audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_four':  { id: 'num_four',  kz: 'Төрт',  ru: 'Четыре', phonetic: '[tört]',   audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_five':  { id: 'num_five',  kz: 'Бес',   ru: 'Пять',   phonetic: '[bes]',    audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_six':   { id: 'num_six',   kz: 'Алты',  ru: 'Шесть',  phonetic: '[alty]',   audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_seven': { id: 'num_seven', kz: 'Жеті',  ru: 'Семь',   phonetic: '[jeti]',   audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_eight': { id: 'num_eight', kz: 'Сегіз', ru: 'Восемь', phonetic: '[segiz]',  audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_nine':  { id: 'num_nine',  kz: 'Тоғыз', ru: 'Девять', phonetic: '[toğyz]',  audioUrl: null, tags: ['numbers'], difficulty: 1 },
    'num_ten':   { id: 'num_ten',   kz: 'Он',    ru: 'Десять', phonetic: '[on]',     audioUrl: null, tags: ['numbers'], difficulty: 1 },

    // ===== Цвета (A1) =====
    'color_red':    { id: 'color_red',    kz: 'Қызыл',  ru: 'Красный', phonetic: '[qyzyl]',   audioUrl: null, tags: ['colors'], difficulty: 1 },
    'color_blue':   { id: 'color_blue',   kz: 'Көк',    ru: 'Синий',   phonetic: '[kök]',     audioUrl: null, tags: ['colors'], difficulty: 1 },
    'color_green':  { id: 'color_green',  kz: 'Жасыл',  ru: 'Зелёный', phonetic: '[jasyl]',   audioUrl: null, tags: ['colors'], difficulty: 1 },
    'color_white':  { id: 'color_white',  kz: 'Ақ',     ru: 'Белый',   phonetic: '[aq]',      audioUrl: null, tags: ['colors'], difficulty: 1 },
    'color_black':  { id: 'color_black',  kz: 'Қара',   ru: 'Чёрный',  phonetic: '[qara]',    audioUrl: null, tags: ['colors'], difficulty: 1 },
    'color_yellow': { id: 'color_yellow', kz: 'Сары',   ru: 'Жёлтый',  phonetic: '[sary]',    audioUrl: null, tags: ['colors'], difficulty: 1 },

    // ===== Части тела (A1) =====
    'body_head':  { id: 'body_head',  kz: 'Бас',    ru: 'Голова', phonetic: '[bas]',    audioUrl: null, tags: ['body'], difficulty: 1 },
    'body_eye':   { id: 'body_eye',   kz: 'Көз',    ru: 'Глаз',   phonetic: '[köz]',    audioUrl: null, tags: ['body'], difficulty: 1 },
    'body_hand':  { id: 'body_hand',  kz: 'Қол',    ru: 'Рука',   phonetic: '[qol]',    audioUrl: null, tags: ['body'], difficulty: 1 },
    'body_foot':  { id: 'body_foot',  kz: 'Аяқ',    ru: 'Нога',   phonetic: '[ayaq]',   audioUrl: null, tags: ['body'], difficulty: 1 },
    'body_heart': { id: 'body_heart', kz: 'Жүрек',  ru: 'Сердце', phonetic: '[jürek]',  audioUrl: null, tags: ['body'], difficulty: 2 },

    // ===== Время / дни (A1-A2) =====
    'time_today':    { id: 'time_today',    kz: 'Бүгін',  ru: 'Сегодня', phonetic: '[bügin]',   audioUrl: null, tags: ['time'], difficulty: 1 },
    'time_tomorrow': { id: 'time_tomorrow', kz: 'Ертең',  ru: 'Завтра',  phonetic: '[erteñ]',   audioUrl: null, tags: ['time'], difficulty: 2 },
    'time_morning':  { id: 'time_morning',  kz: 'Таң',    ru: 'Утро',    phonetic: '[tañ]',     audioUrl: null, tags: ['time'], difficulty: 2 },
    'time_night':    { id: 'time_night',    kz: 'Түн',    ru: 'Ночь',    phonetic: '[tün]',     audioUrl: null, tags: ['time'], difficulty: 1 },
    'time_year':     { id: 'time_year',     kz: 'Жыл',    ru: 'Год',     phonetic: '[jyl]',     audioUrl: null, tags: ['time'], difficulty: 1 },

    // ===== Базовые глаголы (A1-A2, инфинитив) =====
    'verb_to_do':     { id: 'verb_to_do',     kz: 'Жасау',  ru: 'Делать',    phonetic: '[jasau]',  audioUrl: null, tags: ['verbs'], difficulty: 2 },
    'verb_to_go':     { id: 'verb_to_go',     kz: 'Бару',   ru: 'Идти',      phonetic: '[baru]',   audioUrl: null, tags: ['verbs'], difficulty: 2 },
    'verb_to_eat':    { id: 'verb_to_eat',    kz: 'Жеу',    ru: 'Есть',      phonetic: '[jeu]',    audioUrl: null, tags: ['verbs'], difficulty: 2 },
    'verb_to_speak':  { id: 'verb_to_speak',  kz: 'Сөйлеу', ru: 'Говорить',  phonetic: '[söileu]', audioUrl: null, tags: ['verbs'], difficulty: 2 },
    'verb_to_read':   { id: 'verb_to_read',   kz: 'Оқу',    ru: 'Читать',    phonetic: '[oqu]',    audioUrl: null, tags: ['verbs'], difficulty: 2 }
};

export function getWord(id) {
    return WORDS[id] ?? null;
}

export function allWordIds() {
    return Object.keys(WORDS);
}

export function wordsByTag(tag) {
    return Object.values(WORDS).filter(w => w.tags?.includes(tag));
}

export function wordsByDifficulty(maxDiff) {
    return Object.values(WORDS).filter(w => (w.difficulty ?? 1) <= maxDiff);
}
