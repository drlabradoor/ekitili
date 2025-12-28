#!/bin/bash

echo "========================================"
echo "  EkiTili - Запуск серверов"
echo "========================================"
echo ""

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "[ОШИБКА] Node.js не найден!"
    echo "Установите Node.js с https://nodejs.org/"
    exit 1
fi

# Проверка наличия package.json
if [ ! -f "package.json" ]; then
    echo "[ОШИБКА] Файл package.json не найден!"
    exit 1
fi

# Установка зависимостей, если нужно
if [ ! -d "node_modules" ]; then
    echo "[ИНФО] Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ОШИБКА] Не удалось установить зависимости"
        exit 1
    fi
    echo ""
fi

# Проверка наличия Oracle Instant Client (опционально)
echo "[ИНФО] Проверка Oracle Instant Client..."
if command -v sqlplus &> /dev/null; then
    echo "[OK] Oracle Instant Client найден"
else
    echo "[ПРЕДУПРЕЖДЕНИЕ] Oracle Instant Client не найден"
    echo "Для работы с базой данных установите Oracle Instant Client"
    echo "Скачать: https://www.oracle.com/database/technologies/instant-client/downloads.html"
fi
echo ""

# Настройка переменных окружения для Oracle (если нужно)
# Раскомментируйте и укажите путь к Oracle Instant Client:
# export OCI_LIB_DIR=/opt/oracle/instantclient_21_8
# export LD_LIBRARY_PATH=$OCI_LIB_DIR:$LD_LIBRARY_PATH

# Запуск бэкенд API сервера в фоне
echo "[ИНФО] Запуск бэкенд API сервера (порт 3000)..."
node server.js &
BACKEND_PID=$!

# Небольшая задержка для запуска бэкенда
sleep 2

echo "[ИНФО] Запуск веб-сервера (порт 8000)..."
echo ""
echo "========================================"
echo "  Серверы запущены!"
echo "========================================"
echo "  Frontend: http://localhost:8000"
echo "  Backend API: http://localhost:3000/api"
echo ""
echo "  Нажмите Ctrl+C для остановки серверов"
echo "========================================"
echo ""

# Функция для корректного завершения
cleanup() {
    echo ""
    echo "[ИНФО] Остановка серверов..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Запуск веб-сервера
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
elif command -v node &> /dev/null; then
    npx http-server -p 8000 -c-1
else
    echo "[ОШИБКА] Не найден Python или Node.js для веб-сервера"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

