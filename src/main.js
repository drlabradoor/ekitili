// Точка входа приложения
import { initializeFlashcards } from './data/flashcards.js';
import { renderLessonsPath } from './modules/lessons/lessonRenderer.js';
import { initFlashcards } from './modules/flashcards/flashcards.js';
import { initLeaderboard } from './modules/leaderboard/leaderboard.js';
import { renderStats, updateProfileDisplay } from './modules/profile/profileRenderer.js';
import { initProfile, updateAuthButtons } from './modules/profile/profile.js';
import { initRouter } from './navigation/router.js';
import { initAuth, showLogin } from './modules/auth/auth.js';
import { isAuthenticated, checkApiConnection } from './services/auth.js';
import { loadUserProfile } from './data/user.js';
import { initBattle } from './modules/games/battle.js';

// Функция инициализации
async function initializeApp() {
    try {
        // Проверяем, что сайт открыт через HTTP, а не file://
        if (window.location.protocol === 'file:') {
            console.error('❌ ОШИБКА: Сайт открыт через file:// протокол!');
            console.error('Откройте сайт через сервер: http://localhost:3000');
            console.error('Запустите сервер: node server.js');
            alert('ОШИБКА: Откройте сайт через сервер!\n\nЗапустите: node server.js\nЗатем откройте: http://localhost:3000');
            return;
        }

        // Проверяем подключение к API
        const apiAvailable = await checkApiConnection();
        if (!apiAvailable) {
            console.warn('⚠ API сервер недоступен. Убедитесь, что сервер запущен на порту 3000.');
            console.warn('Запустите: node server.js');
        }

        // Загружаем профиль пользователя из localStorage
        loadUserProfile();

        // Проверяем авторизацию
        if (!isAuthenticated()) {
            // Если пользователь не авторизован, показываем окно входа
            showLogin();
        }

        // Инициализация данных
        initializeFlashcards();

        // Инициализация модулей
        initAuth(); // Инициализация модуля авторизации
        renderLessonsPath();
        initFlashcards();
        initLeaderboard();
        renderStats();
        updateProfileDisplay(); // Обновляем отображение профиля
        initProfile();
        initBattle();
        updateAuthButtons(); // Обновляем кнопки входа/выхода в профиле
        initRouter();
    } catch (error) {
        console.error('Initialization error:', error);
    }

    // Анимация прогресс-бара
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        let percent = 65; // Можно динамически менять
        progressFill.style.transition = 'width 1s';
        progressFill.style.width = percent + '%';
    }

    // Скрываем preloader сразу
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.display = 'none';
        preloader.style.visibility = 'hidden';
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
        preloader.style.zIndex = '-1';
        document.body.style.overflow = '';
    }
}

// Проверяем готовность DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM уже загружен, запускаем сразу
    initializeApp();
}
