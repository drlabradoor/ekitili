// Утилиты для работы с датами
export function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

export function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getTime() === d2.getTime();
}

export function isDateBeforeOrEqual(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getTime() <= d2.getTime();
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

