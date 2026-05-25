// Рендеринг лидерборда
// Дизайн-референс: design-handoff/project/screens_board.jsx
// Top-3 идут на подиум, остальные — chunky-список ниже.
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
            podiumPlace.innerHTML = `
                ${isFirst ? '<div class="podium-crown" aria-hidden="true">👑</div>' : ''}
                <div class="podium-avatar-wrap">
                    <div class="podium-avatar">${escapeHtml((player.name || '?')[0].toUpperCase())}</div>
                    <div class="podium-medal" aria-hidden="true">${MEDALS[idx]}</div>
                </div>
                <div class="podium-name">${escapeHtml(player.name || '')}</div>
                <div class="podium-points">${player.points ?? 0} ★</div>
                <div class="podium-bar"><span class="podium-bar-number">${place}</span></div>
            `;
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
