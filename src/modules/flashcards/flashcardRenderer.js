// Рендеринг карточек
import { userFlashcards } from '../../data/flashcards.js';
import { getDueFlashcards, updateCardSRSOnCorrect, updateCardSRSOnIncorrect } from '../../services/srs.js';
import { getNewFlashcardsCount, getReviewedTodayCount } from '../../services/stats.js';
import { recordActivity } from '../../services/streak.js';

let currentMode = 'repeat';
let currentCardIdx = 0;
let dueCards = [];

export function renderFlashcardsSection() {
    const catContainer = document.querySelector('.flashcard-categories');
    if (!catContainer) return;
    
    catContainer.innerHTML = '';
    
    // Вкладки управления
    const repeatTab = document.createElement('button');
    repeatTab.className = 'flashcard-mode-btn repeat-btn';
    repeatTab.innerHTML = '<i class="fas fa-rotate-right"></i>';
    repeatTab.setAttribute('aria-label', 'Повторять');
    repeatTab.title = 'Повторять';
    
    const libraryTab = document.createElement('button');
    libraryTab.className = 'flashcard-mode-btn library-btn';
    libraryTab.innerHTML = '<i class="fas fa-list"></i>';
    libraryTab.setAttribute('aria-label', 'Библиотека');
    libraryTab.title = 'Библиотека';
    
    catContainer.appendChild(repeatTab);
    catContainer.appendChild(libraryTab);
    
    // Состояние
    repeatTab.classList.toggle('active', currentMode === 'repeat');
    libraryTab.classList.toggle('active', currentMode === 'library');
    
    repeatTab.onclick = () => {
        currentMode = 'repeat';
        renderFlashcardsSection();
    };
    
    libraryTab.onclick = () => {
        currentMode = 'library';
        renderFlashcardsSection();
    };
    
    // Рендеринг в зависимости от режима
    if (currentMode === 'repeat') {
        renderRepeatMode(catContainer);
    } else {
        renderLibraryMode();
    }
}

function renderRepeatMode(catContainer) {
    dueCards = getDueFlashcards();
    const flashcardContainer = document.querySelector('.flashcard');
    const feedbackBtns = document.querySelector('.feedback-btns');
    
    // Статистика
    const statsDiv = document.createElement('div');
    statsDiv.className = 'flashcard-stats';
    const newCount = getNewFlashcardsCount();
    const dueCount = dueCards.length;
    const reviewedToday = getReviewedTodayCount();
    statsDiv.innerHTML = `<b>Новых:</b> ${newCount} &nbsp; <b>На сегодня:</b> ${dueCount} &nbsp; <b>Повторено:</b> ${reviewedToday}`;
    catContainer.appendChild(statsDiv);
    
    if (dueCards.length === 0) {
        if (flashcardContainer) {
            flashcardContainer.innerHTML = '<div style="padding:32px 0;text-align:center;font-size:1.2em;">На сегодня всё!<br><span style="font-size:2em;">🎉</span></div>';
        }
        if (feedbackBtns) feedbackBtns.innerHTML = '';
        return;
    }
    
    currentCardIdx = 0;
    showCard(currentCardIdx);
    
    if (feedbackBtns) {
        feedbackBtns.innerHTML = '';
        const correctBtn = document.createElement('button');
        correctBtn.className = 'correct-btn';
        correctBtn.textContent = 'Знаю';
        correctBtn.onclick = () => {
            const card = dueCards[currentCardIdx];
            updateCardSRSOnCorrect(card);
            recordActivity();
            currentCardIdx++;
            if (currentCardIdx < dueCards.length) {
                showCard(currentCardIdx);
            } else {
                renderFlashcardsSection();
            }
        };
        
        const incorrectBtn = document.createElement('button');
        incorrectBtn.className = 'incorrect-btn';
        incorrectBtn.textContent = 'Не знаю';
        incorrectBtn.onclick = () => {
            const card = dueCards[currentCardIdx];
            updateCardSRSOnIncorrect(card);
            recordActivity();
            currentCardIdx++;
            if (currentCardIdx < dueCards.length) {
                showCard(currentCardIdx);
            } else {
                renderFlashcardsSection();
            }
        };
        
        feedbackBtns.appendChild(correctBtn);
        feedbackBtns.appendChild(incorrectBtn);
    }
}

function showCard(idx) {
    if (idx >= dueCards.length) return;
    
    const card = dueCards[idx];
    const flashcardContainer = document.querySelector('.flashcard');
    if (!flashcardContainer) return;
    
    flashcardContainer.innerHTML = '';
    
    const cardFront = document.createElement('div');
    cardFront.className = 'card-front';
    cardFront.textContent = card.front;
    flashcardContainer.appendChild(cardFront);
    
    const cardPhonetic = document.createElement('div');
    cardPhonetic.className = 'card-phonetic';
    cardPhonetic.textContent = card.phonetic || '';
    flashcardContainer.appendChild(cardPhonetic);
    
    const flipBtn = document.createElement('div');
    flipBtn.className = 'flip-btn';
    flipBtn.textContent = 'Показать перевод';
    flashcardContainer.appendChild(flipBtn);
    
    let isFlipped = false;
    flipBtn.onclick = () => {
        isFlipped = !isFlipped;
        cardFront.textContent = isFlipped ? card.back : card.front;
        cardPhonetic.textContent = isFlipped ? '' : (card.phonetic || '');
        flipBtn.textContent = isFlipped ? 'Показать слово' : 'Показать перевод';
    };
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'card-stats';
    statsDiv.innerHTML = `<span style="color:green">Знаю: ${card.stats.correct}</span> | <span style="color:red">Не знаю: ${card.stats.incorrect}</span>`;
    flashcardContainer.appendChild(statsDiv);
}

function renderLibraryMode() {
    const flashcardContainer = document.querySelector('.flashcard');
    const feedbackBtns = document.querySelector('.feedback-btns');
    
    if (flashcardContainer) {
        flashcardContainer.innerHTML = '';
        const table = document.createElement('div');
        table.className = 'flashcard-library-table';
        
        // Заголовок
        table.innerHTML = `<div class="lib-row lib-header">
            <div>Слово</div><div>Перевод</div><div>🗣️</div><div>SRS</div>
        </div>`;
        
        userFlashcards.forEach(card => {
            const row = document.createElement('div');
            row.className = 'lib-row';
            
            let srsColor = '#bbb';
            if (card.srsLevel === 1) srsColor = '#fbbc05';
            if (card.srsLevel === 2) srsColor = '#4285f4';
            if (card.srsLevel === 3) srsColor = '#34a853';
            if (card.srsLevel === 4) srsColor = '#a142f4';
            if (card.srsLevel === 5) srsColor = '#ea4335';
            
            row.innerHTML = `
                <div>${card.front}</div>
                <div>${card.back}</div>
                <div style="color:#888;font-size:0.95em;">${card.phonetic || ''}</div>
                <div><span class="lib-srs" style="background:${srsColor};">${card.srsLevel}</span></div>
            `;
            table.appendChild(row);
        });
        
        flashcardContainer.appendChild(table);
    }
    
    if (feedbackBtns) feedbackBtns.innerHTML = '';
}

