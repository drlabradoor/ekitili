// Рендеринг профиля и статистики
import { lessonsData, lessonsProgress } from '../../data/lessons.js';
import { userProfile } from '../../data/user.js';
import { leaderboardWeek, leaderboardMonth } from '../../data/leaderboard.js';
import { getCourseProgressPercent } from '../../services/stats.js';
import { drawCircleProgress, drawActivityChart } from '../../utils/charts.js';
import { renderLeaderboard } from '../leaderboard/leaderboardRenderer.js';
import { REQUIRED_ACHIEVEMENTS } from '../../services/achievements.js';
import { getStreakData, STREAK_UPDATED_EVENT } from '../../services/streak.js';

export function renderStats() {
    // 1. Кольцевой прогресс-бар (курс)
    const percent = getCourseProgressPercent();
    const percentEl = document.getElementById('courseProgressPercent');
    if (percentEl) percentEl.textContent = percent + '%';
    drawCircleProgress('courseProgressCircle', percent);

    // 5. Лидерборд
    renderLeaderboard(leaderboardWeek, 'leaderboardWeek');
    renderLeaderboard(leaderboardMonth, 'leaderboardMonth');

    // 6. Достижения
    const achList = document.getElementById('achList');
    if (achList) {
        achList.innerHTML = '';

        // Используем константы (single table approach)
        const defs = Object.values(REQUIRED_ACHIEVEMENTS);
        const userAchievements = userProfile.achievements || [];

        if (defs.length > 0) {
            defs.forEach(ach => {
                // Проверяем, есть ли достижение в списке пользователя
                // Поддержка и 'string', и { id: 'string' }
                const userAch = userAchievements.find(ua => {
                    const uaId = (typeof ua === 'string') ? ua : ua.id;
                    return uaId === ach.id;
                });

                const isUnlocked = !!userAch;

                if (isUnlocked) {
                    const achItem = document.createElement('div');
                    achItem.className = 'ach-item';
                    achItem.title = 'Нажмите для подробностей';
                    achItem.style.cursor = 'pointer';
                    achItem.innerHTML = `
                        <div class="ach-item-icon">${ach.icon}</div>
                        <div class="ach-item-title">${ach.title}</div>
                    `;

                    achItem.onclick = () => showAchievementDetails(ach.id, userAch);
                    achList.appendChild(achItem);
                }
            });

            if (achList.children.length === 0) {
                achList.textContent = 'Пока нет достижений. Играйте, чтобы открыть!';
                achList.style.color = '#888';
                achList.style.fontStyle = 'italic';
                achList.style.padding = '10px';
            }
        }
    }

    // 2. Стрик (реальные данные из localStorage)
    const streak = getStreakData();
    const streakEl = document.getElementById('streakValue');
    if (streakEl) {
        streakEl.textContent = streak.current;
        streakEl.classList.toggle('streak-inactive', !streak.completedToday);
    }
    const streakDescEl = document.querySelector('.stat-streak .streak-desc');
    if (streakDescEl) {
        if (streak.longest > 0) {
            streakDescEl.textContent = `дней подряд · лучший ${streak.longest}`;
        } else {
            streakDescEl.textContent = 'дней подряд';
        }
    }

    // 2.1. Визуализация дней недели (последние 7 дней)
    const weekEl = document.getElementById('streakWeek');
    if (weekEl) {
        weekEl.innerHTML = '';
        const shortNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        streak.last7Days.forEach(entry => {
            const day = document.createElement('div');
            day.className = 'streak-day';
            if (entry.count > 0) day.classList.add('active');
            if (entry.isToday) day.classList.add('today');
            const d = new Date(entry.date + 'T00:00:00');
            day.textContent = shortNames[d.getDay()];
            day.title = `${entry.date}: ${entry.count} ${entry.count === 1 ? 'действие' : 'действий'}`;
            weekEl.appendChild(day);
        });
    }

    // 3. График активности (последние 7 дней)
    const activity7 = streak.last7Days.map(e => e.count);
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
}

/**
 * Показать детали достижения (модальное окно)
 */
function showAchievementDetails(achId, userAch) {
    const ach = REQUIRED_ACHIEVEMENTS[achId];
    if (!ach) return;

    // Удаляем старое модальное окно, если есть
    const oldModal = document.getElementById('ach-modal');
    if (oldModal) oldModal.remove();

    let dateStr = 'Неизвестно';
    if (userAch && typeof userAch === 'object' && userAch.awardedDate) {
        dateStr = new Date(userAch.awardedDate).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    const modal = document.createElement('div');
    modal.id = 'ach-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <span class="close-btn" onclick="document.getElementById('ach-modal').remove()" style="position: absolute; right: 15px; top: 10px; cursor: pointer; font-size: 24px;">&times;</span>
            <div style="font-size: 4rem; margin: 10px 0;">${ach.icon}</div>
            <h2 style="color: var(--primary-color); margin-bottom: 10px;">${ach.title}</h2>
            <p style="font-size: 1.1rem; margin-bottom: 20px;">${ach.description}</p>
            <div style="border-top: 1px solid #eee; padding-top: 15px; font-size: 0.9rem; color: #666;">
                Получено: <strong>${dateStr}</strong>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
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

// Слушаем обновление достижений и перерисовываем
document.addEventListener('achievements-updated', () => {
    // Проверяем, активна ли вкладка профиля, чтобы зря не рендерить
    if (document.getElementById('tab-profile').classList.contains('active')) {
        renderStats();
        updateProfileDisplay(); // Also update profile details if needed
    }
});

// Обновление стрика после учебной активности
document.addEventListener(STREAK_UPDATED_EVENT, () => {
    const profileTab = document.getElementById('tab-profile');
    if (profileTab && profileTab.classList.contains('active')) {
        renderStats();
    }
});
