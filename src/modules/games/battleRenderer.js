// Рендерер экранов батла: лобби, арена, результат
import { createBatyrSVG, updateBatyrHP, renderSpecialsPanel } from './batyrAvatar.js';

// =====================================================
// SVG-фигуры для карточек (плоский дизайн)
// =====================================================
const SVG_SHAPES = {
    wave: `<svg viewBox="0 0 60 60"><path d="M8 35 Q15 25 22 35 Q29 45 36 35 Q43 25 52 35" stroke="#3b82f6" stroke-width="4" fill="none"/><circle cx="10" cy="42" r="3" fill="#60a5fa"/></svg>`,
    book: `<svg viewBox="0 0 60 60"><rect x="12" y="10" width="36" height="40" rx="3" fill="#8b5cf6"/><rect x="15" y="13" width="30" height="34" rx="2" fill="#c4b5fd"/><line x1="30" y1="13" x2="30" y2="47" stroke="#8b5cf6" stroke-width="2"/></svg>`,
    water: `<svg viewBox="0 0 60 60"><path d="M30 10 Q20 30 30 45 Q40 30 30 10Z" fill="#38bdf8"/><ellipse cx="30" cy="46" rx="12" ry="4" fill="#0ea5e9"/></svg>`,
    heart: `<svg viewBox="0 0 60 60"><path d="M30 50 C10 35 5 20 18 14 C25 10 30 18 30 18 C30 18 35 10 42 14 C55 20 50 35 30 50Z" fill="#f43f5e"/></svg>`,
    shield: `<svg viewBox="0 0 60 60"><path d="M30 8L10 18v14c0 12 8 22 20 26 12-4 20-14 20-26V18L30 8z" fill="#2563eb"/><path d="M30 14L16 22v10c0 8 6 16 14 19 8-3 14-11 14-19V22L30 14z" fill="#60a5fa"/></svg>`,
    house: `<svg viewBox="0 0 60 60"><polygon points="30,10 8,30 52,30" fill="#f59e0b"/><rect x="15" y="30" width="30" height="22" fill="#fbbf24"/><rect x="25" y="38" width="10" height="14" fill="#92400e"/></svg>`,
    people: `<svg viewBox="0 0 60 60"><circle cx="22" cy="18" r="7" fill="#6366f1"/><circle cx="38" cy="18" r="7" fill="#a78bfa"/><rect x="14" y="28" width="16" height="20" rx="4" fill="#6366f1"/><rect x="30" y="28" width="16" height="20" rx="4" fill="#a78bfa"/></svg>`,
    road: `<svg viewBox="0 0 60 60"><polygon points="20,55 40,55 35,5 25,5" fill="#64748b"/><line x1="30" y1="10" x2="30" y2="18" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,4"/><line x1="30" y1="26" x2="30" y2="34" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,4"/><line x1="30" y1="42" x2="30" y2="50" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4,4"/></svg>`,
    sun: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="12" fill="#facc15"/><g stroke="#facc15" stroke-width="3"><line x1="30" y1="6" x2="30" y2="14"/><line x1="30" y1="46" x2="30" y2="54"/><line x1="6" y1="30" x2="14" y2="30"/><line x1="46" y1="30" x2="54" y2="30"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="41" y1="41" x2="47" y2="47"/><line x1="47" y1="13" x2="41" y2="19"/><line x1="19" y1="41" x2="13" y2="47"/></g></svg>`,
    speech: `<svg viewBox="0 0 60 60"><rect x="8" y="10" width="44" height="30" rx="8" fill="#10b981"/><polygon points="18,40 24,40 14,52" fill="#10b981"/><line x1="18" y1="22" x2="42" y2="22" stroke="#fff" stroke-width="2"/><line x1="18" y1="30" x2="34" y2="30" stroke="#fff" stroke-width="2"/></svg>`,
    school: `<svg viewBox="0 0 60 60"><rect x="10" y="22" width="40" height="30" fill="#f97316"/><polygon points="30,8 6,22 54,22" fill="#fb923c"/><rect x="16" y="28" width="8" height="8" fill="#fef3c7"/><rect x="36" y="28" width="8" height="8" fill="#fef3c7"/><rect x="25" y="38" width="10" height="14" fill="#92400e"/></svg>`,
    person: `<svg viewBox="0 0 60 60"><circle cx="30" cy="18" r="10" fill="#6366f1"/><rect x="18" y="30" width="24" height="24" rx="6" fill="#818cf8"/></svg>`,
    city: `<svg viewBox="0 0 60 60"><rect x="6" y="24" width="14" height="30" fill="#64748b"/><rect x="24" y="12" width="14" height="42" fill="#475569"/><rect x="42" y="20" width="14" height="34" fill="#64748b"/><rect x="9" y="28" width="4" height="4" fill="#fef08a"/><rect x="9" y="36" width="4" height="4" fill="#fef08a"/><rect x="27" y="18" width="4" height="4" fill="#fef08a"/><rect x="33" y="18" width="4" height="4" fill="#fef08a"/><rect x="27" y="28" width="4" height="4" fill="#fef08a"/><rect x="45" y="26" width="4" height="4" fill="#fef08a"/></svg>`,
    child: `<svg viewBox="0 0 60 60"><circle cx="30" cy="16" r="9" fill="#f472b6"/><rect x="20" y="28" width="20" height="18" rx="6" fill="#fb7185"/><rect x="22" y="46" width="6" height="10" rx="2" fill="#475569"/><rect x="32" y="46" width="6" height="10" rx="2" fill="#475569"/></svg>`
};

/**
 * Получить SVG-фигуру по ключу
 */
export function getCardSVG(svgShape) {
    return SVG_SHAPES[svgShape] || `<svg viewBox="0 0 60 60"><rect x="10" y="10" width="40" height="40" rx="6" fill="#94a3b8"/><text x="30" y="36" text-anchor="middle" fill="#fff" font-size="16">?</text></svg>`;
}

// =====================================================
// Экран: Лобби
// =====================================================
export function renderLobby(container, username) {
    container.innerHTML = `
        <div class="battle-lobby">
            <div class="battle-title">Батыр Батл</div>
            <div class="battle-subtitle">Онлайн-дуэль на знание казахского</div>
            <div class="lobby-avatar-preview">
                ${createBatyrSVG({ side: 'left', username: username || 'Ты', hp: 100, maxHp: 100, specialCharges: 3 })}
            </div>
            <button class="battle-find-btn" id="battle-find-btn">
                <i class="fas fa-search"></i> Найти соперника
            </button>
            <div class="battle-rules">
                <div class="rules-title">Правила:</div>
                <ul>
                    <li>Атакующий выбирает карту и бросает в соперника</li>
                    <li>Защищающийся выбирает слово на казахском</li>
                    <li>0-2 сек = парирование (0 урона) | 2-3 сек = 10 урона | 3-4 сек = 15 урона | 4+ сек = 25 урона</li>
                    <li>Ошибка или таймаут = максимум 25 урона. 3 подряд = +50% комбо</li>
                    <li>Спецприёмы: Щит, Мороз, Двойной удар (по 3 каждому)</li>
                </ul>
            </div>
        </div>`;
}

// =====================================================
// Экран: Поиск соперника
// =====================================================
export function renderSearching(container) {
    container.innerHTML = `
        <div class="battle-searching">
            <div class="battle-title">Поиск соперника...</div>
            <div class="searching-animation">
                <div class="searching-spinner"></div>
            </div>
            <button class="battle-cancel-btn" id="battle-cancel-btn">Отменить</button>
        </div>`;
}

// =====================================================
// Экран: Арена
// =====================================================
export function renderArena(container, state) {
    const { player, opponent, playerSide } = state;
    const oppSide = playerSide === 'left' ? 'right' : 'left';

    container.innerHTML = `
        <div class="battle-arena">
            <div class="arena-top">
                <div class="arena-batyr arena-batyr--left">
                    ${createBatyrSVG({
                        side: 'left',
                        username: playerSide === 'left' ? player.username : opponent.username,
                        hp: playerSide === 'left' ? player.hp : opponent.hp,
                        maxHp: 100,
                        specialCharges: playerSide === 'left' ? player.specialCharges : opponent.specialCharges
                    })}
                </div>
                <div class="arena-vs">VS</div>
                <div class="arena-batyr arena-batyr--right">
                    ${createBatyrSVG({
                        side: 'right',
                        username: playerSide === 'right' ? player.username : opponent.username,
                        hp: playerSide === 'right' ? player.hp : opponent.hp,
                        maxHp: 100,
                        specialCharges: playerSide === 'right' ? player.specialCharges : opponent.specialCharges
                    })}
                </div>
            </div>
            <div class="arena-center">
                <div class="arena-turn-info" id="arena-turn-info">Подготовка...</div>
                <div class="arena-action-area" id="arena-action-area"></div>
            </div>
            <div class="arena-combo-bar" id="arena-combo-bar"></div>
            <div class="arena-specials" id="arena-specials">
                ${renderSpecialsPanel(player.specialCharges)}
            </div>
        </div>`;
}

// =====================================================
// Рендер фазы атаки: 3 карты на выбор
// =====================================================
export function renderAttackPhase(actionArea, hand, turnInfo) {
    turnInfo.textContent = 'Твой ход! Выбери карту для атаки:';
    actionArea.innerHTML = `
        <div class="attack-cards">
            ${hand.map((card, i) => `
                <div class="attack-card" data-index="${i}">
                    <div class="attack-card-svg">${getCardSVG(card.svgShape)}</div>
                    <div class="attack-card-word">${escapeHtml(card.front)}</div>
                </div>
            `).join('')}
        </div>`;
}

// =====================================================
// Рендер фазы защиты: карта + 4 варианта + таймер
// =====================================================
export function renderDefendPhase(actionArea, turnInfo, card, options, timerSeconds) {
    turnInfo.textContent = 'Что это? Выбери казахское слово:';
    const hint = card.back ? `<div class="defend-hint" id="defend-hint" style="opacity: 0; transition: opacity 0.3s ease;">${escapeHtml(card.back)}</div>` : '';
    actionArea.innerHTML = `
        <div class="defend-phase">
            <div class="defend-incoming-card">
                <div class="defend-card-svg">${getCardSVG(card.svgShape)}</div>
                ${hint}
            </div>
            <div class="defend-timer">
                <div class="defend-timer-bar" id="defend-timer-bar"></div>
            </div>
            <div class="defend-options">
                ${options.map((opt, i) => `
                    <button class="defend-option-btn" data-index="${i}">${escapeHtml(opt)}</button>
                `).join('')}
            </div>
        </div>`;

    // Показать подсказку после 2 сек парирования
    if (card.back) {
        setTimeout(() => {
            const hintEl = document.getElementById('defend-hint');
            if (hintEl) hintEl.style.opacity = '1';
        }, 2000);
    }
}

// =====================================================
// Рендер ожидания хода соперника
// =====================================================
export function renderWaiting(actionArea, turnInfo, message) {
    turnInfo.textContent = message || 'Ожидание соперника...';
    actionArea.innerHTML = `
        <div class="waiting-phase">
            <div class="waiting-spinner"></div>
        </div>`;
}

// =====================================================
// Обновить комбо-бар
// =====================================================
export function updateComboBar(comboBarEl, combo) {
    if (!comboBarEl) return;
    if (combo >= 3) {
        comboBarEl.innerHTML = `<div class="combo-active">COMBO x${combo}! (+50% урон)</div>`;
    } else if (combo > 0) {
        comboBarEl.innerHTML = `<div class="combo-building">${'&#9733;'.repeat(combo)} ${3 - combo} до комбо</div>`;
    } else {
        comboBarEl.innerHTML = '';
    }
}

// =====================================================
// Экран: Результат
// =====================================================
export function renderResult(container, result) {
    const isWin = result.winner;
    container.innerHTML = `
        <div class="battle-result ${isWin ? 'battle-result--win' : 'battle-result--lose'}">
            <div class="result-title">${isWin ? 'Победа!' : 'Поражение'}</div>
            <div class="result-icon">${isWin ? '&#9876;' : '&#9760;'}</div>
            <div class="result-stats">
                <div class="result-stat">
                    <span class="result-stat-label">Правильных ответов</span>
                    <span class="result-stat-value">${result.correctAnswers || 0}</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Макс. комбо</span>
                    <span class="result-stat-value">${result.maxCombo || 0}</span>
                </div>
                <div class="result-stat">
                    <span class="result-stat-label">Критических ударов</span>
                    <span class="result-stat-value">${result.crits || 0}</span>
                </div>
            </div>
            <button class="battle-find-btn" id="battle-again-btn">
                <i class="fas fa-redo"></i> Ещё раз
            </button>
        </div>`;
}

// =====================================================
// Показать получение урона (flash-текст)
// =====================================================
export function showDamageFloat(side, damage, isCrit) {
    const batyrEl = document.querySelector(`.batyr--${side}`);
    if (!batyrEl) return;
    const floater = document.createElement('div');
    floater.className = `damage-float ${isCrit ? 'damage-float--crit' : ''}`;
    floater.textContent = `-${damage}`;
    batyrEl.appendChild(floater);
    setTimeout(() => floater.remove(), 1000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
