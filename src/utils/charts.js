// Функции для графиков (canvas)
export function drawCircleProgress(canvasId, percent) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Фон
    ctx.beginPath();
    ctx.arc(55, 55, 48, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 10;
    ctx.stroke();
    // Прогресс
    ctx.beginPath();
    ctx.arc(55, 55, 48, -Math.PI / 2, 2 * Math.PI * percent / 100 - Math.PI / 2);
    ctx.strokeStyle = '#4285f4';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
}

export function drawActivityChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    const barW = 18, gap = 12;
    data.forEach((val, i) => {
        ctx.fillStyle = '#4285f4';
        ctx.fillRect(i * (barW + gap) + 10, h - 8 - val * 12, barW, val * 12);
        ctx.fillStyle = '#bbb';
        ctx.fillText(['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][i], i * (barW + gap) + 13, h - 2);
    });
}

