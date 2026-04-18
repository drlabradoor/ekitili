// Клиентский модуль батла — socket.io + управление состоянием
import { userFlashcards } from '../../data/flashcards.js';
import { unlockAchievement } from '../../services/achievements.js';
import { recordActivity } from '../../services/streak.js';
import { BACKEND_URL } from '../../config/env.js';
import {
    renderLobby,
    renderSearching,
    renderArena,
    renderAttackPhase,
    renderDefendPhase,
    renderWaiting,
    renderResult,
    updateComboBar,
    showDamageFloat,
    renderGamesMenu,
    renderRulesModal
} from './battleRenderer.js';
import { updateBatyrHP, animateBatyrHit, animateBatyrAttack, animateBatyrDefeat } from './batyrAvatar.js';

let socket = null;
let gameState = null;
let defenseTimerInterval = null;

/**
 * Инициализация модуля батла (вызывается из main.js)
 */
export function initBattle() {
    // Подключаем socket.io
    connectSocket();
}

/**
 * Рендер вкладки батла (вызывается роутером)
 */
export function renderBattleTab() {
    const container = document.getElementById('battle-container');
    if (!container) return;

    if (gameState && gameState.status !== 'over') {
        // Игра идёт — перерисовать арену
        return;
    }

    renderGamesMenu(container);
    bindGamesMenuEvents(container);
}

function bindGamesMenuEvents(container) {
    container.querySelector('#menu-duel-btn')?.addEventListener('click', () => startDuel(container));
    container.querySelector('#menu-duel-rules-btn')?.addEventListener('click', () => renderRulesModal('duel'));
    container.querySelector('#menu-training-btn')?.addEventListener('click', () => {
        import('./trainingGame.js').then(m => m.initTraining(container));
    });
    container.querySelector('#menu-training-rules-btn')?.addEventListener('click', () => renderRulesModal('training'));
}

function startDuel(container) {
    const username = localStorage.getItem('username') || 'Батыр';
    renderLobby(container, username);
    bindLobbyEvents(container);
}

// =====================================================
// Socket.io подключение
// =====================================================
function connectSocket() {
    if (socket && socket.connected) return;

    // socket.io клиент загружается через CDN
    // Используем глобальный io, подключённый через <script> в index.html
    if (typeof io === 'undefined') {
        console.warn('[Battle] socket.io client not loaded yet');
        return;
    }

    // Подключаемся к backend серверу (Render, Railway и т.д.)
    socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        console.log('[Battle] connected:', socket.id);
    });

    socket.on('battle_waiting', () => {
        const container = document.getElementById('battle-container');
        if (container) {
            renderSearching(container);
            bindSearchingEvents(container);
        }
    });

    socket.on('battle_error', (data) => {
        alert(data.message || 'Ошибка батла');
        const container = document.getElementById('battle-container');
        if (container) renderBattleTab();
    });

    socket.on('game_start', (data) => handleGameStart(data));
    socket.on('your_turn_attack', (data) => handleAttackTurn(data));
    socket.on('opponent_attacking', () => handleOpponentAttacking());
    socket.on('your_turn_defend', (data) => handleDefendTurn(data));
    socket.on('opponent_defending', (data) => handleOpponentDefending(data));
    socket.on('turn_result', (data) => handleTurnResult(data));
    socket.on('new_turn', (data) => handleNewTurn(data));
    socket.on('game_over', (data) => handleGameOver(data));
    socket.on('special_used', (data) => handleSpecialUsed(data));
    socket.on('opponent_left', () => handleOpponentLeft());

    socket.on('disconnect', () => {
        console.log('[Battle] disconnected');
    });
}

// =====================================================
// Привязка событий лобби
// =====================================================
function bindLobbyEvents(container) {
    const findBtn = container.querySelector('#battle-find-btn');
    if (findBtn) {
        findBtn.addEventListener('click', () => {
            if (!socket || !socket.connected) {
                connectSocket();
                setTimeout(() => joinBattle(), 500);
            } else {
                joinBattle();
            }
        });
    }
}

function bindSearchingEvents(container) {
    const cancelBtn = container.querySelector('#battle-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (socket) socket.disconnect();
            setTimeout(() => {
                connectSocket();
                renderBattleTab();
            }, 300);
        });
    }
}

function joinBattle() {
    const username = localStorage.getItem('username') || 'Батыр';
    const userId = localStorage.getItem('userId') || null;

    // Отправляем карточки для игры
    const cards = userFlashcards.map(c => ({
        front: c.front,
        back: c.back,
        svgShape: c.svgShape || null
    }));

    socket.emit('join_battle', { username, userId, cards });
}

// =====================================================
// Обработчики серверных событий
// =====================================================
function handleGameStart(data) {
    gameState = {
        gameId: data.gameId,
        playerIdx: data.playerIdx,
        playerSide: data.playerSide,
        attackerIdx: data.attackerIdx,
        status: 'started',
        player: {
            username: data.players[data.playerIdx].username,
            hp: data.players[data.playerIdx].hp,
            specialCharges: data.players[data.playerIdx].specialCharges,
            combo: 0
        },
        opponent: {
            username: data.players[1 - data.playerIdx].username,
            hp: data.players[1 - data.playerIdx].hp,
            specialCharges: data.players[1 - data.playerIdx].specialCharges,
            combo: 0
        }
    };

    const container = document.getElementById('battle-container');
    if (container) {
        renderArena(container, gameState);
        bindSpecialButtons();
    }
}

function handleAttackTurn(data) {
    gameState.status = 'attacking';
    const actionArea = document.getElementById('arena-action-area');
    const turnInfo = document.getElementById('arena-turn-info');
    if (!actionArea || !turnInfo) return;

    renderAttackPhase(actionArea, data.hand, turnInfo);

    // Привязать клики по картам
    actionArea.querySelectorAll('.attack-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            socket.emit('attack_card', { index });
            animateBatyrAttack(gameState.playerSide);
            renderWaiting(actionArea, turnInfo, 'Ждём ответа соперника...');
        });
    });
}

function handleOpponentAttacking() {
    gameState.status = 'waiting';
    const actionArea = document.getElementById('arena-action-area');
    const turnInfo = document.getElementById('arena-turn-info');
    if (!actionArea || !turnInfo) return;
    renderWaiting(actionArea, turnInfo, 'Соперник выбирает карту...');
}

function handleDefendTurn(data) {
    gameState.status = 'defending';
    const actionArea = document.getElementById('arena-action-area');
    const turnInfo = document.getElementById('arena-turn-info');
    if (!actionArea || !turnInfo) return;

    renderDefendPhase(actionArea, turnInfo, data.card, data.options, data.timerSeconds);

    // Запуск таймера
    startDefenseTimer(data.timerSeconds);

    // Привязать клики по вариантам
    actionArea.querySelectorAll('.defend-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            clearDefenseTimer();
            const answer = btn.textContent;
            socket.emit('defend_answer', { answer });
            // Визуально показать что ответ отправлен
            actionArea.querySelectorAll('.defend-option-btn').forEach(b => b.disabled = true);
            btn.classList.add('defend-option--selected');
        });
    });
}

function handleOpponentDefending(data) {
    gameState.status = 'waiting';
    const actionArea = document.getElementById('arena-action-area');
    const turnInfo = document.getElementById('arena-turn-info');
    if (!actionArea || !turnInfo) return;
    renderWaiting(actionArea, turnInfo, 'Соперник отвечает...');
}

function handleTurnResult(data) {
    // Обновляем HP
    const myData = data.players[gameState.playerIdx];
    const oppData = data.players[1 - gameState.playerIdx];
    gameState.player.hp = myData.hp;
    gameState.player.combo = myData.combo;
    gameState.player.specialCharges = myData.specialCharges;
    gameState.opponent.hp = oppData.hp;
    gameState.opponent.combo = oppData.combo;
    gameState.opponent.specialCharges = oppData.specialCharges;

    // Обновляем HP-бары
    updateBatyrHP('left',
        gameState.playerSide === 'left' ? gameState.player.hp : gameState.opponent.hp, 100);
    updateBatyrHP('right',
        gameState.playerSide === 'right' ? gameState.player.hp : gameState.opponent.hp, 100);

    // Анимация урона
    if (data.damage > 0 && data.targetSide) {
        animateBatyrHit(data.targetSide);
        showDamageFloat(data.targetSide, data.damage, data.isCrit);
    }

    // Комбо-бар
    const comboBar = document.getElementById('arena-combo-bar');
    updateComboBar(comboBar, gameState.player.combo);

    // Показать результат хода
    const turnInfo = document.getElementById('arena-turn-info');
    if (turnInfo) {
        if (!data.correct && data.correctAnswer) {
            turnInfo.textContent = data.timeout
                ? `Время вышло! Ответ: ${data.correctAnswer}`
                : `Неверно! Правильный ответ: ${data.correctAnswer}`;
            turnInfo.classList.add('turn-info--wrong');
            setTimeout(() => turnInfo.classList.remove('turn-info--wrong'), 1500);
        } else if (data.correct) {
            if (data.isCrit) {
                turnInfo.textContent = 'Парирование! Урона нет!';
            } else if (data.damage > 0) {
                turnInfo.textContent = `Правильно, но поздно... −${data.damage} HP`;
            } else {
                turnInfo.textContent = 'Правильно!';
            }
            turnInfo.classList.add('turn-info--correct');
            setTimeout(() => turnInfo.classList.remove('turn-info--correct'), 1500);
        }
    }
}

function handleNewTurn(data) {
    gameState.attackerIdx = data.attackerIdx;

    // Обновить данные
    for (let i = 0; i < 2; i++) {
        const target = i === gameState.playerIdx ? gameState.player : gameState.opponent;
        target.hp = data.players[i].hp;
        target.combo = data.players[i].combo;
        target.specialCharges = data.players[i].specialCharges;
    }
}

function handleGameOver(data) {
    gameState.status = 'over';
    clearDefenseTimer();

    const container = document.getElementById('battle-container');
    if (container) {
        if (!data.winner) {
            // Анимация поражения
            animateBatyrDefeat(gameState.playerSide);
        } else {
            const oppSide = gameState.playerSide === 'left' ? 'right' : 'left';
            animateBatyrDefeat(oppSide);
        }

        setTimeout(() => {
            renderResult(container, {
                winner: data.winner,
                correctAnswers: data.correctAnswers,
                maxCombo: data.maxCombo,
                crits: data.crits
            });

            // Кнопка «Ещё раз»
            const againBtn = container.querySelector('#battle-again-btn');
            if (againBtn) {
                againBtn.addEventListener('click', () => {
                    renderGamesMenu(container);
                    bindGamesMenuEvents(container);
                });
            }

            // Достижение
            if (data.winner) {
                unlockAchievement('battle_winner');
                recordActivity();
            }
        }, 1500);
    }
}

function handleSpecialUsed(data) {
    const isMe = data.playerIdx === gameState.playerIdx;
    const target = isMe ? gameState.player : gameState.opponent;
    target.specialCharges = data.specialCharges;

    // Обновить кнопки спецприёмов если это наш игрок
    if (isMe) {
        updateSpecialButtons();
    }
}

function handleOpponentLeft() {
    gameState.status = 'over';
    clearDefenseTimer();

    const container = document.getElementById('battle-container');
    if (container) {
        renderResult(container, {
            winner: true,
            correctAnswers: 0,
            maxCombo: 0,
            crits: 0
        });
        const turnInfo = container.querySelector('.result-title');
        if (turnInfo) turnInfo.textContent = 'Соперник покинул игру!';
        const againBtn = container.querySelector('#battle-again-btn');
        if (againBtn) {
            againBtn.addEventListener('click', () => {
                renderGamesMenu(container);
                bindGamesMenuEvents(container);
            });
        }
    }
}

// =====================================================
// Таймер защиты
// =====================================================
function startDefenseTimer(seconds) {
    clearDefenseTimer();
    const timerBar = document.getElementById('defend-timer-bar');
    if (!timerBar) return;

    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';

    // Принудительный reflow
    timerBar.offsetHeight;

    timerBar.style.transition = `width ${seconds}s linear`;
    timerBar.style.width = '0%';
}

function clearDefenseTimer() {
    if (defenseTimerInterval) {
        clearInterval(defenseTimerInterval);
        defenseTimerInterval = null;
    }
}

// =====================================================
// Спецприёмы — привязка кнопок
// =====================================================
function bindSpecialButtons() {
    // Кнопки спецприёмов — в нижней панели арены
    document.querySelectorAll('#arena-specials .special-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const special = btn.dataset.special;
            if (socket && gameState.status !== 'over') {
                socket.emit('use_special', { special });
            }
        });
    });
}

function updateSpecialButtons() {
    const charges = gameState.player.specialCharges;
    document.querySelectorAll('#arena-specials .special-btn').forEach((btn, i) => {
        if (i >= charges) {
            btn.classList.add('special-btn--used');
            btn.disabled = true;
        }
    });
}
