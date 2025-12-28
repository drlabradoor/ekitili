import { flashcardsData, userFlashcards } from '../../data/flashcards.js';
import { unlockAchievement } from '../../services/achievements.js';

let gameActive = false;
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let totalPairs = 8;
let canFlip = true;

/**
 * Инициализация модуля игры
 */
export function initMemoryGame() {
    const restartBtn = document.getElementById('restart-memory-game');
    if (restartBtn) {
        restartBtn.addEventListener('click', startNewGame);
    }
}

/**
 * Запуск новой игры
 */
export function startNewGame() {
    const gameBoard = document.getElementById('memory-game-board');
    if (!gameBoard) return;

    // Сброс состояния
    gameActive = true;
    cards = [];
    flippedCards = [];
    matchedPairs = 0;
    canFlip = true;

    // Очистка доски
    gameBoard.innerHTML = '';

    // Подготовка пар слов
    const pairs = selectWordPairs();

    // Перемешивание
    pairs.sort(() => Math.random() - 0.5);

    // Создание карточек
    pairs.forEach((item, index) => {
        const card = createCard(item, index);
        cards.push(card);
        gameBoard.appendChild(card);
    });

    // Обновление UI
    const statusEl = document.getElementById('memory-game-status');
    if (statusEl) statusEl.textContent = 'Найдите все пары!';
}

/**
 * Выбор 8 случайных пар слов
 */
function selectWordPairs() {
    let allWords = [];

    // Используем ТОЛЬКО карточки пользователя (Казахский-Русский)
    // Так как flashcardsData содержит англо-русские пары, мы их игнорируем
    if (userFlashcards && userFlashcards.length > 0) {
        allWords = [...userFlashcards];
    }

    // Перемешиваем и берем 8
    allWords.sort(() => Math.random() - 0.5);
    const selected = allWords.slice(0, totalPairs);

    // Создаем пары (слово на русском, слово на казахском)
    let gameItems = [];
    selected.forEach(word => {
        // Русская карта
        gameItems.push({
            id: word.front + '_ru',
            text: word.back, // Русский
            pairId: word.front, // Общий ID для пары
            type: 'ru'
        });

        // Казахская карта
        gameItems.push({
            id: word.front + '_kz',
            text: word.front, // Казахский
            pairId: word.front,
            type: 'kz'
        });
    });

    return gameItems;
}

/**
 * Создание DOM элемента карточки
 */
function createCard(item, index) {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.dataset.id = item.id;
    card.dataset.pairId = item.pairId;

    const inner = document.createElement('div');
    inner.className = 'memory-card-inner';

    const front = document.createElement('div');
    front.className = 'memory-card-front';
    front.innerHTML = '<i class="fas fa-question"></i>';

    const back = document.createElement('div');
    back.className = 'memory-card-back';
    back.textContent = item.text;

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    card.addEventListener('click', () => handleCardClick(card));

    return card;
}

/**
 * Обработка клика по карточке
 */
function handleCardClick(card) {
    if (!gameActive || !canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) {
        return;
    }

    // Переворачиваем
    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        checkMatch();
    }
}

/**
 * Проверка совпадения
 */
function checkMatch() {
    canFlip = false;
    const [card1, card2] = flippedCards;
    const match = card1.dataset.pairId === card2.dataset.pairId;

    if (match) {
        // Совпадение
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchedPairs++;
        flippedCards = [];
        canFlip = true;

        if (matchedPairs === totalPairs) {
            handleWin();
        }
    } else {
        // Не совпадение - переворачиваем обратно
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
            canFlip = true;
        }, 1000);
    }
}

/**
 * Обработка победы
 */
function handleWin() {
    const statusEl = document.getElementById('memory-game-status');
    if (statusEl) statusEl.innerHTML = '🎉 Победа! Молодец! <br>Нажми "Заново" для новой игры.';

    // Разблокировать достижение "Мастер Памяти"
    unlockAchievement('memory_master');

    // Можно добавить начисление очков здесь
    gameActive = false;
}

/**
 * Рендеринг вкладки игры (запуск, если пусто)
 */
export function renderGameTab() {
    const gameBoard = document.getElementById('memory-game-board');
    if (gameBoard && gameBoard.children.length === 0) {
        startNewGame();
    }
}

