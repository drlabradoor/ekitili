// Рендеринг профиля и статистики
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { demoStreak, demoActivity, userProfile } from '../../data/user.js';
import { leaderboardWeek, leaderboardMonth } from '../../data/leaderboard.js';
import { getCourseProgressPercent } from '../../services/stats.js';
import { drawCircleProgress, drawActivityChart } from '../../utils/charts.js';
import { renderLeaderboard } from '../leaderboard/leaderboardRenderer.js';

export function renderStats() {
    // 1. Кольцевой прогресс-бар (курс)
    const percent = getCourseProgressPercent();
    const percentEl = document.getElementById('courseProgressPercent');
    if (percentEl) percentEl.textContent = percent + '%';
    drawCircleProgress('courseProgressCircle', percent);

    // 2. Стрик
    const streakEl = document.getElementById('streakValue');
    if (streakEl) streakEl.textContent = demoStreak;
    
    // 2.1. Визуализация дней недели
    const weekEl = document.getElementById('streakWeek');
    if (weekEl) {
        weekEl.innerHTML = '';
        const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const todayIdx = new Date().getDay(); // 0=Вс, 6=Сб
        
        // Сдвигаем demoActivity и дни недели так, чтобы последний был сегодня
        let activity7 = [];
        let days7 = [];
        for (let i = 6; i >= 0; --i) {
            const d = (todayIdx - i + 7) % 7;
            activity7.push(demoActivity[d]);
            days7.push(days[d]);
        }
        
        for (let i = 0; i < 7; ++i) {
            const day = document.createElement('div');
            day.className = 'streak-day';
            if (activity7[i] > 0) day.classList.add('active');
            if (i === 6) day.classList.add('today');
            day.textContent = days7[i];
            weekEl.appendChild(day);
        }
    }
    
    // 3. График активности (7 дней до сегодня)
    let activity7 = [];
    const todayIdx = new Date().getDay();
    for (let i = 6; i >= 0; --i) {
        const d = (todayIdx - i + 7) % 7;
        activity7.push(demoActivity[d]);
    }
    drawActivityChart('activityChart', activity7);

    // 4. Прогресс по категориям (по урокам)
    const catBars = document.getElementById('catBars');
    if (catBars) {
        catBars.innerHTML = '';
        lessonsData.forEach((lesson, idx) => {
            const row = document.createElement('div');
            row.className = 'cat-bar-row';
            
            const title = document.createElement('div');
            title.className = 'cat-bar-title';
            title.textContent = lesson.title;
            
            const bar = document.createElement('div');
            bar.className = 'cat-bar';
            const fill = document.createElement('div');
            fill.className = 'cat-bar-fill';
            fill.style.width = lessonsProgress[idx] === true ? '100%' : lessonsProgress[idx] === null ? '50%' : '0%';
            bar.appendChild(fill);
            
            const value = document.createElement('div');
            value.className = 'cat-bar-value';
            value.textContent = lessonsProgress[idx] === true ? '100%' : lessonsProgress[idx] === null ? '50%' : '0%';
            
            row.appendChild(title);
            row.appendChild(bar);
            row.appendChild(value);
            catBars.appendChild(row);
        });
    }

    // 5. Лидерборд
    renderLeaderboard(leaderboardWeek, 'leaderboardWeek');
    renderLeaderboard(leaderboardMonth, 'leaderboardMonth');
}

/**
 * Обновить отображение профиля пользователя
 */
export function updateProfileDisplay() {
    const nicknameEl = document.getElementById('profileNickname');
    const avatarEl = document.querySelector('.profile-avatar-large');
    
    if (nicknameEl && userProfile) {
        nicknameEl.textContent = userProfile.nickname;
    }
    
    if (avatarEl && userProfile) {
        avatarEl.textContent = userProfile.avatar;
    }
}

