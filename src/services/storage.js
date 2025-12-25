// Работа с localStorage
// В будущем можно использовать для сохранения прогресса пользователя

export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Error saving to storage:', e);
        return false;
    }
}

export function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('Error loading from storage:', e);
        return null;
    }
}

export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('Error removing from storage:', e);
        return false;
    }
}

