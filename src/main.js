// Точка входа приложения
import { loadUserWords, userWords, seedCoreWords } from './data/userWords.js';
import { syncFlashcardsShim, initializeFlashcards } from './data/flashcards.js';
import { loadLessonsCompleted, getRecentLessonIds } from './data/lessons.js';
import { renderLessonsPath } from './modules/lessons/lessonRenderer.js';
import { initFlashcards, setRecentLessonIds } from './modules/flashcards/flashcards.js';
import { initLeaderboard } from './modules/leaderboard/leaderboard.js';
import { renderStats, updateProfileDisplay } from './modules/profile/profileRenderer.js';
import { initProfile, updateAuthButtons } from './modules/profile/profile.js';
import { initRouter } from './navigation/router.js';
import { initAuth, showLogin } from './modules/auth/auth.js';
import { isAuthenticated } from './services/auth.js';
import { checkApiConnection } from './services/apiClient.js';
import { loadUserProfile } from './data/user.js';
import { initBattle } from './modules/games/battle.js';
import { preloadVoices } from './services/audio.js';
import { fetchAndMergeWords, flushPending } from './services/srsSync.js';

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

async function initializeApp() {
    try {
        if (window.location.protocol === 'file:') {
            alert('Откройте сайт через сервер!\n\nЗапустите: node server.js\nЗатем откройте: http://localhost:3000');
            return;
        }

        // Прогреваем Web Speech API заранее
        preloadVoices();

        // Загружаем SRS-состояние из localStorage
        loadUserWords();
        loadLessonsCompleted();
        syncFlashcardsShim();

        // Подгружаем приоритеты очереди
        setRecentLessonIds(getRecentLessonIds(3));

        // Проверяем API с retry
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

            if (!apiAvailable) showRetryButton();
        }

        loadUserProfile();

        if (!isAuthenticated()) {
            showLogin();
        } else {
            // Загружаем SRS с сервера и флашим очередь. Если сервер вернул пусто
            // и локально тоже пусто — новый пользователь, сеем ядро.
            fetchAndMergeWords().then(() => {
                if (Object.keys(userWords).length === 0) seedCoreWords();
                syncFlashcardsShim();
            });
            flushPending();
        }

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

        document.addEventListener('api-session-expired', () => showLogin());
        document.addEventListener('api-backend-down', () => showOfflineBanner());
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
