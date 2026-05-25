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
    // Дизайн-референс: design-handoff/project/screens_cards.jsx
    // Свиток (Scroll) с пергаментным телом и деревянными валиками сверху/снизу.
    section.classList.add('cards-screen');
    section.innerHTML = `
        <div class="cards-heading">
            <div class="h-ornament">Колода повторения</div>
            <div class="cards-heading-title h-display">Свиток слов</div>
        </div>
        <div class="srs-mode-tabs cards-tabs">
            <button class="flashcard-mode-btn cards-tab ${currentMode === 'repeat' ? 'active' : ''}" id="tab-repeat">
                <span class="cards-tab-icon" aria-hidden="true">↻</span> Повторение
            </button>
            <button class="flashcard-mode-btn cards-tab ${currentMode === 'library' ? 'active' : ''}" id="tab-library">
                <span class="cards-tab-icon" aria-hidden="true">☰</span> Библиотека
            </button>
        </div>
        <div class="cards-scroll">
            <div class="cards-scroll-rod cards-scroll-rod--top" aria-hidden="true">
                <span class="cards-scroll-cap cards-scroll-cap--left"></span>
                <span class="cards-scroll-cap cards-scroll-cap--right"></span>
                <span class="cards-scroll-lip cards-scroll-lip--top"></span>
            </div>
            <div class="cards-scroll-body">
                <span class="cards-scroll-corner cards-scroll-corner--tl" aria-hidden="true"></span>
                <span class="cards-scroll-corner cards-scroll-corner--tr" aria-hidden="true"></span>
                <span class="cards-scroll-corner cards-scroll-corner--bl" aria-hidden="true"></span>
                <span class="cards-scroll-corner cards-scroll-corner--br" aria-hidden="true"></span>
                <div id="srs-mode-content"></div>
            </div>
            <div class="cards-scroll-rod cards-scroll-rod--bottom" aria-hidden="true">
                <span class="cards-scroll-cap cards-scroll-cap--left"></span>
                <span class="cards-scroll-cap cards-scroll-cap--right"></span>
                <span class="cards-scroll-lip cards-scroll-lip--bottom"></span>
            </div>
        </div>
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
