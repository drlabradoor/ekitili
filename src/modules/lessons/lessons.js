// Основная логика уроков
// Дизайн-референс: design-handoff/project/screens_lesson.jsx
// 4 шага: 0 теория → 1 задача → 2 задача → 3 новые слова.
import { lessonsData, lessonsProgress, markLessonCompleted, getRecentLessonIds } from '../../data/lessons.js';
import { enrollWords } from '../../data/userWords.js';
import { syncFlashcardsShim } from '../../data/flashcards.js';
import { setRecentLessonIds } from '../flashcards/flashcards.js';
import { renderLessonsPath } from './lessonRenderer.js';
import { renderStats } from '../profile/profileRenderer.js';
import { recordActivity } from '../../services/streak.js';
import { postEnroll } from '../../services/srsSync.js';

const TOTAL_STEPS = 4;
const HEARTS_FULL = 5;
const STEP_LETTERS = ['A', 'B', 'C', 'D', 'E'];

let currentLessonIdx = 0;
let currentStep = 0;
let lessonAnswers = [];
let lessonCompleteModal = null;

function createLessonCompleteModal() {
    if (lessonCompleteModal) return lessonCompleteModal;

    lessonCompleteModal = document.getElementById('lesson-complete-modal');
    if (!lessonCompleteModal) {
        lessonCompleteModal = document.createElement('div');
        lessonCompleteModal.id = 'lesson-complete-modal';
        lessonCompleteModal.className = 'modal';
        lessonCompleteModal.style.display = 'none';
        lessonCompleteModal.innerHTML = `
            <div class="modal-content">
                <h2>Урок завершён!</h2>
                <div style="font-size:1.2em;margin:18px 0;">Поздравляем! Вы успешно прошли урок 🎉</div>
                <button id="close-lesson-complete">Закрыть</button>
            </div>
        `;
        document.body.appendChild(lessonCompleteModal);
        lessonCompleteModal.querySelector('#close-lesson-complete').onclick = () => {
            lessonCompleteModal.style.display = 'none';
        };
    }
    return lessonCompleteModal;
}

export function showLesson(idx) {
    currentLessonIdx = idx;
    currentStep = 0;
    lessonAnswers = [null, null];

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
                <button type="button" class="lesson-action-btn btn-chunk" disabled>Далее</button>
            </div>
        </div>
    `;

    lessonPage.style.position = 'fixed';
    lessonPage.style.top = '0';
    lessonPage.style.left = '0';
    lessonPage.style.right = '0';
    lessonPage.style.bottom = '0';
    lessonPage.style.width = '100vw';
    lessonPage.style.height = '100vh';
    lessonPage.style.background = 'var(--page)';
    lessonPage.style.zIndex = '1000';
    lessonPage.style.overflow = 'hidden';
    lessonPage.style.display = 'block';
    lessonPage.style.margin = '0';
    lessonPage.style.padding = '0';
    lessonPage.style.borderRadius = '0';
    lessonPage.style.boxShadow = 'none';

    lessonPage.querySelector('.lesson-close').addEventListener('click', closeLessonPage);

    document.body.classList.add('lesson-open');
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (lessonsPath) lessonsPath.style.display = 'none';

    renderLessonStep();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function renderLessonStep() {
    const lesson = lessonsData[currentLessonIdx];
    const lessonPage = document.querySelector('#tab-lessons .lesson-page');
    if (!lessonPage) return;

    const screen = lessonPage.querySelector('.lesson-screen');
    const body = lessonPage.querySelector('.lesson-body');
    const actionBtn = lessonPage.querySelector('.lesson-action-btn');
    const progressFill = lessonPage.querySelector('.lesson-progress-fill');
    if (!screen || !body || !actionBtn || !progressFill) return;

    // Сбрасываем стиль фидбэка и кнопки между шагами.
    screen.classList.remove('feedback-ok', 'feedback-bad');
    actionBtn.className = 'lesson-action-btn btn-chunk';
    actionBtn.disabled = true;
    actionBtn.textContent = currentStep === TOTAL_STEPS - 1 ? 'Завершить' : 'Далее';

    // Прогресс-бар: заполнено пропорционально текущему шагу.
    progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

    if (currentStep === 0) {
        // Теория — больших правильных/неправильных нет, можно сразу дальше.
        body.innerHTML = `
            <div class="lesson-prompt">
                <div class="h-ornament">Теория · ${escapeHtml(lesson.title)}</div>
                <div class="lesson-prompt-title h-display">Прочтите и запомните</div>
            </div>
            <div class="lesson-theory sticker">${lesson.theory}</div>
        `;
        actionBtn.disabled = false;
        actionBtn.textContent = 'Продолжить';
        actionBtn.onclick = advanceStep;
        return;
    }

    if (currentStep === 1 || currentStep === 2) {
        const taskIdx = currentStep - 1;
        const task = lesson.tasks[taskIdx];

        body.innerHTML = `
            <div class="lesson-prompt">
                <div class="h-ornament">Выберите верный ответ</div>
                <div class="lesson-prompt-title h-display">${escapeHtml(task.question)}</div>
            </div>
            <div class="lesson-options"></div>
        `;
        const opts = body.querySelector('.lesson-options');
        task.options.forEach((opt, j) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'task-opt-btn lesson-option';
            btn.innerHTML = `
                <span class="lesson-option-letter" aria-hidden="true">${STEP_LETTERS[j] || (j + 1)}</span>
                <span class="lesson-option-label">${escapeHtml(opt)}</span>
            `;
            btn.addEventListener('click', () => {
                if (lessonAnswers[taskIdx] === true) return;
                if (j === task.answer) {
                    btn.classList.add('is-correct');
                    lessonAnswers[taskIdx] = true;
                    screen.classList.remove('feedback-bad');
                    screen.classList.add('feedback-ok');
                    actionBtn.disabled = false;
                    actionBtn.classList.add('leaf');
                    actionBtn.textContent = 'Продолжить';
                    Array.from(opts.querySelectorAll('button')).forEach(b => b.disabled = true);
                } else {
                    btn.classList.add('is-wrong');
                    btn.disabled = true;
                    lessonAnswers[taskIdx] = false;
                    screen.classList.add('feedback-bad');
                }
            });
            opts.appendChild(btn);
        });
        actionBtn.onclick = () => {
            if (lessonAnswers[taskIdx] === true) advanceStep();
        };
        return;
    }

    if (currentStep === 3) {
        body.innerHTML = `
            <div class="lesson-prompt">
                <div class="h-ornament">Новые слова в копилку</div>
                <div class="lesson-prompt-title h-display">${escapeHtml(lesson.title)}</div>
            </div>
            <div class="lesson-words sticker"><div class="lesson-words-placeholder">Загрузка…</div></div>
        `;
        import('../../data/words.js').then(({ getWord }) => {
            const wordIds = lesson.wordIds ?? [];
            const words = wordIds.map(id => getWord(id)).filter(Boolean);
            const wordsBox = lessonPage.querySelector('.lesson-words');
            if (!wordsBox) return;
            wordsBox.innerHTML = words.map(w => `
                <div class="lesson-word">
                    <div class="lesson-word-kz">${escapeHtml(w.kz)}</div>
                    <div class="lesson-word-ru">${escapeHtml(w.ru)}</div>
                    ${w.phonetic ? `<div class="lesson-word-phonetic">${escapeHtml(w.phonetic)}</div>` : ''}
                </div>
            `).join('');
        });
        actionBtn.disabled = false;
        actionBtn.textContent = 'Завершить';
        actionBtn.classList.add('teal');
        actionBtn.onclick = completeLesson;
        return;
    }
}

function advanceStep() {
    if (currentStep < TOTAL_STEPS - 1) {
        currentStep++;
        renderLessonStep();
    } else {
        completeLesson();
    }
}

async function completeLesson() {
    const lesson = lessonsData[currentLessonIdx];
    const wordIds = lesson.wordIds ?? [];

    // Зачисляем слова в SRS
    enrollWords(wordIds, lesson.id);
    syncFlashcardsShim();

    // Обновляем приоритеты очереди
    markLessonCompleted(lesson.id);
    setRecentLessonIds(getRecentLessonIds(3));

    // Синк на сервер
    await postEnroll(wordIds, lesson.id).catch(() => {});

    // Обновляем прогресс уроков
    lessonsProgress[currentLessonIdx] = true;
    if (currentLessonIdx + 1 < lessonsProgress.length && lessonsProgress[currentLessonIdx + 1] === false) {
        lessonsProgress[currentLessonIdx + 1] = null;
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
