// Данные пользователя
// Данные пользователя
import { getCurrentUser } from '../services/auth.js';
import { loadUserAchievements } from '../services/achievements.js';
import { loadStreakFromServer } from '../services/streak.js';

// Получаем данные пользователя из localStorage или используем дефолтные
const currentUser = getCurrentUser();
const defaultNickname = currentUser ? currentUser.username : 'alexey_kz';

export let userProfile = {
    avatar: getAvatarFromNickname(defaultNickname),
    nickname: defaultNickname,
    about: 'Люблю казахский язык и учусь каждый день!',
    achievements: [] // Список ID полученных достижений
};

/**
 * Сохранить профиль пользователя (экспорт для использования в других модулях)
 */
export function saveUserProfile() {
    const userData = {
        ...userProfile,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('userProfile', JSON.stringify(userData));
}

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

    // Загружаем достижения и стрик с сервера
    loadUserAchievements();
    loadStreakFromServer();
}

/**
 * Сбросить данные профиля (при выходе)
 */
export function resetUserProfile() {
    userProfile = {
        avatar: 'G',
        nickname: 'Гость',
        about: 'Войдите, чтобы начать обучение!',
        achievements: []
    };
    localStorage.removeItem('userProfile');
}

