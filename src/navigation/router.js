// Навигация между вкладками
import { renderLessonsPath } from '../modules/lessons/lessonRenderer.js';
import { renderFlashcardsTab } from '../modules/flashcards/flashcards.js';
import { renderLeaderboardTab } from '../modules/leaderboard/leaderboard.js';
import { renderStats } from '../modules/profile/profileRenderer.js';
import { updateAuthButtons } from '../modules/profile/profile.js';
import { renderGameTab } from '../modules/games/memory.js';

export function initRouter() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const tabSections = document.querySelectorAll('.tab-section');

    navItems.forEach(item => {
        item.addEventListener('click', function () {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const tabId = item.getAttribute('data-tab');
            tabSections.forEach(sec => {
                if (sec.id === tabId) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });

            renderTab(tabId);
        });
    });
}

function renderTab(tabId) {
    if (tabId === 'tab-lessons') {
        renderLessonsPath();
    } else if (tabId === 'tab-cards') {
        renderFlashcardsTab();
    } else if (tabId === 'tab-games') {
        renderGameTab();
    } else if (tabId === 'tab-leaderboard') {
        renderLeaderboardTab();
    } else if (tabId === 'tab-profile') {
        renderStats();
        // Обновляем кнопки входа/выхода при переходе на вкладку профиля
        updateAuthButtons();
    }
}

/**
 * Перейти на вкладку профиля
 */
export function navigateToProfile() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const tabSections = document.querySelectorAll('.tab-section');

    // Находим элемент навигации профиля
    const profileNavItem = Array.from(navItems).find(item => item.getAttribute('data-tab') === 'tab-profile');
    const profileTab = document.getElementById('tab-profile');

    if (profileNavItem && profileTab) {
        // Убираем активный класс со всех элементов
        navItems.forEach(i => i.classList.remove('active'));
        tabSections.forEach(sec => sec.classList.remove('active'));

        // Активируем профиль
        profileNavItem.classList.add('active');
        profileTab.classList.add('active');

        // Рендерим вкладку (внутри renderTab уже вызывается updateLogoutButton)
        renderTab('tab-profile');
    }
}

