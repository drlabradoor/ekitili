// Рендеринг уроков
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { showLesson } from './lessons.js';

export function renderLessonsPath() {
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (!lessonsPath) return;
    
    lessonsPath.innerHTML = '';
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

