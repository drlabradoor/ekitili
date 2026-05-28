// Profile BatyrAvatar — layered portrait + gear SVG overlays
// Отдельный от battle/batyrAvatar.js компонент (там HP-бары для боя)

import { userProfile, saveUserProfile } from '../../data/user.js';

const AVATAR_SRCS = {
    horse:   'assets/images/batyr.png',
    eagle:   'assets/images/eagle.png',
    leopard: 'assets/images/leopard.png',
};
const RING_COLORS = ['#cfc2a6', '#bf983a', '#e5b941', '#d97757'];
const PALETTE = ['#2d6a7a', '#bf983a', '#d15f4a', '#8a8578', '#6b8e3d'];

// --- SVG gear components (порты из design-handoff/project/ornaments.jsx) ---

function helmetSVG(color = '#2d6a7a', accent = '#bf983a') {
    return `<svg viewBox="0 0 100 70" width="100%" style="display:block">
        <path d="M18 50 Q15 25 50 18 Q85 25 82 50 L82 55 L18 55 Z" fill="${color}" stroke="#3d2817" stroke-width="3"/>
        <path d="M18 50 L82 50 L82 58 L18 58 Z" fill="${accent}" stroke="#3d2817" stroke-width="3"/>
        <path d="M45 34 Q50 28 55 34 M42 38 Q50 32 58 38 M40 44 L48 38 L50 44 L52 38 L60 44" stroke="${accent}" stroke-width="1.8" fill="none" opacity="0.9"/>
        <circle cx="50" cy="14" r="4" fill="${accent}" stroke="#3d2817" stroke-width="2"/>
        <path d="M50 10 L50 4" stroke="#3d2817" stroke-width="2"/>
    </svg>`;
}

function armorSVG(color = '#7a4a1c', accent = '#bf983a') {
    return `<svg viewBox="0 0 120 80" width="100%" style="display:block">
        <path d="M20 20 Q20 10 35 8 L60 4 L85 8 Q100 10 100 20 L100 70 L20 70 Z" fill="${color}" stroke="#3d2817" stroke-width="3"/>
        <path d="M60 4 L60 70" stroke="#3d2817" stroke-width="2"/>
        <rect x="48" y="20" width="24" height="32" fill="${accent}" stroke="#3d2817" stroke-width="2.5" rx="3"/>
        <path d="M54 28 Q60 22 66 28 M52 34 Q60 26 68 34 M50 42 L58 36 L60 42 L62 36 L70 42" stroke="#3d2817" stroke-width="1.6" fill="none"/>
        <circle cx="30" cy="25" r="4" fill="${accent}" stroke="#3d2817" stroke-width="2"/>
        <circle cx="90" cy="25" r="4" fill="${accent}" stroke="#3d2817" stroke-width="2"/>
    </svg>`;
}

function swordSVG(color = '#bf983a') {
    return `<svg viewBox="0 0 24 90" width="100%" style="display:block">
        <path d="M12 4 L16 10 L16 62 L8 62 L8 10 Z" fill="#e5e0d0" stroke="#3d2817" stroke-width="2.5"/>
        <line x1="12" y1="12" x2="12" y2="58" stroke="#aaa090" stroke-width="1"/>
        <rect x="2" y="62" width="20" height="6" fill="${color}" stroke="#3d2817" stroke-width="2.5" rx="1"/>
        <rect x="8" y="68" width="8" height="16" fill="#7a4a1c" stroke="#3d2817" stroke-width="2.5" rx="1.5"/>
        <circle cx="12" cy="86" r="3" fill="${color}" stroke="#3d2817" stroke-width="2"/>
    </svg>`;
}

function shieldSVG(color = '#2d6a7a', accent = '#bf983a') {
    return `<svg viewBox="0 0 60 70" width="100%" style="display:block">
        <path d="M30 4 L54 10 L54 38 Q54 56 30 66 Q6 56 6 38 L6 10 Z" fill="${color}" stroke="#3d2817" stroke-width="3"/>
        <path d="M30 20 L36 32 L30 44 L24 32 Z" fill="${accent}" stroke="#3d2817" stroke-width="2"/>
        <circle cx="30" cy="32" r="3" fill="#3d2817"/>
    </svg>`;
}

// --- Основной компонент ---

export function createBatyrAvatarEl(size = 84, stage = 0, gear = {}, portrait = 'horse', kind = 'mini') {
    const ringColor = RING_COLORS[Math.min(stage, 3)] || '#bf983a';
    const showArmor   = kind === 'full' && !!gear.armor;
    const showSword   = kind === 'full' && !!gear.sword;
    const showShield  = kind === 'full' && !!gear.shield;
    const showHelmet  = !!gear.helmet;

    const wrap = document.createElement('div');
    wrap.style.cssText = `position:relative;width:${size}px;height:${size}px;display:inline-block;flex-shrink:0`;

    const pct = (stage + 1) * 25;
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;inset:0;border-radius:50%;background:conic-gradient(${ringColor} 0,${ringColor} ${pct}%,rgba(122,74,28,0.15) ${pct}%);padding:${Math.round(size*0.04)}px`;

    const inner = document.createElement('div');
    inner.style.cssText = `width:100%;height:100%;border-radius:50%;background:#f9f6f2;border:${Math.round(size*0.025)}px solid #7a4a1c;overflow:hidden;position:relative`;

    const img = document.createElement('img');
    img.src = AVATAR_SRCS[portrait] || AVATAR_SRCS.horse;
    img.alt = portrait;
    img.style.cssText = `width:100%;height:100%;object-fit:cover;object-position:center 30%`;
    inner.appendChild(img);
    ring.appendChild(inner);
    wrap.appendChild(ring);

    if (showArmor) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:5%;bottom:-18%;width:90%;z-index:3;filter:drop-shadow(0 3px 0 rgba(61,40,23,0.3))`;
        el.innerHTML = armorSVG(gear.armorColor, '#bf983a');
        wrap.appendChild(el);
    }
    if (showSword) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;right:-22%;top:10%;width:28%;z-index:4;transform:rotate(28deg);filter:drop-shadow(0 3px 0 rgba(61,40,23,0.3))`;
        el.innerHTML = swordSVG(gear.swordColor);
        wrap.appendChild(el);
    }
    if (showShield) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:-18%;bottom:5%;width:42%;z-index:4;transform:rotate(-12deg);filter:drop-shadow(0 3px 0 rgba(61,40,23,0.3))`;
        el.innerHTML = shieldSVG(gear.shieldColor, '#bf983a');
        wrap.appendChild(el);
    }
    if (showHelmet) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:8%;top:-22%;width:84%;z-index:5;filter:drop-shadow(0 3px 0 rgba(61,40,23,0.3))`;
        el.innerHTML = helmetSVG(gear.helmetColor, '#bf983a');
        wrap.appendChild(el);
    }

    return wrap;
}

export function updateProfileBatyrAvatar() {
    const container = document.getElementById('profile-batyr-avatar');
    if (!container) return;
    container.innerHTML = '';
    const el = createBatyrAvatarEl(84, userProfile.stage || 0, userProfile.gear || {}, userProfile.portrait || 'horse', 'full');
    container.appendChild(el);
}

// --- Overlay кастомизации ---

export function openCustomizationOverlay() {
    const overlay = document.getElementById('profile-customization-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.style.display = 'flex';

    // Header
    const header = document.createElement('div');
    header.className = 'custom-overlay-header';
    header.innerHTML = `
        <button class="custom-overlay-close" aria-label="Закрыть">✕</button>
        <div class="custom-overlay-title h-display">Кастомизация батыра</div>
        <button class="custom-overlay-done">Готово</button>
    `;
    header.querySelector('.custom-overlay-close').onclick = closeCustomizationOverlay;
    header.querySelector('.custom-overlay-done').onclick  = closeCustomizationOverlay;
    overlay.appendChild(header);

    // Pinned preview
    const preview = document.createElement('div');
    preview.className = 'custom-overlay-preview';
    preview.id = 'custom-batyr-preview';
    _refreshPreview(preview);
    overlay.appendChild(preview);

    // Scrollable options
    const scroll = document.createElement('div');
    scroll.className = 'custom-overlay-scroll';
    scroll.appendChild(_buildMascotSection(preview));
    for (const [slot, icon, label, colorKey] of [
        ['helmet', '⛑', 'Шлем',  'helmetColor'],
        ['armor',  '🦺', 'Броня', 'armorColor'],
        ['sword',  '⚔',  'Меч',   'swordColor'],
        ['shield', '🛡', 'Щит',   'shieldColor'],
    ]) {
        scroll.appendChild(_buildGearRow(slot, icon, label, colorKey, preview));
    }
    overlay.appendChild(scroll);
}

export function closeCustomizationOverlay() {
    const overlay = document.getElementById('profile-customization-overlay');
    if (overlay) overlay.style.display = 'none';
    updateProfileBatyrAvatar();
}

function _refreshPreview(preview) {
    preview.innerHTML = '';
    const el = createBatyrAvatarEl(160, userProfile.stage || 0, userProfile.gear || {}, userProfile.portrait || 'horse', 'full');
    preview.appendChild(el);
}

function _buildMascotSection(preview) {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = `<div class="custom-section-title">— Маскот —</div><div class="custom-mascot-grid"></div>`;

    const grid = section.querySelector('.custom-mascot-grid');
    [['horse','Тұлпар'], ['eagle','Бүркіт'], ['leopard','Барыс']].forEach(([id, label]) => {
        const btn = document.createElement('button');
        btn.className = 'custom-mascot-btn' + (userProfile.portrait === id ? ' selected' : '');
        btn.innerHTML = `<img src="${AVATAR_SRCS[id]}" alt="${label}"/><div>${label}</div>`;
        btn.onclick = () => {
            userProfile.portrait = id;
            saveUserProfile();
            grid.querySelectorAll('.custom-mascot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            _refreshPreview(preview);
        };
        grid.appendChild(btn);
    });
    return section;
}

function _buildGearRow(slot, icon, label, colorKey, preview) {
    const section = document.createElement('div');
    section.className = 'custom-section';

    const gear = userProfile.gear || {};
    const equipped = !!gear[slot];

    section.innerHTML = `
        <div class="custom-gear-header">
            <div class="custom-gear-icon">${icon}</div>
            <div class="custom-gear-meta">
                <div class="custom-gear-name">${label}</div>
                <div class="custom-gear-status">${equipped ? 'Надето' : 'Снято'}</div>
            </div>
            <button class="custom-gear-toggle${equipped ? ' equipped' : ''}">${equipped ? '✓' : 'надеть'}</button>
        </div>
        <div class="custom-color-swatches"></div>
    `;

    const toggleBtn = section.querySelector('.custom-gear-toggle');
    const statusEl  = section.querySelector('.custom-gear-status');

    toggleBtn.onclick = () => {
        const newVal = !userProfile.gear[slot];
        userProfile.gear[slot] = newVal;
        saveUserProfile();
        toggleBtn.textContent = newVal ? '✓' : 'надеть';
        toggleBtn.classList.toggle('equipped', newVal);
        statusEl.textContent = newVal ? 'Надето' : 'Снято';
        _refreshPreview(preview);
    };

    const swatches = section.querySelector('.custom-color-swatches');
    PALETTE.forEach(color => {
        const btn = document.createElement('button');
        const isSel = (userProfile.gear[colorKey] || '') === color;
        btn.className = 'custom-color-btn' + (isSel ? ' selected' : '');
        btn.style.setProperty('--swatch', color);
        btn.onclick = () => {
            userProfile.gear[slot]    = true;
            userProfile.gear[colorKey] = color;
            saveUserProfile();
            swatches.querySelectorAll('.custom-color-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            toggleBtn.textContent = '✓';
            toggleBtn.classList.add('equipped');
            statusEl.textContent = 'Надето';
            _refreshPreview(preview);
        };
        swatches.appendChild(btn);
    });

    return section;
}
