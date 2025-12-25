// Рендеринг модальных окон регистрации и входа

/**
 * Показать модальное окно входа
 */
export function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    if (registerModal) registerModal.style.display = 'none';
    if (loginModal) {
        loginModal.style.display = 'flex';
        // Блокируем скролл body
        document.body.style.overflow = 'hidden';
        // Очищаем ошибки
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.classList.remove('show');
            errorEl.textContent = '';
        }
        // Фокус на поле ввода
        const usernameInput = document.getElementById('login-username');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
    }
}

/**
 * Показать модальное окно регистрации
 */
export function showRegisterModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) {
        registerModal.style.display = 'flex';
        // Блокируем скролл body
        document.body.style.overflow = 'hidden';
        // Очищаем ошибки
        const errorEl = document.getElementById('register-error');
        if (errorEl) {
            errorEl.classList.remove('show');
            errorEl.textContent = '';
        }
        // Фокус на поле ввода
        const usernameInput = document.getElementById('register-username');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
    }
}

/**
 * Скрыть все модальные окна авторизации
 */
export function hideAuthModals() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    
    // Восстанавливаем скролл body
    document.body.style.overflow = '';
}

/**
 * Показать ошибку в модальном окне
 * @param {HTMLElement} errorEl - Элемент для отображения ошибки
 * @param {string} message - Текст ошибки
 */
export function showError(errorEl, message) {
    if (!errorEl) return;
    
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

