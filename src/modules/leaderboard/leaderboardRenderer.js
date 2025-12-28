// Рендеринг лидерборда
export function renderLeaderboard(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    list.forEach((user, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        // Аватарка (плейсхолдер с инициалами)
        const avatar = document.createElement('div');
        avatar.className = 'leaderboard-avatar';
        avatar.textContent = user.name ? user.name[0].toUpperCase() : '';
        item.appendChild(avatar);
        
        const place = document.createElement('div');
        place.className = 'leaderboard-place';
        if (idx === 0) place.classList.add('top1');
        if (idx === 1) place.classList.add('top2');
        if (idx === 2) place.classList.add('top3');
        place.textContent = idx + 1;
        
        const name = document.createElement('div');
        name.className = 'leaderboard-name';
        name.textContent = user.name;
        
        const points = document.createElement('div');
        points.className = 'leaderboard-points';
        points.textContent = user.points + '★';
        
        item.appendChild(place);
        item.appendChild(name);
        item.appendChild(points);
        container.appendChild(item);
    });
    
    // Место и очки пользователя обновляются отдельно в loadUserLeaderboardData
}

