// Логика профиля
import { userProfile } from '../../data/user.js';
import { lessonsProgress } from '../../data/lessons.js';
import { getCourseProgressPercent } from '../../services/stats.js';
import { logoutUser } from '../../services/auth.js';
import { isAuthenticated } from '../../services/auth.js';
import { showLogin } from '../auth/auth.js';
import { renderStats, updateProfileDisplay } from './profileRenderer.js';

export function initProfile() {
    const profileIcon = document.querySelector('.profile-icon');
    const profileModal = document.getElementById('profile-modal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const profileAvatarLarge = document.querySelector('.profile-avatar-large');
    const profileNickname = document.getElementById('profileNickname');
    const profileProgressFill = document.getElementById('profileProgressFill');
    const profileProgressPercent = document.getElementById('profileProgressPercent');
    const profileAbout = document.getElementById('profileAbout');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const logoutModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutBtn = document.getElementById('confirm-logout');
    const cancelLogoutBtn = document.getElementById('cancel-logout');

    // Показываем/скрываем кнопки в зависимости от авторизации
    updateAuthButtons();

    function openProfileModal() {
        if (profileAvatarLarge) profileAvatarLarge.textContent = userProfile.avatar;
        if (profileNickname) profileNickname.textContent = userProfile.nickname;
        if (profileAbout) profileAbout.textContent = userProfile.about;

        // Прогресс курса
        const percent = getCourseProgressPercent();
        if (profileProgressFill) profileProgressFill.style.width = percent + '%';
        if (profileProgressPercent) profileProgressPercent.textContent = percent + '%';
        if (profileModal) profileModal.style.display = 'flex';
    }

    if (profileIcon) {
        profileIcon.addEventListener('click', openProfileModal);
    }

    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            if (profileModal) profileModal.style.display = 'none';
        });
    }

    // Обработчик кнопки входа
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            showLogin();
        });
    }

    // Обработчик кнопки выхода
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (logoutModal) {
                logoutModal.style.display = 'grid'; // keep same layout as auth modal
                document.body.style.overflow = 'hidden';
            }
        });
    }

    // Подтверждение выхода
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            logoutUser();
            // Обновляем профиль на дефолтные значения
            userProfile.nickname = 'Гость';
            userProfile.avatar = 'G';
            userProfile.about = 'Войдите, чтобы начать обучение!';
            updateProfileDisplay();
            renderStats(); // Сбросить ачивки и статистику
            // Обновляем кнопки профиля
            updateAuthButtons();
            // Закрываем модалку
            if (logoutModal) logoutModal.style.display = 'none';
            // Возвращаем прокрутку
            document.body.style.overflow = '';
        });
    }

    // Отмена выхода
    if (cancelLogoutBtn) {
        cancelLogoutBtn.addEventListener('click', () => {
            if (logoutModal) logoutModal.style.display = 'none';
            document.body.style.overflow = '';
        });
    }
}

/**
 * Обновить видимость кнопок входа/выхода
 */
export function updateAuthButtons() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authed = isAuthenticated();

    if (loginBtn) {
        loginBtn.style.display = authed ? 'none' : 'block';
    }
    if (logoutBtn) {
        logoutBtn.style.display = authed ? 'block' : 'none';
    }
}

