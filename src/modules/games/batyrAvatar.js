// SVG-аватар батыра (казахский воин) — плейсхолдер для будущей кастомизации
// Каждый батыр отображается как силуэт воина со шлемом, бронёй и щитом/мечом.

const COLORS = {
    left: { helmet: '#2563eb', armor: '#3b82f6', shield: '#1d4ed8', accent: '#60a5fa' },
    right: { helmet: '#dc2626', armor: '#ef4444', shield: '#b91c1c', accent: '#f87171' }
};

export function createBatyrSVG({ side = 'left', username = '', hp = 100, maxHp = 100 }) {
    const c = COLORS[side];
    const flip = side === 'right' ? 'transform="scale(-1,1) translate(-120,0)"' : '';
    const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444';

    return `
    <div class="batyr-container batyr--${side}" data-side="${side}">
        <div class="batyr-name">${escapeHtml(username)}</div>
        <svg viewBox="0 0 120 200" class="batyr-svg" xmlns="http://www.w3.org/2000/svg">
            <g ${flip}>
                <!-- Шлем -->
                <ellipse cx="60" cy="35" rx="22" ry="25" fill="${c.helmet}" />
                <rect x="38" y="28" width="44" height="6" rx="2" fill="${c.accent}" />
                <!-- Забрало -->
                <rect x="48" y="38" width="24" height="8" rx="2" fill="#1e293b" opacity="0.6" />
                <!-- Тело / Броня -->
                <rect x="35" y="60" width="50" height="55" rx="6" fill="${c.armor}" />
                <!-- Пояс -->
                <rect x="35" y="100" width="50" height="8" rx="2" fill="${c.shield}" />
                <!-- Наплечники -->
                <ellipse cx="32" cy="65" rx="10" ry="8" fill="${c.shield}" />
                <ellipse cx="88" cy="65" rx="10" ry="8" fill="${c.shield}" />
                <!-- Руки -->
                <rect x="20" y="68" width="12" height="35" rx="4" fill="${c.armor}" />
                <rect x="88" y="68" width="12" height="35" rx="4" fill="${c.armor}" />
                <!-- Меч (правая рука) -->
                <rect x="95" y="55" width="4" height="50" rx="1" fill="#94a3b8" />
                <rect x="91" y="52" width="12" height="5" rx="2" fill="#64748b" />
                <!-- Щит (левая рука) -->
                <ellipse cx="18" cy="85" rx="14" ry="18" fill="${c.shield}" />
                <ellipse cx="18" cy="85" rx="8" ry="10" fill="${c.accent}" opacity="0.5" />
                <!-- Ноги -->
                <rect x="40" y="115" width="16" height="40" rx="4" fill="#475569" />
                <rect x="64" y="115" width="16" height="40" rx="4" fill="#475569" />
                <!-- Сапоги -->
                <rect x="38" y="148" width="20" height="10" rx="3" fill="#334155" />
                <rect x="62" y="148" width="20" height="10" rx="3" fill="#334155" />
            </g>
        </svg>
        <!-- HP бар -->
        <div class="batyr-hp-bar">
            <div class="batyr-hp-fill" style="width:${hpPercent}%;background:${hpColor}"></div>
        </div>
        <div class="batyr-hp-text">${hp} / ${maxHp}</div>
    </div>`;
}

/**
 * Обновить HP бар батыра
 */
export function updateBatyrHP(side, hp, maxHp) {
    const container = document.querySelector(`.batyr--${side}`);
    if (!container) return;
    const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const hpColor = hpPercent > 50 ? '#22c55e' : hpPercent > 25 ? '#eab308' : '#ef4444';
    const fill = container.querySelector('.batyr-hp-fill');
    const text = container.querySelector('.batyr-hp-text');
    if (fill) {
        fill.style.width = hpPercent + '%';
        fill.style.background = hpColor;
    }
    if (text) text.textContent = `${hp} / ${maxHp}`;
}

/**
 * Анимация попадания
 */
export function animateBatyrHit(side) {
    const container = document.querySelector(`.batyr--${side}`);
    if (!container) return;
    container.classList.add('batyr--hit');
    setTimeout(() => container.classList.remove('batyr--hit'), 400);
}

/**
 * Анимация атаки
 */
export function animateBatyrAttack(side) {
    const container = document.querySelector(`.batyr--${side}`);
    if (!container) return;
    container.classList.add('batyr--attack');
    setTimeout(() => container.classList.remove('batyr--attack'), 500);
}

/**
 * Анимация поражения
 */
export function animateBatyrDefeat(side) {
    const container = document.querySelector(`.batyr--${side}`);
    if (!container) return;
    container.classList.add('batyr--defeated');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
