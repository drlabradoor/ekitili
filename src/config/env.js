// Конфигурация окружения.
// В production config.js генерируется build-скриптом (scripts/build-config.js).
// Локально — fallback на localhost:3000.

const config = (typeof window !== 'undefined' && window.__EKITILI_CONFIG__) || {};
const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (!config.BACKEND_URL && !isLocal) {
    console.error('[env] CRITICAL: config.js не загружен и это не localhost. Проверьте деплой.');
    document.body.innerHTML = '<div style="padding:2em;text-align:center;color:#c0392b;font-size:18px;">Ошибка конфигурации. Обратитесь к администратору.</div>';
}

export const BACKEND_URL = config.BACKEND_URL || 'http://localhost:3000';
