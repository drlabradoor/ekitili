// Основная логика уроков — пошаговый движок в стиле Duolingo.
// Урок = массив шагов (steps) из src/data/lessons.js. Типы:
//   theory · choice · match · build · words
// Поток: показываем шаг → пользователь отвечает → «Проверить» → фидбэк → «Продолжить».
import { lessonsData, lessonsProgress, markLessonCompleted, getRecentLessonIds } from '../../data/lessons.js';
import { enrollWords } from '../../data/userWords.js';
import { syncFlashcardsShim } from '../../data/flashcards.js';
import { setRecentLessonIds } from '../flashcards/flashcards.js';
import { renderLessonsPath } from './lessonRenderer.js';
import { renderStats } from '../profile/profileRenderer.js';
import { recordActivity } from '../../services/streak.js';
import { postEnroll } from '../../services/srsSync.js';
import { getWord } from '../../data/words.js';

const HEARTS_FULL = 5;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// --- Состояние текущего прохождения ---
let lessonIdx = 0;
let steps = [];
let stepNo = 0;
let hearts = HEARTS_FULL;
let validated = false;     // нажата ли «Проверить» на текущем шаге
let checkFn = null;        // () => boolean — проверка ответа для шагов с needsCheck

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// --- Точка входа: открыть урок ---
export function showLesson(idx) {
    lessonIdx = idx;
    const lesson = lessonsData[idx];
    if (!lesson) return;

    steps = Array.isArray(lesson.steps) ? lesson.steps : [];
    if (steps.length === 0) return;

    stepNo = 0;
    hearts = HEARTS_FULL;

    const lessonPage = document.querySelector('#tab-lessons .lesson-page');
    if (!lessonPage) return;

    lessonPage.innerHTML = `
        <div class="lesson-screen">
            <div class="lesson-topbar">
                <button type="button" class="lesson-close" aria-label="Закрыть">✕</button>
                <div class="lesson-progress-track">
                    <div class="lesson-progress-fill"></div>
                </div>
                <div class="lesson-hearts">
                    <span class="lesson-hearts-icon" aria-hidden="true">❤️</span>
                    <span class="lesson-hearts-count">${HEARTS_FULL}</span>
                </div>
            </div>
            <div class="lesson-body"></div>
            <div class="lesson-bottom">
                <div class="lesson-solution" hidden></div>
                <button type="button" class="lesson-action-btn btn-chunk" disabled>Далее</button>
            </div>
        </div>
    `;

    // Полноэкранный режим поверх «пути батыра».
    Object.assign(lessonPage.style, {
        position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
        width: '100vw', height: '100vh', background: 'var(--page)',
        zIndex: '1000', overflow: 'hidden', display: 'block',
        margin: '0', padding: '0', borderRadius: '0', boxShadow: 'none'
    });

    lessonPage.querySelector('.lesson-close').addEventListener('click', closeLessonPage);
    lessonPage.querySelector('.lesson-action-btn').addEventListener('click', onAction);

    document.body.classList.add('lesson-open');
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (lessonsPath) lessonsPath.style.display = 'none';

    renderStep();
}

// --- Доступ к элементам экрана ---
function els() {
    const page = document.querySelector('#tab-lessons .lesson-page');
    if (!page) return null;
    return {
        page,
        screen: page.querySelector('.lesson-screen'),
        body: page.querySelector('.lesson-body'),
        action: page.querySelector('.lesson-action-btn'),
        fill: page.querySelector('.lesson-progress-fill'),
        hearts: page.querySelector('.lesson-hearts-count'),
        solution: page.querySelector('.lesson-solution')
    };
}

function setAction(label, enabled, variant) {
    const e = els();
    if (!e) return;
    e.action.textContent = label;
    e.action.disabled = !enabled;
    e.action.className = 'lesson-action-btn btn-chunk' + (variant ? ' ' + variant : '');
}

function updateHearts() {
    const e = els();
    if (!e) return;
    e.hearts.textContent = hearts;
    e.hearts.parentElement.classList.toggle('is-low', hearts <= 1);
}

function isLastStep() {
    return stepNo === steps.length - 1;
}

// --- Рендер текущего шага ---
function renderStep() {
    const e = els();
    if (!e) return;
    const step = steps[stepNo];

    validated = false;
    checkFn = null;
    step.__needsCheck = false;

    e.screen.classList.remove('feedback-ok', 'feedback-bad');
    e.solution.hidden = true;
    e.solution.innerHTML = '';
    e.fill.style.width = `${(stepNo / steps.length) * 100}%`;
    updateHearts();

    switch (step.type) {
        case 'theory': return renderTheory(step, e);
        case 'choice': return renderChoice(step, e);
        case 'match':  return renderMatch(step, e);
        case 'build':  return renderBuild(step, e);
        case 'words':  return renderWords(step, e);
        default:       return advance();
    }
}

function promptHtml(eyebrow, title) {
    return `
        <div class="lesson-prompt">
            <div class="h-ornament">${escapeHtml(eyebrow || '')}</div>
            <div class="lesson-prompt-title h-display">${escapeHtml(title || '')}</div>
        </div>`;
}

// ---------- Теория ----------
function renderTheory(step, e) {
    e.body.innerHTML = promptHtml(step.eyebrow, step.title)
        + `<div class="lesson-theory sticker">${step.html || ''}</div>`;
    setAction(isLastStep() ? 'Завершить' : 'Продолжить', true);
}

// ---------- Выбор перевода ----------
function renderChoice(step, e) {
    step.__needsCheck = true;
    e.body.innerHTML = promptHtml(step.eyebrow, step.question) + `<div class="lesson-options"></div>`;
    const opts = e.body.querySelector('.lesson-options');

    let selected = -1;
    const buttons = step.options.map((opt, j) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'task-opt-btn lesson-option';
        btn.innerHTML = `
            <span class="lesson-option-letter" aria-hidden="true">${LETTERS[j] || (j + 1)}</span>
            <span class="lesson-option-label">${escapeHtml(opt)}</span>`;
        btn.addEventListener('click', () => {
            if (validated) return;
            selected = j;
            buttons.forEach(b => b.classList.remove('is-selected'));
            btn.classList.add('is-selected');
            setAction('Проверить', true);
        });
        opts.appendChild(btn);
        return btn;
    });

    setAction('Проверить', false);
    checkFn = () => {
        const ok = selected === step.answer;
        buttons.forEach((b, j) => {
            b.disabled = true;
            if (j === step.answer) b.classList.add('is-correct');
            else if (j === selected) b.classList.add('is-wrong');
        });
        if (!ok) showSolution(`Правильно: ${step.options[step.answer]}`);
        return ok;
    };
}

// ---------- Соединить пары ----------
function renderMatch(step, e) {
    e.body.innerHTML = promptHtml(step.eyebrow, step.prompt)
        + `<div class="lesson-match">
               <div class="lesson-match-col" data-side="kz"></div>
               <div class="lesson-match-col" data-side="ru"></div>
           </div>`;
    const colKz = e.body.querySelector('[data-side="kz"]');
    const colRu = e.body.querySelector('[data-side="ru"]');

    const makeTile = (text, key, side) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lesson-match-tile';
        b.dataset.key = key;
        b.dataset.side = side;
        b.textContent = text;
        return b;
    };

    // Ключ плитки — исходный индекс пары, чтобы стороны совпадали после перемешивания.
    const indexed = step.pairs.map((p, i) => ({ ...p, i }));
    shuffle(indexed).forEach(p => colKz.appendChild(makeTile(p.kz, String(p.i), 'kz')));
    shuffle(indexed).forEach(p => colRu.appendChild(makeTile(p.ru, String(p.i), 'ru')));

    let pickedKz = null;
    let matched = 0;
    const total = step.pairs.length;

    const clearPick = () => {
        if (pickedKz) pickedKz.classList.remove('is-picked');
        pickedKz = null;
    };

    const onTile = (tile) => {
        if (tile.classList.contains('is-done')) return;
        if (tile.dataset.side === 'kz') {
            clearPick();
            pickedKz = tile;
            tile.classList.add('is-picked');
            return;
        }
        // выбрана правая плитка
        if (!pickedKz) return;
        if (pickedKz.dataset.key === tile.dataset.key) {
            pickedKz.classList.remove('is-picked');
            pickedKz.classList.add('is-done');
            tile.classList.add('is-done');
            clearPick();
            matched++;
            if (matched === total) {
                e.screen.classList.add('feedback-ok');
                setAction(isLastStep() ? 'Завершить' : 'Продолжить', true, 'leaf');
            }
        } else {
            // ошибка — мигаем и теряем сердце
            const wrong = pickedKz;
            wrong.classList.add('is-bad');
            tile.classList.add('is-bad');
            setTimeout(() => { wrong.classList.remove('is-bad'); tile.classList.remove('is-bad'); }, 450);
            clearPick();
            loseHeart();
        }
    };

    e.body.querySelectorAll('.lesson-match-tile').forEach(t => t.addEventListener('click', () => onTile(t)));
    setAction(isLastStep() ? 'Завершить' : 'Продолжить', false);
}

// ---------- Собрать фразу из слов ----------
function renderBuild(step, e) {
    step.__needsCheck = true;
    e.body.innerHTML = promptHtml(step.eyebrow, step.prompt)
        + `<div class="lesson-build-ru sticker">${escapeHtml(step.ru)}</div>
           <div class="lesson-build-line" aria-label="Ваш ответ"></div>
           <div class="lesson-build-bank"></div>`;

    const line = e.body.querySelector('.lesson-build-line');
    const bank = e.body.querySelector('.lesson-build-bank');

    const pool = shuffle([...step.tokens, ...(step.distractors || [])]);

    const refresh = () => {
        const has = line.querySelector('.lesson-tile');
        setAction('Проверить', !!has && !validated);
    };

    const makeTile = (text, home) => {
        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'lesson-tile';
        t.textContent = text;
        t.addEventListener('click', () => {
            if (validated) return;
            if (t.parentElement === bank) line.appendChild(t);
            else bank.appendChild(t);
            refresh();
        });
        home.appendChild(t);
    };

    pool.forEach(tok => makeTile(tok, bank));
    setAction('Проверить', false);

    checkFn = () => {
        const answer = Array.from(line.querySelectorAll('.lesson-tile')).map(t => t.textContent);
        const ok = answer.join(' ') === step.tokens.join(' ');
        line.classList.add(ok ? 'is-correct' : 'is-wrong');
        line.querySelectorAll('.lesson-tile').forEach(t => t.disabled = true);
        bank.querySelectorAll('.lesson-tile').forEach(t => t.disabled = true);
        if (!ok) showSolution(`Правильно: ${step.tokens.join(' ')}`);
        return ok;
    };
}

// ---------- Итоговые слова ----------
function renderWords(step, e) {
    const lesson = lessonsData[lessonIdx];
    const words = (lesson.wordIds || []).map(getWord).filter(Boolean);
    e.body.innerHTML = promptHtml(step.eyebrow, step.title || lesson.title)
        + `<div class="lesson-words sticker">${words.map(w => `
            <div class="lesson-word">
                <div class="lesson-word-kz">${escapeHtml(w.kz)}</div>
                <div class="lesson-word-ru">${escapeHtml(w.ru)}</div>
                ${w.phonetic ? `<div class="lesson-word-phonetic">${escapeHtml(w.phonetic)}</div>` : ''}
            </div>`).join('')}</div>`;
    setAction(isLastStep() ? 'Завершить' : 'Продолжить', true, 'teal');
}

// --- Общие действия ---
function showSolution(text) {
    const e = els();
    if (!e) return;
    e.solution.textContent = text;
    e.solution.hidden = false;
}

function loseHeart() {
    hearts = Math.max(0, hearts - 1);
    updateHearts();
}

function onAction() {
    const step = steps[stepNo];
    if (step && step.__needsCheck && !validated) {
        validated = true;
        const ok = checkFn ? checkFn() : true;
        const e = els();
        if (e) e.screen.classList.add(ok ? 'feedback-ok' : 'feedback-bad');
        if (!ok) loseHeart();
        setAction(isLastStep() ? 'Завершить' : 'Продолжить', true, ok ? 'leaf' : 'coral');
    } else {
        advance();
    }
}

function advance() {
    if (stepNo < steps.length - 1) {
        stepNo++;
        renderStep();
    } else {
        completeLesson();
    }
}

async function completeLesson() {
    const lesson = lessonsData[lessonIdx];
    const wordIds = lesson.wordIds ?? [];

    // Зачисляем слова в SRS и обновляем очередь карточек.
    enrollWords(wordIds, lesson.id);
    syncFlashcardsShim();
    markLessonCompleted(lesson.id);
    setRecentLessonIds(getRecentLessonIds(3));
    await postEnroll(wordIds, lesson.id).catch(() => {});

    // Прогресс уроков: текущий пройден, следующий разблокирован.
    lessonsProgress[lessonIdx] = true;
    if (lessonIdx + 1 < lessonsProgress.length && lessonsProgress[lessonIdx + 1] === false) {
        lessonsProgress[lessonIdx + 1] = null;
    }

    recordActivity();
    renderLessonsPath();
    closeLessonPage();
    if (renderStats) renderStats();
}

export function closeLessonPage() {
    const lessonPage = document.querySelector('#tab-lessons .lesson-page');
    if (lessonPage) lessonPage.style.display = 'none';
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (lessonsPath) lessonsPath.style.display = 'flex';
    document.body.classList.remove('lesson-open');
}
