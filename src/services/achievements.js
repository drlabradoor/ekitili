import { userProfile, saveUserProfile } from '../data/user.js';
import { getCurrentUser, getApiBaseUrl } from './auth.js';

const API_BASE_URL = getApiBaseUrl();

export const REQUIRED_ACHIEVEMENTS = {
    polyglot: {
        id: 'polyglot',
        title: 'Полиглот',
        description: 'Пройти тест на определение уровня',
        icon: '🎓',
        target: 1
    },
    memory_master: {
        id: 'memory_master',
        title: 'Мастер Памяти',
        description: 'Победить в игре Memory 4x4',
        icon: '🧠',
        target: 1
    },
    streak_3: {
        id: 'streak_3',
        title: 'В ритме',
        description: 'Стрик 3 дня подряд',
        icon: '🔥',
        target: 3
    },
    streak_7: {
        id: 'streak_7',
        title: 'Неделя силы',
        description: 'Стрик 7 дней подряд',
        icon: '🔥',
        target: 7
    },
    streak_30: {
        id: 'streak_30',
        title: 'Месяц силы',
        description: 'Стрик 30 дней подряд',
        icon: '🔥',
        target: 30
    }
};

export async function unlockAchievement(achievementId) {
    if (!userProfile) return;

    if (!userProfile.achievements) userProfile.achievements = [];

    const existing = userProfile.achievements.find(a =>
        (typeof a === 'string' && a === achievementId) ||
        (typeof a === 'object' && a.id === achievementId)
    );

    if (existing) return;

    const achievementDef = REQUIRED_ACHIEVEMENTS[achievementId];
    if (!achievementDef) return;

    const newAchievement = {
        id: achievementId,
        awardedDate: new Date().toISOString(),
        progress: achievementDef.target
    };

    userProfile.achievements.push(newAchievement);
    saveUserProfile();

    showAchievementNotification(achievementDef);

    await saveAchievementsToServer();

    document.dispatchEvent(new CustomEvent('achievements-updated'));
}

async function saveAchievementsToServer() {
    const user = getCurrentUser();
    if (!user || !user.userId) return;

    try {
        await fetch(`${API_BASE_URL}/user/achievements`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ achievements: userProfile.achievements })
        });
    } catch (error) {
        console.error('Error saving achievements:', error);
    }
}

export async function loadUserAchievements() {
    const user = getCurrentUser();
    if (!user || !user.userId) return;

    try {
        const response = await fetch(`${API_BASE_URL}/user/achievements`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            if (data.achievements) {
                userProfile.achievements = data.achievements;
                saveUserProfile();
                document.dispatchEvent(new CustomEvent('achievements-updated'));
            }
        }
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="ach-icon">${achievement.icon}</div>
        <div class="ach-text">
            <div class="ach-title">Достижение получено!</div>
            <div class="ach-name">${achievement.title}</div>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}
