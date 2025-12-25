// Основная логика уроков
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { userFlashcards } from '../../data/flashcards.js';
import { renderLessonsPath } from './lessonRenderer.js';
import { renderStats } from '../profile/profileRenderer.js';
import { getToday } from '../../utils/date.js';

let currentLessonIdx = 0;
let currentStep = 0;
let lessonAnswers = [];

// Модалка завершения урока
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
        <div class="lesson-duo-header"><div class="lesson-title"></div></div>
        <div class="lesson-duo-container">
            <div class="lesson-duo-content"></div>
            <button class="lesson-duo-next-btn" disabled>Далее</button>
        </div>
    `;
    
    lessonPage.style.display = 'block';
    lessonPage.style.position = 'fixed';
    lessonPage.style.top = '0';
    lessonPage.style.left = '0';
    lessonPage.style.right = '0';
    lessonPage.style.bottom = '0';
    lessonPage.style.width = '100vw';
    lessonPage.style.height = '100vh';
    lessonPage.style.background = '#fff';
    lessonPage.style.zIndex = '1000';
    lessonPage.style.overflow = 'hidden';
    
    document.body.classList.add('lesson-open');
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (lessonsPath) lessonsPath.style.display = 'none';
    
    renderLessonStep();
}

function renderLessonStep() {
    const lesson = lessonsData[currentLessonIdx];
    const lessonPage = document.querySelector('#tab-lessons .lesson-page');
    if (!lessonPage) return;
    
    const header = lessonPage.querySelector('.lesson-duo-header .lesson-title');
    const content = lessonPage.querySelector('.lesson-duo-content');
    const nextBtn = lessonPage.querySelector('.lesson-duo-next-btn');
    
    if (!header || !content || !nextBtn) return;
    
    nextBtn.disabled = true;
    nextBtn.classList.remove('success');
    content.innerHTML = '';
    header.textContent = lesson.title;
    
    // Шаги: 0 — теория, 1 — задание 1, 2 — задание 2, 3 — новые слова
    if (currentStep === 0) {
        content.innerHTML = `<div class='lesson-theory-block'>${lesson.theory}</div>`;
        nextBtn.disabled = false;
    }
    
    if (currentStep === 1 || currentStep === 2) {
        const taskIdx = currentStep - 1;
        const task = lesson.tasks[taskIdx];
        content.innerHTML = `<div class='lesson-step-block'><div class='task-q'>${taskIdx + 1}. ${task.question}</div></div>`;
        const block = content.querySelector('.lesson-step-block');
        
        task.options.forEach((opt, j) => {
            const btn = document.createElement('button');
            btn.className = 'task-opt-btn';
            btn.textContent = opt;
            btn.onclick = () => {
                if (j === task.answer) {
                    btn.style.background = 'var(--secondary-color)';
                    btn.style.color = '#fff';
                    lessonAnswers[taskIdx] = true;
                    nextBtn.disabled = false;
                    nextBtn.classList.add('success');
                    // Блокируем все кнопки
                    Array.from(block.querySelectorAll('button')).forEach(b => b.disabled = true);
                } else {
                    btn.style.background = 'var(--danger-color)';
                    btn.style.color = '#fff';
                    btn.disabled = true;
                    lessonAnswers[taskIdx] = false;
                }
            };
            block.appendChild(btn);
        });
    }
    
    if (currentStep === 3) {
        let words = lesson.words || [];
        if (!words.length && lesson.tasks) {
            words = lesson.tasks.map(t => ({
                front: t.question.replace(/Как будет |Как сказать |\?|"/g, '').trim(),
                back: t.options[t.answer],
                phonetic: ''
            }));
        }
        content.innerHTML = `<div class='lesson-newwords-title'>Новые слова:</div>` +
            words.map(w => `<div class='lesson-newword'><b>${w.front}</b> — ${w.back} <span style='color:#888'>${w.phonetic || ''}</span></div>`).join('');
        nextBtn.textContent = 'Завершить';
        nextBtn.disabled = false;
        nextBtn.classList.remove('success');
    } else {
        nextBtn.textContent = 'Далее';
    }
    
    nextBtn.onclick = () => {
        if (currentStep === 1 || currentStep === 2) {
            if (lessonAnswers[currentStep - 1] !== true) return;
        }
        if (currentStep < 3) {
            currentStep++;
            renderLessonStep();
        } else {
            completeLesson();
        }
    };
}

function completeLesson() {
    const lesson = lessonsData[currentLessonIdx];
    
    // Добавляем новые слова в SRS
    let words = lesson.words || [];
    if (!words.length && lesson.tasks) {
        words = lesson.tasks.map(t => ({
            front: t.question.replace(/Как будет |Как сказать |\?|"/g, '').trim(),
            back: t.options[t.answer],
            phonetic: ''
        }));
    }
    
    const today = getToday();
    words.forEach(w => {
        userFlashcards.push({
            ...w,
            srsLevel: 1,
            status: 'new',
            nextReview: new Date(today),
            stats: { correct: 0, incorrect: 0 }
        });
    });
    
    // Обновляем прогресс уроков и возвращаем к списку
    lessonsProgress[currentLessonIdx] = true;
    if (currentLessonIdx + 1 < lessonsProgress.length && lessonsProgress[currentLessonIdx + 1] === false) {
        lessonsProgress[currentLessonIdx + 1] = null;
    }
    
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

