// Основная логика карточек — init + переключение режимов.

import { renderReviewSession } from './reviewSessionRenderer.js';
import { renderLibrary, setInitialLibraryFilter } from './libraryRenderer.js';
import { userWords } from '../../data/userWords.js';

let currentMode = 'repeat';
let recentLessonIds = [];

export function initFlashcards() {
    renderFlashcardsTab();

    // Переключение на библиотеку по событию из сессии ("Открыть библиотеку")
    document.addEventListener('srs-open-library', (e) => {
        const filter = e?.detail?.filter ?? null;
        if (filter) setInitialLibraryFilter(filter);
        currentMode = 'library';
        renderFlashcardsTab();
    });
}

export function renderFlashcardsTab() {
    const section = document.querySelector('.flashcards-section');
    if (!section) return;
    renderFlashcardsSection(section);
}

function renderFlashcardsSection(section) {
    section.innerHTML = `
        <div class="srs-mode-tabs">
            <button class="flashcard-mode-btn ${currentMode === 'repeat' ? 'active' : ''}" id="tab-repeat">
                <i class="fas fa-rotate-right"></i> Повторение
            </button>
            <button class="flashcard-mode-btn ${currentMode === 'library' ? 'active' : ''}" id="tab-library">
                <i class="fas fa-list"></i> Библиотека
            </button>
        </div>
        <div id="srs-mode-content"></div>
    `;

    section.querySelector('#tab-repeat').addEventListener('click', () => {
        if (currentMode === 'repeat') return;
        currentMode = 'repeat';
        renderFlashcardsSection(section);
    });

    section.querySelector('#tab-library').addEventListener('click', () => {
        if (currentMode === 'library') return;
        currentMode = 'library';
        renderFlashcardsSection(section);
    });

    const content = section.querySelector('#srs-mode-content');
    if (currentMode === 'repeat') {
        renderReviewSession(content, { recentLessonIds });
    } else {
        renderLibrary(content);
    }
}

export function setRecentLessonIds(ids) {
    recentLessonIds = ids ?? [];
}
