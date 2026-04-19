// Генерирует config.js с BACKEND_URL для SPA.
// Vercel вызывает через "npm run build"; локально — опционально.

const fs = require('fs');
const url = process.env.BACKEND_URL;
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

if (isProd && !url) {
    console.error('[build-config] FATAL: BACKEND_URL not set in production. Set it in Vercel dashboard.');
    process.exit(1);
}
if (!url) {
    console.warn('[build-config] BACKEND_URL not set — using localhost fallback (ok for dev)');
}

const config = { BACKEND_URL: url || 'http://localhost:3000' };
fs.writeFileSync('config.js',
    `window.__EKITILI_CONFIG__ = ${JSON.stringify(config)};`
);
console.log('[build-config] generated:', config);
