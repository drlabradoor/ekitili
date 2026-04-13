// Логика лидерборда
import { renderLeaderboard } from './leaderboardRenderer.js';
import { getApiBaseUrl, getCurrentUser } from '../../services/auth.js';

const API_BASE_URL = getApiBaseUrl();

/**
 * Загрузка лидерборда с сервера
 */
async function loadLeaderboard(period) {
    try {
        const response = await fetch(`${API_BASE_URL}/leaderboard/${period}`);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error(`Failed to load ${period} leaderboard`);
            return [];
        }
    } catch (error) {
        console.error(`Error loading ${period} leaderboard:`, error);
        return [];
    }
}

/**
 * Загрузка данных пользователя в лидерборде
 */
async function loadUserLeaderboardData() {
    const user = getCurrentUser();
    if (!user || !user.userId) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/leaderboard/me`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            const userPlace = document.getElementById('leaderboardUserPlace');
            const userPoints = document.getElementById('leaderboardUserPoints');
            if (userPlace) userPlace.textContent = data.place || '-';
            if (userPoints) userPoints.textContent = (data.points || 0) + '★';
        }
    } catch (error) {
        console.error('Error loading user leaderboard data:', error);
    }
}

/**
 * Инициализация лидерборда
 */
export async function initLeaderboard() {
    await updateLeaderboard();
}

/**
 * Обновление лидерборда
 */
export async function updateLeaderboard() {
    const weekData = await loadLeaderboard('week');
    const monthData = await loadLeaderboard('month');
    
    renderLeaderboard(weekData, 'leaderboardWeek');
    renderLeaderboard(monthData, 'leaderboardMonth');
    
    await loadUserLeaderboardData();
}

/**
 * Рендеринг вкладки лидерборда
 */
export async function renderLeaderboardTab() {
    // Сразу очищаем контейнеры, чтобы не было видно старых данных
    const weekContainer = document.getElementById('leaderboardWeek');
    const monthContainer = document.getElementById('leaderboardMonth');
    if (weekContainer) weekContainer.innerHTML = '';
    if (monthContainer) monthContainer.innerHTML = '';
    
    // Сбрасываем данные пользователя
    const userPlace = document.getElementById('leaderboardUserPlace');
    const userPoints = document.getElementById('leaderboardUserPoints');
    if (userPlace) userPlace.textContent = '-';
    if (userPoints) userPoints.textContent = '0★';
    
    // Загружаем данные
    await updateLeaderboard();
}

// Экспортируем функцию для глобального доступа
window.updateLeaderboard = updateLeaderboard;

