// Утилиты для работы с DOM
export function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

export function getElement(selector) {
    return document.querySelector(selector);
}

export function getElements(selector) {
    return document.querySelectorAll(selector);
}

export function getElementById(id) {
    return document.getElementById(id);
}

