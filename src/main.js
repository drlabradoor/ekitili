// Точка входа приложения
import { initializeFlashcards } from './data/flashcards.js';
import { renderLessonsPath } from './modules/lessons/lessonRenderer.js';
import { initFlashcards } from './modules/flashcards/flashcards.js';
import { initLeaderboard } from './modules/leaderboard/leaderboard.js';
import { renderStats, updateProfileDisplay } from './modules/profile/profileRenderer.js';
import { initProfile, updateAuthButtons } from './modules/profile/profile.js';
import { initRouter } from './navigation/router.js';
import { initAuth, showLogin } from './modules/auth/auth.js';
import { isAuthenticated } from './services/auth.js';
import { checkApiConnection } from './services/apiClient.js';
import { loadUserProfile } from './data/user.js';
import { initBattle } from './modules/games/battle.js';

// =====================================================
// Offline banner + retry
// =====================================================
function showOfflineBanner() {
    if (document.getElementById('offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '<span>Сервер недоступен. Проверяем подключение...</span>';
    document.body.prepend(banner);
}

function hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.remove();
}

function showRetryButton() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    banner.innerHTML = `
        <span>Сервер недоступен.</span>
        <button class="retry-btn" onclick="location.reload()">Попробовать снова</button>
    `;
}

function setAuthUIDisabled(disabled) {
    document.querySelectorAll('.auth-btn, .login-btn, .register-btn').forEach(b => {
        b.disabled = disabled;
    });
}

// Функция инициализации
async function initializeApp() {
    try {
        // Проверяем, что сайт открыт через HTTP, а не file://
        if (window.location.protocol === 'file:') {
            console.error('Сайт открыт через file:// протокол!');
            console.error('Откройте сайт через сервер: http://localhost:3000');
            alert('Откройте сайт через сервер!\n\nЗапустите: node server.js\nЗатем откройте: http://localhost:3000');
            return;
        }

        // Проверяем подключение к API с retry
        let apiAvailable = await checkApiConnection();
        if (!apiAvailable) {
            showOfflineBanner();
            setAuthUIDisabled(true);

            for (const delay of [3000, 6000, 12000]) {
                await new Promise(r => setTimeout(r, delay));
                apiAvailable = await checkApiConnection();
                if (apiAvailable) {
                    hideOfflineBanner();
                    setAuthUIDisabled(false);
                    break;
                }
            }

            if (!apiAvailable) {
                showRetryButton();
            }
        }

        // Загружаем профиль пользователя из localStorage
        loadUserProfile();

        // Проверяем авторизацию
        if (!isAuthenticated()) {
            showLogin();
        }

        // Инициализация данных
        initializeFlashcards();

        // Инициализация модулей
        initAuth();
        renderLessonsPath();
        initFlashcards();
        initLeaderboard();
        renderStats();
        updateProfileDisplay();
        initProfile();
        initBattle();
        updateAuthButtons();
        initRouter();

        // Слушаем события от apiClient
        document.addEventListener('api-session-expired', () => {
            showLogin();
        });
        document.addEventListener('api-backend-down', () => {
            showOfflineBanner();
        });
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Проверяем готовность DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
