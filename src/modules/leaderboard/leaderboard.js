// Логика лидерборда
import { leaderboardWeek, leaderboardMonth } from '../../data/leaderboard.js';
import { renderLeaderboard } from './leaderboardRenderer.js';

export function initLeaderboard() {
    renderLeaderboard(leaderboardWeek, 'leaderboardWeek');
    renderLeaderboard(leaderboardMonth, 'leaderboardMonth');
}

export function renderLeaderboardTab() {
    renderLeaderboard(leaderboardWeek, 'leaderboardWeek');
    renderLeaderboard(leaderboardMonth, 'leaderboardMonth');
}

