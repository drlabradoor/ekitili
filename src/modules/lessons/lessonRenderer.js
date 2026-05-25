// Рендеринг экрана «Уроки» (путь батыра)
// Дизайн-референс: design-handoff/project/screens_path.jsx
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { showLesson } from './lessons.js';
import { showTest } from './test.js';

// Геометрия пути (мобильная ширина)
const PATH_W = 360;
const NODE_SPACING = 110;
const PATH_AMP = PATH_W * 0.28;
const PAD_TOP = 70;
const PAD_BOTTOM = 120;

function nodePos(i) {
    return {
        x: PATH_W / 2 + Math.sin(i * 0.85) * PATH_AMP,
        y: PAD_TOP + i * NODE_SPACING
    };
}

function shanyrakSvg(size = 26, color = 'var(--gold-soft)') {
    return `<svg viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="30" cy="30" r="26" stroke="${color}" stroke-width="2.5" fill="none"/>
        <circle cx="30" cy="30" r="18" stroke="${color}" stroke-width="1.6" fill="none"/>
        <g stroke="${color}" stroke-width="1.6" fill="none">
            <line x1="30" y1="4" x2="30" y2="56"/>
            <line x1="4" y1="30" x2="56" y2="30"/>
            <line x1="11" y1="11" x2="49" y2="49"/>
            <line x1="49" y1="11" x2="11" y2="49"/>
        </g>
        <circle cx="30" cy="30" r="3" fill="${color}"/>
    </svg>`;
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
    return `<svg class="path-bg-hills" width="${PATH_W}" height="${totalH}" viewBox="0 0 ${PATH_W} ${totalH}" preserveAspectRatio="none" aria-hidden="true">
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

// Псевдослучайное, но стабильное расположение декораций вдоль пути.
function scatterDecorations(totalH) {
    const decorations = [];
    const kinds = ['yurt', 'sword', 'helmet'];
    const slots = Math.floor(totalH / 200);
    for (let i = 0; i < slots; i++) {
        const kind = kinds[i % kinds.length];
        const x = (i % 2 === 0 ? 0.1 : 0.82) + (i % 3) * 0.02;
        const y = 200 + i * 200 + ((i * 37) % 80);
        const rot = ((i * 19) % 40) - 20;
        const scale = 0.7 + ((i * 7) % 5) * 0.08;
        const svg = kind === 'yurt' ? yurtSvg(60 * scale)
            : kind === 'sword' ? fallenSwordSvg(50 * scale, '#7a4a1c', rot)
                : fallenHelmetSvg(32 * scale);
        decorations.push(`<div class="path-scatter" style="left:${x * PATH_W}px;top:${y}px">${svg}</div>`);
    }
    return decorations.join('');
}

function chapterMeta() {
    const total = lessonsData.length || 1;
    const done = lessonsProgress.filter(p => p === true).length;
    const titles = lessonsData.map(l => l.title).slice(0, 3).join(' · ');
    return {
        chapterLine: `Урок ${Math.min(done + 1, total)} из ${total}`,
        chapterTitle: titles || 'Первые шаги'
    };
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
    const totalH = positions.length
        ? positions[positions.length - 1].y + PAD_BOTTOM
        : 200;

    // Header (sticky, gold band)
    const { chapterLine, chapterTitle } = chapterMeta();
    const header = document.createElement('div');
    header.className = 'path-header';
    header.innerHTML = `
        <div class="path-header-emblem">${shanyrakSvg(26)}</div>
        <div class="path-header-text">
            <div class="path-header-chapter">${chapterLine}</div>
            <div class="path-header-title h-display">${chapterTitle}</div>
        </div>
    `;
    lessonsPath.appendChild(header);

    // Steppe canvas with the winding path
    const canvas = document.createElement('div');
    canvas.className = 'path-canvas';
    canvas.style.width = PATH_W + 'px';
    canvas.style.height = totalH + 'px';

    canvas.innerHTML = steppeBgSvg(totalH)
        + scatterDecorations(totalH)
        + pathLineSvg(positions, totalH);

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
        canvas.appendChild(node);
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
        canvas.appendChild(mascot);
    }

    lessonsPath.appendChild(canvas);

    // Chunky test button at the bottom (final chapter goal)
    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'btn-chunk teal path-test-btn';
    testBtn.textContent = '🎓 Пройти тест';
    testBtn.addEventListener('click', () => showTest());
    lessonsPath.appendChild(testBtn);
}
