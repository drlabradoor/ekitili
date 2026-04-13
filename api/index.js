// Vercel serverless entry point.
// Все /api/* запросы приходят сюда через rewrite в vercel.json,
// Express в app.js матчит их по префиксу /api.

require('dotenv').config();

module.exports = require('../app');
