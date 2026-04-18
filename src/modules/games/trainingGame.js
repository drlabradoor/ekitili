// Соло-режим тренировки: механика батла без соперника
import { userFlashcards } from '../../data/flashcards.js';
import { getCardSVG } from './battleRenderer.js';
import { getApiBaseUrl } from '../../services/auth.js';

const TRAINING_INITIAL_HP  = 100;
const TRAINING_MAX_DAMAGE  = 25;
const TRAINING_MAX_TIMER   = 10;   // сек, первый ход
const TRAINING_MIN_TIMER   = 2;    // сек, минимум
const TRAINING_TIMER_DECAY = 1;    // убывание таймера за ход
const TRAINING_NUM_OPTIONS = 4;
const MIN_PARRY_WINDOW     = 1;    // сек
const MAX_PARRY_WINDOW     = 2;    // сек

let trainingState = null;
let timerTimeout  = null;
let countInterval = null;

// =====================================================
// Вспомогательные функции
// =====================================================
function getTimerSeconds(turn) {
    return Math.max(TRAINING_MAX_TIMER - (turn - 1) * TRAINING_TIMER_DECAY, TRAINING_MIN_TIMER);
}

function getParryWindow(timerSeconds) {
    const t = (timerSeconds - TRAINING_MIN_TIMER) / (TRAINING_MAX_TIMER - TRAINING_MIN_TIMER);
    return MIN_PARRY_WINDOW + t * (MAX_PARRY_WINDOW - MIN_PARRY_WINDOW);
}

function calcDamage(responseTime, timerSeconds) {
    const pw = getParryWindow(timerSeconds);
    if (responseTime <= pw)      return 0;  // парирование / крит
    if (responseTime <= pw + 1)  return 10;
    if (responseTime <= pw + 2)  return 15;
    return TRAINING_MAX_DAMAGE;
}

function generateOptions(card, allCards) {
    const correct = card.front;
    const distractors = allCards
        .filter(c => c.front !== correct)
        .sort(() => Math.random() - 0.5)
        .slice(0, TRAINING_NUM_OPTIONS - 1)
        .map(c => c.front);
    return [...distractors, correct].sort(() => Math.random() - 0.5);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function clearTimers() {
    if (timerTimeout)  { clearTimeout(timerTimeout);   timerTimeout  = null; }
    if (countInterval) { clearInterval(countInterval); countInterval = null; }
}

// =====================================================
// Инициализация тренировки
// =====================================================
export function initTraining(container) {
    clearTimers();

    const cards = [...userFlashcards].sort((a, b) => {
        // Самые запомненные (высокий srsLevel) идут первыми
        if (b.srsLevel !== a.srsLevel) return b.srsLevel - a.srsLevel;
        // При равном уровне — сначала те, где меньше ошибок
        return (a.stats?.incorrect || 0) - (b.stats?.incorrect || 0);
    });

    if (cards.length < 6) {
        container.innerHTML = `
            <div class="battle-lobby">
                <div class="battle-title">Тренировка</div>
                <div class="battle-subtitle">Нужно минимум 6 карточек</div>
                <p style="text-align:center;color:#64748b;padding:0 1rem">
                    Изучи карточки во вкладке «Карточки», прежде чем начать тренировку.
                </p>
                <button class="battle-cancel-btn" id="training-back-btn">← Назад</button>
            </div>`;
        container.querySelector('#training-back-btn')?.addEventListener('click', () => {
            import('./battle.js').then(m => m.renderBattleTab());
        });
        return;
    }

    trainingState = {
        cards,
        cardIndex: 0,
        hp: TRAINING_INITIAL_HP,
        turn: 1,
        correctAnswers: 0,
        crits: 0,
        currentCombo: 0,
        maxCombo: 0,
        totalTurns: 0,
        defenseStartTime: null,
        currentCard: null,
        currentTimerSeconds: null
    };

    showTrainingCard(container);
}

// =====================================================
// Рендер карточки
// =====================================================
function showTrainingCard(container) {
    clearTimers();
    const s = trainingState;
    const card = s.cards[s.cardIndex];
    const timerSeconds = getTimerSeconds(s.turn);
    const options = generateOptions(card, s.cards);

    s.currentCard = card;
    s.currentTimerSeconds = timerSeconds;
    s.defenseStartTime = Date.now();

    const hpPercent = Math.max(0, (s.hp / TRAINING_INITIAL_HP) * 100);
    const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#f59e0b' : '#ef4444';

    container.innerHTML = `
        <div class="training-arena">
            <div class="training-header">
                <div class="training-hp-wrap">
                    <span class="training-hp-label">HP: ${s.hp}</span>
                    <div class="training-hp-bar-bg">
                        <div class="training-hp-bar" style="width:${hpPercent}%;background:${hpColor}"></div>
                    </div>
                </div>
                <div class="training-turn-label">Ход ${s.turn}</div>
            </div>
            <div class="defend-phase">
                <div class="defend-incoming-card">
                    <div class="defend-card-svg">${getCardSVG(card.svgShape)}</div>
                    <div class="defend-card-label">${escapeHtml(card.back)}</div>
                </div>
                <div class="training-timer-info">
                    Осталось: <span id="training-timer-val">${timerSeconds}</span> сек
                </div>
                <div class="defend-timer">
                    <div class="defend-timer-bar" id="defend-timer-bar"></div>
                </div>
                <div class="defend-options">
                    ${options.map((opt, i) => `
                        <button class="defend-option-btn" data-index="${i}">${escapeHtml(opt)}</button>
                    `).join('')}
                </div>
            </div>
        </div>`;

    // Анимация таймер-бара
    const timerBar = container.querySelector('#defend-timer-bar');
    if (timerBar) {
        timerBar.style.transition = 'none';
        timerBar.style.width = '100%';
        timerBar.offsetHeight; // принудительный reflow
        timerBar.style.transition = `width ${timerSeconds}s linear`;
        timerBar.style.width = '0%';
    }

    // Обратный отсчёт
    let remaining = timerSeconds;
    const timerVal = container.querySelector('#training-timer-val');
    countInterval = setInterval(() => {
        remaining--;
        if (timerVal && remaining >= 0) timerVal.textContent = remaining;
        if (remaining <= 0) clearInterval(countInterval);
    }, 1000);

    // Автотаймаут
    timerTimeout = setTimeout(() => {
        clearTimers();
        handleAnswer(container, null);
    }, timerSeconds * 1000);

    // Привязка кнопок
    container.querySelectorAll('.defend-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            clearTimers();
            const answer = btn.textContent;
            container.querySelectorAll('.defend-option-btn').forEach(b => b.disabled = true);
            btn.classList.add('defend-option--selected');
            handleAnswer(container, answer);
        });
    });
}

// =====================================================
// Обработка ответа
// =====================================================
function handleAnswer(container, answer) {
    const s = trainingState;
    const card = s.currentCard;
    const responseTime = (Date.now() - s.defenseStartTime) / 1000;
    const isTimeout = answer === null;
    const isCorrect = !isTimeout && answer === card.front;

    let damage;
    let isCrit = false;

    if (isCorrect) {
        damage = calcDamage(responseTime, s.currentTimerSeconds);
        isCrit = damage === 0;
        s.correctAnswers++;
        if (isCrit) s.crits++;
        s.currentCombo++;
        if (s.currentCombo > s.maxCombo) s.maxCombo = s.currentCombo;
    } else {
        damage = TRAINING_MAX_DAMAGE;
        s.currentCombo = 0;
    }

    s.hp = Math.max(0, s.hp - damage);
    s.totalTurns++;

    // Показать фидбэк поверх options
    const defendPhase = container.querySelector('.defend-phase');
    if (defendPhase) {
        const fb = document.createElement('div');
        let fbClass = 'training-feedback';
        let fbText;
        if (isTimeout) {
            fbClass += ' training-feedback--wrong';
            fbText = `Время вышло! Ответ: ${card.front}`;
        } else if (!isCorrect) {
            fbClass += ' training-feedback--wrong';
            fbText = `Неверно! Ответ: ${card.front}`;
        } else if (isCrit) {
            fbClass += ' training-feedback--crit';
            fbText = 'Парирование! 0 урона!';
        } else if (damage > 0) {
            fbClass += ' training-feedback--correct';
            fbText = `Правильно, но поздно… −${damage} HP`;
        } else {
            fbClass += ' training-feedback--correct';
            fbText = 'Правильно!';
        }
        fb.className = fbClass;
        fb.textContent = fbText;
        defendPhase.appendChild(fb);
    }

    setTimeout(() => {
        if (s.hp <= 0) {
            showResult(container);
        } else {
            s.cardIndex = (s.cardIndex + 1) % s.cards.length;
            s.turn++;
            showTrainingCard(container);
        }
    }, 1200);
}

// =====================================================
// Экран результата
// =====================================================
function showResult(container) {
    const s = trainingState;
    const score = s.correctAnswers * 10 + s.crits * 5;
    // total_questions = максимально возможные очки (15 за крит на каждый ход)
    const totalMax = Math.max(s.totalTurns * 15, score);

    container.innerHTML = `
        <div class="battle-result battle-result--lose">
            <div class="result-title">Тренировка завершена!</div>
            <div class="result-icon" style="font-size:2.5rem">&#127989;</div>
            <div class="result-stats">
                <div class="result-stat">
                    <span class="result-stat-label">Правильных ответов</span>
                    <span class="result-stat-value">${s.correctAnswers}</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Макс. комбо</span>
                    <span class="result-stat-value">${s.maxCombo}</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Критических парирований</span>
                    <span class="result-stat-value">${s.crits}</span>
                </div>
                <div class="result-stat result-stat--highlight">
                    <span class="result-stat-label">Очки</span>
                    <span class="result-stat-value">${score} ★</span>
                </div>
            </div>
            <button class="battle-find-btn" id="training-again-btn">
                <i class="fas fa-redo"></i> Ещё раз
            </button>
            <button class="battle-cancel-btn" id="training-menu-btn" style="margin-top:0.5rem">
                ← В меню
            </button>
        </div>`;

    submitScore(score, totalMax);

    container.querySelector('#training-again-btn')?.addEventListener('click', () => {
        initTraining(container);
    });
    container.querySelector('#training-menu-btn')?.addEventListener('click', () => {
        import('./battle.js').then(m => m.renderBattleTab());
    });
}

// =====================================================
// Отправка результата в лидерборд
// =====================================================
async function submitScore(score, totalQuestions) {
    if (score === 0) return;
    try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/test-result`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score, total_questions: totalQuestions })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('[Training] score submit failed:', err);
        }
    } catch (e) {
        console.warn('[Training] score submit error:', e);
    }
}
