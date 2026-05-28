// Рендеринг лидерборда
// Дизайн-референс: design-handoff/project/screens_board.jsx
// Top-3 идут на подиум, остальные — chunky-список ниже.
import { createBatyrAvatarEl } from '../profile/batyrAvatarProfile.js';
import { userProfile } from '../../data/user.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function renderLeaderboard(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.classList.add('leaderboard-list--podium');
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="leaderboard-empty">Пока пусто. Попробуйте ещё раз позже.</div>';
        return;
    }

    const top3 = list.slice(0, 3);
    const rest = list.slice(3);

    if (top3.length > 0) {
        const podium = document.createElement('div');
        podium.className = 'leaderboard-podium';
        // Размещение: 2-1-3 (серебро · золото · бронза)
        const order = [1, 0, 2];
        order.forEach((idx) => {
            if (!top3[idx]) return;
            const player = top3[idx];
            const place = idx + 1;
            const isFirst = place === 1;
            const podiumPlace = document.createElement('div');
            podiumPlace.className = `podium-place podium-place--${place}`;

            // Создаём батыр-аватар с дефолтным конём (без gear)
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'podium-avatar-wrap';
            const batyrEl = createBatyrAvatarEl(
                isFirst ? 68 : 54,  // size: bigger for 1st place
                0,  // stage: no progression ring
                {},  // gear: empty (no equipment)
                'horse',  // portrait: default horse
                'mini'  // kind
            );

            // Убераем обёртку батыра и вставляем его тело напрямую
            const batyrContent = batyrEl.innerHTML;
            avatarWrap.innerHTML = batyrEl.innerHTML;

            // Добавляем медаль поверх
            const medal = document.createElement('div');
            medal.className = 'podium-medal';
            medal.setAttribute('aria-hidden', 'true');
            medal.textContent = MEDALS[idx];
            avatarWrap.appendChild(medal);

            podiumPlace.innerHTML = `
                ${isFirst ? '<div class="podium-crown" aria-hidden="true">👑</div>' : ''}
                <div class="podium-name">${escapeHtml(player.name || '')}</div>
                <div class="podium-points">${player.points ?? 0} ★</div>
                <div class="podium-bar"><span class="podium-bar-number">${place}</span></div>
            `;
            podiumPlace.insertBefore(avatarWrap, podiumPlace.firstChild);
            podium.appendChild(podiumPlace);
        });
        container.appendChild(podium);
    }

    if (rest.length > 0) {
        const restList = document.createElement('div');
        restList.className = 'leaderboard-rest';
        rest.forEach((player, i) => {
            const place = i + 4;
            const row = document.createElement('div');
            row.className = 'leaderboard-item';
            row.innerHTML = `
                <div class="leaderboard-place">#${place}</div>
                <div class="leaderboard-avatar">${escapeHtml((player.name || '?')[0].toUpperCase())}</div>
                <div class="leaderboard-name">${escapeHtml(player.name || '')}</div>
                <div class="leaderboard-points">${player.points ?? 0} ★</div>
            `;
            restList.appendChild(row);
        });
        container.appendChild(restList);
    }
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Показать кастомный аватар пользователя в "Ваше место" карточке
export function renderUserAvatarInLeaderboard() {
    const userCard = document.getElementById('leaderboardUser');
    if (!userCard) return;

    // Удаляем старый аватар если уже есть
    const existingAvatar = userCard.querySelector('.leaderboard-user-avatar-wrap');
    if (existingAvatar) existingAvatar.remove();

    // Создаём обёртку для аватара в начало карточки
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'leaderboard-user-avatar-wrap';

    // Вставляем батыр-аватар с текущими настройками
    const batyrEl = createBatyrAvatarEl(
        44,  // size
        userProfile.stage || 0,
        userProfile.gear || {},
        userProfile.portrait || 'horse',
        'mini'  // kind
    );
    avatarWrap.appendChild(batyrEl);

    // Вставляем в начало карточки, перед текстом
    userCard.insertBefore(avatarWrap, userCard.firstChild);
}
