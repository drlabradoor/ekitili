// Рендеринг уроков
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { showLesson } from './lessons.js';
import { showTest } from './test.js';

export function renderLessonsPath() {
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (!lessonsPath) return;
    
    lessonsPath.innerHTML = '';
    
    // Добавляем кнопку "Пройти тест"
    const testButton = document.createElement('button');
    testButton.className = 'test-button';
    testButton.innerHTML = '<i class="fas fa-graduation-cap"></i> Пройти тест';
    testButton.style.cssText = `
        width: 100%;
        max-width: 300px;
        margin: 20px auto;
        padding: 15px 30px;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        display: block;
        transition: all 0.3s;
    `;
    testButton.onmouseover = () => {
        testButton.style.background = 'var(--primary-color)';
        testButton.style.transform = 'scale(1.05)';
    };
    testButton.onmouseout = () => {
        testButton.style.background = 'var(--secondary-color)';
        testButton.style.transform = 'scale(1)';
    };
    testButton.onclick = () => {
        showTest();
    };
    lessonsPath.appendChild(testButton);
    
    let firstActiveFound = false;
    
    lessonsData.forEach((lesson, idx) => {
        let state = '';
        if (lessonsProgress[idx] === true) {
            state = 'completed';
        } else if (lessonsProgress[idx] === null && !firstActiveFound) {
            state = 'active';
            firstActiveFound = true;
        } else {
            state = 'locked';
        }
        
        const levelDiv = document.createElement('div');
        levelDiv.className = `lesson-level ${state}`;
        levelDiv.setAttribute('data-lesson', idx);
        levelDiv.innerHTML = `<div class="level-circle">${state === 'locked' ? '<i class=\'fas fa-lock\'></i>' : idx + 1}</div><div class="level-title">${lesson.title}</div>`;
        
        if (state === 'active' || state === 'completed') {
            levelDiv.addEventListener('click', function() {
                showLesson(parseInt(levelDiv.getAttribute('data-lesson')));
            });
        }
        
        lessonsPath.appendChild(levelDiv);
    });
}

