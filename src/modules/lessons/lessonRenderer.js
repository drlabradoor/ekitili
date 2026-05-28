// Рендеринг экрана «Уроки» (путь батыра)
// Дизайн-референс: design-handoff/project/screens_path.jsx
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { showLesson } from './lessons.js';

// Геометрия пути (мобильная ширина)
const PATH_W = 360;
const NODE_SPACING = 110;
const PATH_AMP = PATH_W * 0.28;
const PAD_TOP = 120;
const PAD_BOTTOM = 120;

function nodePos(i) {
    return {
        x: PATH_W / 2 + Math.sin(i * 0.85) * PATH_AMP,
        y: PAD_TOP + i * NODE_SPACING
    };
}

function yurtSvg(size = 60, color = '#8a5c28') {
    return `<svg viewBox="0 0 80 60" width="${size}" height="${size * 60 / 80}" aria-hidden="true">
        <path d="M10 55 L10 35 Q10 20 40 12 Q70 20 70 35 L70 55 Z" fill="${color}" opacity="0.7"/>
        <path d="M10 35 Q40 25 70 35" stroke="#3d2817" stroke-width="1.5" fill="none" opacity="0.5"/>
        <rect x="34" y="40" width="12" height="15" fill="#3d2817" opacity="0.6"/>
        <line x1="40" y1="12" x2="40" y2="6" stroke="#3d2817" stroke-width="1.5"/>
    </svg>`;
}

function fallenSwordSvg(size = 44, color = '#7a4a1c', rotate = -30) {
    return `<svg viewBox="0 0 40 10" width="${size}" height="${size * 0.25}" style="transform: rotate(${rotate}deg)" aria-hidden="true">
        <rect x="2" y="4" width="25" height="2.5" fill="${color}" opacity="0.55"/>
        <polygon points="27,3 34,5 27,7" fill="${color}" opacity="0.55"/>
        <rect x="0" y="3" width="3" height="4" fill="#3d2817" opacity="0.6"/>
    </svg>`;
}

function fallenHelmetSvg(size = 28, color = '#7a4a1c') {
    return `<svg viewBox="0 0 30 24" width="${size}" height="${size * 24 / 30}" aria-hidden="true">
        <path d="M4 18 Q4 6 15 6 Q26 6 26 18 L26 22 L4 22 Z" fill="${color}" opacity="0.55"/>
        <line x1="15" y1="6" x2="15" y2="2" stroke="#3d2817" stroke-width="1.5" opacity="0.7"/>
        <circle cx="15" cy="2" r="1.5" fill="#3d2817" opacity="0.7"/>
    </svg>`;
}

function steppeBgSvg(totalH) {
    let hills = '';
    for (let i = 0; i < Math.ceil(totalH / 220) + 1; i++) {
        const y = 80 + i * 220;
        hills += `<path d="M0 ${y + 40} Q${PATH_W * 0.3} ${y} ${PATH_W * 0.5} ${y + 60} T${PATH_W} ${y + 40} L${PATH_W} ${y + 140} L0 ${y + 140} Z"
                       fill="${i % 2 ? '#c9a86a' : '#a67d3e'}" opacity="0.18"/>`;
    }
    let mountains = '';
    for (let i = 0; i < Math.ceil(totalH / 400) + 1; i++) {
        const y = 400 + i * 400;
        mountains += `<path d="M0 ${y} L${PATH_W * 0.18} ${y - 70} L${PATH_W * 0.3} ${y - 20} L${PATH_W * 0.48} ${y - 90} L${PATH_W * 0.65} ${y - 30} L${PATH_W * 0.82} ${y - 80} L${PATH_W} ${y - 20} L${PATH_W} ${y + 20} L0 ${y + 20} Z"
                          fill="#7a4a1c" opacity="0.1"/>`;
    }
    return `<svg class="path-bg-hills" viewBox="0 0 ${PATH_W} ${totalH}" preserveAspectRatio="none" aria-hidden="true">
        ${hills}
        ${mountains}
    </svg>`;
}

function pathLineSvg(positions, totalH) {
    if (positions.length === 0) return '';
    const d = positions.map((p, i) =>
        i === 0
            ? `M${p.x} ${p.y}`
            : `Q${(positions[i - 1].x + p.x) / 2} ${(positions[i - 1].y + p.y) / 2 + 20} ${p.x} ${p.y}`
    ).join(' ');
    return `<svg class="path-bg-line" width="${PATH_W}" height="${totalH}" aria-hidden="true">
        <path d="${d}" stroke="var(--secondary-deep)" stroke-width="4" fill="none"
              stroke-dasharray="2 10" stroke-linecap="round" opacity="0.55"/>
    </svg>`;
}

// Декорации позиционируются в процентах от полной ширины контейнера,
// чтобы юрты/мечи разлетались по всему фону, а не толпились в центре.
function scatterDecorations(totalH) {
    const decorations = [];
    const kinds = ['yurt', 'sword', 'helmet'];
    const slots = Math.floor(totalH / 200);
    for (let i = 0; i < slots; i++) {
        const kind = kinds[i % kinds.length];
        // Слегка отодвигаем от центра, где идёт дорога с узлами.
        const isLeft = i % 2 === 0;
        const xPct = isLeft ? 6 + (i * 5) % 14 : 78 + (i * 3) % 12;
        const y = 200 + i * 200 + ((i * 37) % 80);
        const rot = ((i * 19) % 40) - 20;
        const scale = 0.75 + ((i * 7) % 5) * 0.09;
        const svg = kind === 'yurt' ? yurtSvg(64 * scale)
            : kind === 'sword' ? fallenSwordSvg(56 * scale, '#7a4a1c', rot)
                : fallenHelmetSvg(36 * scale);
        decorations.push(`<div class="path-scatter" style="left:${xPct}%;top:${y}px">${svg}</div>`);
    }
    return decorations.join('');
}

export function renderLessonsPath() {
    const lessonsPath = document.querySelector('#tab-lessons .lessons-path');
    if (!lessonsPath) return;

    lessonsPath.classList.add('path-screen');
    lessonsPath.innerHTML = '';

    // Определяем текущий урок: первый со статусом null (активен), затем первый false (заблокирован).
    let currentIdx = lessonsProgress.findIndex(p => p === null);
    if (currentIdx === -1) currentIdx = lessonsProgress.findIndex(p => p === false);

    const positions = lessonsData.map((_, i) => nodePos(i));
    const naturalH = positions.length
        ? positions[positions.length - 1].y + PAD_BOTTOM
        : 200;
    // Always fill at least the viewport so hills + scatter cover the screen
    // even when there are very few lessons.
    const minScreenH = Math.max(900, (window.innerHeight || 800) - 60);
    const totalH = Math.max(naturalH, minScreenH);

    // Full-width steppe canvas; nodes live in a centered 360-wide inner layer.
    const canvas = document.createElement('div');
    canvas.className = 'path-canvas';
    canvas.style.height = totalH + 'px';

    const bgLayer = document.createElement('div');
    bgLayer.className = 'path-bg-layer';
    bgLayer.innerHTML = steppeBgSvg(totalH) + scatterDecorations(totalH);
    canvas.appendChild(bgLayer);

    const inner = document.createElement('div');
    inner.className = 'path-canvas-inner';
    inner.style.width = PATH_W + 'px';
    inner.style.height = totalH + 'px';
    inner.innerHTML = pathLineSvg(positions, totalH);

    // Lesson nodes
    lessonsData.forEach((lesson, i) => {
        const pos = positions[i];
        let state = 'locked';
        if (lessonsProgress[i] === true) state = 'done';
        else if (i === currentIdx) state = 'current';

        const node = document.createElement('div');
        node.className = `path-node path-node--${state}`;
        node.style.left = pos.x + 'px';
        node.style.top = pos.y + 'px';

        const icon = state === 'done' ? '★' : state === 'locked' ? '?' : '★';
        const tooltip = state === 'current'
            ? '<div class="path-tooltip">НАЧАТЬ<div class="path-tooltip-arrow"></div></div>'
            : '';

        node.innerHTML = `
            ${tooltip}
            <button class="path-node-btn" type="button" ${state === 'locked' ? 'disabled' : ''} aria-label="${lesson.title}">
                <span class="path-node-icon" aria-hidden="true">${icon}</span>
            </button>
            <div class="path-node-label">${lesson.title}</div>
        `;
        if (state !== 'locked') {
            node.querySelector('.path-node-btn').addEventListener('click', () => showLesson(i));
        }
        inner.appendChild(node);
    });

    // Batyr mascot bobbing next to current node
    if (currentIdx >= 0 && currentIdx < lessonsData.length) {
        const p = positions[currentIdx];
        const dir = p.x < PATH_W / 2 ? 1 : -1;
        const mascot = document.createElement('div');
        mascot.className = 'path-mascot bob';
        mascot.style.left = (p.x + dir * 54) + 'px';
        mascot.style.top = (p.y - 24) + 'px';
        mascot.innerHTML = `<img src="assets/images/horse_happy.png" alt="" class="mascot-shadow">`;
        inner.appendChild(mascot);
    }

    canvas.appendChild(inner);
    lessonsPath.appendChild(canvas);
}
