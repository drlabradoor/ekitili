// Логика регистрации и входа
import { registerUser, loginUser, saveUser, getCurrentUser, isAuthenticated } from '../../services/auth.js';
import { showLoginModal, showRegisterModal, hideAuthModals, showError } from './authRenderer.js';
import { updateUserProfile } from '../../data/user.js';
import { updateProfileDisplay } from '../profile/profileRenderer.js';
import { updateAuthButtons } from '../profile/profile.js';

/**
 * Инициализация модуля авторизации
 */
export function initAuth() {
    setupLoginForm();
    setupRegisterForm();
    setupModalSwitching();
    setupCloseButtons();
    setupPasswordToggles();
}

/**
 * Настройка формы входа
 */
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const submitBtn = loginForm.querySelector('.auth-submit-btn');
        
        // Валидация
        if (!username || !password) {
            showError(errorEl, 'Заполните все поля');
            return;
        }
        
        // Отключаем кнопку во время запроса
        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';
        errorEl.classList.remove('show');
        
        // Выполняем вход
        const result = await loginUser(username, password);
        
        if (result.success) {
            // Сохраняем данные пользователя
            saveUser(result.userId, result.username);
            
            // Обновляем профиль
            updateUserProfile(result.username);
            updateProfileDisplay();
            
            // Обновляем кнопки профиля
            updateAuthButtons();
            
            // Закрываем модальное окно
            hideAuthModals();
            
            // Очищаем форму
            loginForm.reset();
        } else {
            // Показываем ошибку
            showError(errorEl, result.error || 'Ошибка входа');
        }
        
        // Включаем кнопку обратно
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    });
}

/**
 * Переключение видимости пароля
 */
function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.auth-eye-btn');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const icon = btn.querySelector('i');
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            if (icon) {
                icon.classList.toggle('fa-eye-slash', !isHidden);
                icon.classList.toggle('fa-eye', isHidden);
            }
        });
    });
}

/**
 * Настройка формы регистрации
 */
function setupRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');
        const submitBtn = registerForm.querySelector('.auth-submit-btn');
        
        // Валидация
        if (!username || !password || !passwordConfirm) {
            showError(errorEl, 'Заполните все поля');
            return;
        }
        
        if (username.length < 3) {
            showError(errorEl, 'Имя пользователя должно быть не менее 3 символов');
            return;
        }
        
        if (password.length < 6) {
            showError(errorEl, 'Пароль должен быть не менее 6 символов');
            return;
        }
        
        if (password !== passwordConfirm) {
            showError(errorEl, 'Пароли не совпадают');
            return;
        }
        
        // Отключаем кнопку во время запроса
        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';
        errorEl.classList.remove('show');
        
        // Выполняем регистрацию
        const result = await registerUser(username, password);
        
        if (result.success) {
            // Сохраняем данные пользователя
            saveUser(result.userId, result.username);
            
            // Обновляем профиль
            updateUserProfile(result.username);
            updateProfileDisplay();
            
            // Обновляем кнопки профиля
            updateAuthButtons();
            
            // Закрываем модальное окно
            hideAuthModals();
            
            // Очищаем форму
            registerForm.reset();
        } else {
            // Показываем ошибку
            showError(errorEl, result.error || 'Ошибка регистрации');
        }
        
        // Включаем кнопку обратно
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зарегистрироваться';
    });
}

/**
 * Настройка переключения между модальными окнами
 */
function setupModalSwitching() {
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    
    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            hideAuthModals();
            showRegisterModal();
        });
    }
    
    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            hideAuthModals();
            showLoginModal();
        });
    }
}

/**
 * Настройка кнопок закрытия модальных окон
 */
function setupCloseButtons() {
    const closeLogin = document.getElementById('close-login-modal');
    const closeRegister = document.getElementById('close-register-modal');
    
    if (closeLogin) {
        closeLogin.addEventListener('click', () => {
            hideAuthModals();
        });
    }
    
    if (closeRegister) {
        closeRegister.addEventListener('click', () => {
            hideAuthModals();
        });
    }
    
    // Закрытие при клике вне модального окна
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                hideAuthModals();
            }
        });
    }
    
    if (registerModal) {
        registerModal.addEventListener('click', (e) => {
            if (e.target === registerModal) {
                hideAuthModals();
            }
        });
    }
}

/**
 * Показать модальное окно входа (для использования из других модулей)
 */
export function showLogin() {
    showLoginModal();
}

/**
 * Показать модальное окно регистрации (для использования из других модулей)
 */
export function showRegister() {
    showRegisterModal();
}

// Кнопка в хедере удалена; логика авторизации доступна на вкладке Профиль

