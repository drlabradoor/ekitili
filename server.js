// Локальный dev entry point. На Vercel используется api/index.js.
// Запуск: `npm start` или `node server.js`.

require('dotenv').config();

const http = require('http');
const os = require('os');
const app = require('./app');
const { initBattleSocket } = require('./battle-server');

const PORT = parseInt(process.env.PORT, 10) || 3000;

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const server = http.createServer(app);
initBattleSocket(server);

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIPAddress();
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  EkiTili Server (local dev)');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  ✓ Local:    http://localhost:${PORT}`);
    console.log(`  ✓ Network:  http://${localIP}:${PORT}`);
    console.log(`  ✓ Health:   http://localhost:${PORT}/api/health`);
    console.log(`  ✓ Battle:   socket.io ready`);
    console.log('');
    console.log('  Press Ctrl+C to stop the server');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
});
