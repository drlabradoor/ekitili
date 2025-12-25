// Данные пользователя
import { getCurrentUser } from '../services/auth.js';

// Получаем данные пользователя из localStorage или используем дефолтные
const currentUser = getCurrentUser();
const defaultNickname = currentUser ? currentUser.username : 'alexey_kz';

export let userProfile = {
    avatar: getAvatarFromNickname(defaultNickname),
    nickname: defaultNickname,
    about: 'Люблю казахский язык и учусь каждый день!',
};

/**
 * Получить первую букву никнейма для аватара
 */
function getAvatarFromNickname(nickname) {
    if (!nickname || nickname.length === 0) return 'U';
    return nickname.charAt(0).toUpperCase();
}

/**
 * Обновить профиль пользователя
 * @param {string} username - Имя пользователя
 */
export function updateUserProfile(username) {
    if (!username) return;
    
    userProfile = {
        ...userProfile,
        avatar: getAvatarFromNickname(username),
        nickname: username
    };
    
    // Сохраняем в localStorage для восстановления при перезагрузке
    const userData = {
        ...userProfile,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('userProfile', JSON.stringify(userData));
}

/**
 * Загрузить профиль пользователя из localStorage
 */
export function loadUserProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        // Если пользователь не авторизован, используем дефолтные данные
        userProfile = {
            avatar: 'G',
            nickname: 'Гость',
            about: 'Войдите, чтобы начать обучение!'
        };
        return;
    }
    
    // Пытаемся загрузить сохранённый профиль
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
        try {
            const profile = JSON.parse(savedProfile);
            userProfile = {
                ...userProfile,
                ...profile,
                nickname: currentUser.username, // Всегда используем актуальный никнейм
                avatar: getAvatarFromNickname(currentUser.username)
            };
        } catch (e) {
            console.error('Ошибка загрузки профиля:', e);
            // Если ошибка, обновляем с текущим пользователем
            updateUserProfile(currentUser.username);
        }
    } else {
        // Если профиль не сохранён, обновляем с текущим пользователем
        updateUserProfile(currentUser.username);
    }
}

// Стрик: 12 дней подряд
export let demoStreak = 12;

// Активность по дням (7 дней)
export let demoActivity = [2, 3, 1, 4, 2, 6, 1];

