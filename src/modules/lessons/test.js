// Компонент теста для определения уровня знания казахского языка
import { getCurrentUser, getApiBaseUrl } from '../../services/auth.js';
import { showLogin } from '../auth/auth.js';
import { unlockAchievement } from '../../services/achievements.js';

const API_BASE_URL = getApiBaseUrl();

let testQuestions = [];
let currentQuestionIndex = 0;
let testAnswers = [];
let testModal = null;

/**
 * Вопросы для теста на определение уровня знания казахского языка
 * Вопросы разной сложности: начальный, средний, продвинутый
 */
const levelTestQuestions = [
    // Начальный уровень (A1-A2)
    {
        question: 'Как будет "Привет" на казахском?',
        options: ['Сәлем', 'Сау бол', 'Рахмет', 'Жақсы'],
        correctAnswer: 0,
        level: 'beginner'
    },
    {
        question: 'Что означает слово "Қайырлы таң"?',
        options: ['Доброе утро', 'Добрый день', 'Добрый вечер', 'Спокойной ночи'],
        correctAnswer: 0,
        level: 'beginner'
    },
    {
        question: 'Как будет "Спасибо" на казахском?',
        options: ['Жақсы', 'Рахмет', 'Кешіріңіз', 'Бәрі дұрыс'],
        correctAnswer: 1,
        level: 'beginner'
    },
    {
        question: 'Что означает "Әке"?',
        options: ['Мать', 'Отец', 'Брат', 'Сестра'],
        correctAnswer: 1,
        level: 'beginner'
    },
    {
        question: 'Как будет "Вода" на казахском?',
        options: ['Сүт', 'Су', 'Нан', 'Ет'],
        correctAnswer: 1,
        level: 'beginner'
    },
    {
        question: 'Что означает "Қалайсыздар"?',
        options: ['Как дела?', 'До свидания', 'Извините', 'Пожалуйста'],
        correctAnswer: 0,
        level: 'beginner'
    },

    // Средний уровень (B1-B2)
    {
        question: 'Как правильно сказать "Я учу казахский язык"?',
        options: ['Мен қазақ тілін үйренемін', 'Мен қазақ тілі үйренемін', 'Мен қазақ тілін оқимын', 'Мен қазақ тілі оқимын'],
        correctAnswer: 0,
        level: 'intermediate'
    },
    {
        question: 'Что означает "Қайда барасыңдар?"?',
        options: ['Откуда вы?', 'Куда вы идёте?', 'Где вы живёте?', 'Когда вы приедете?'],
        correctAnswer: 1,
        level: 'intermediate'
    },
    {
        question: 'Как будет "Сегодня хорошая погода"?',
        options: ['Бүгін ауа райы жақсы', 'Бүгін ауа райы керемет', 'Бүгін күн сұлу', 'Бүгін күн жылы'],
        correctAnswer: 0,
        level: 'intermediate'
    },
    {
        question: 'Что означает "Қанша тұрады?"?',
        options: ['Сколько стоит?', 'Сколько времени?', 'Сколько лет?', 'Сколько человек?'],
        correctAnswer: 0,
        level: 'intermediate'
    },
    {
        question: 'Как правильно сказать "Я не понимаю"?',
        options: ['Мен түсінбеймін', 'Мен білмеймін', 'Мен көрмеймін', 'Мен естімеймін'],
        correctAnswer: 0,
        level: 'intermediate'
    },
    {
        question: 'Что означает "Кешіріңіз, мен кешіктім"?',
        options: ['Извините, я опоздал', 'Извините, я не понял', 'Извините, я ошибся', 'Извините, я забыл'],
        correctAnswer: 0,
        level: 'intermediate'
    }
];

/**
 * Генерация вопросов для теста на определение уровня
 */
function generateTestQuestions() {
    testQuestions = [...levelTestQuestions];

    // Перемешиваем вопросы
    for (let i = testQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [testQuestions[i], testQuestions[j]] = [testQuestions[j], testQuestions[i]];
    }

    // Берем 8 вопросов (примерно половина от 15)
    testQuestions = testQuestions.slice(0, Math.min(8, testQuestions.length));

    return testQuestions;
}

/**
 * Создание модального окна теста
 */
function createTestModal() {
    if (testModal) return testModal;

    testModal = document.createElement('div');
    testModal.id = 'test-modal';
    testModal.className = 'modal';
    testModal.style.display = 'none';
    testModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; position: relative;">
            <button class="auth-modal-close" id="test-close-x-btn" title="Закрыть без сохранения">&times;</button>
            <div class="test-header">
                <h2 id="test-title">Тест по Казахскому</h2>
                <div id="test-progress">Вопрос 1 из ${testQuestions.length}</div>
            </div>
            <div id="test-content" class="test-content"></div>
            <div id="test-results" class="test-results" style="display: none;">
                <h3>Результаты теста</h3>
                <div id="test-score"></div>
                <button id="test-close-btn" class="auth-submit-btn">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(testModal);

    // Обработчик крестика (закрытие без сохранения)
    testModal.querySelector('#test-close-x-btn').onclick = () => {
        closeTest();
    };

    // Обработчик кнопки "Закрыть" на экране результатов
    testModal.querySelector('#test-close-btn').onclick = () => {
        closeTest();
    };

    return testModal;
}

/**
 * Показать модальное окно запроса входа
 */
function showLoginRequiredModal() {
    const loginModal = document.getElementById('test-login-required-modal');
    if (!loginModal) return;

    loginModal.style.display = 'grid';
    document.body.style.overflow = 'hidden';

    // Обработчики кнопок
    const loginBtn = document.getElementById('test-login-btn');
    const cancelBtn = document.getElementById('test-cancel-btn');

    if (loginBtn) {
        loginBtn.onclick = () => {
            loginModal.style.display = 'none';
            document.body.style.overflow = '';
            // Показываем окно входа
            showLogin();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            loginModal.style.display = 'none';
            document.body.style.overflow = '';
        };
    }
}

/**
 * Показать тест
 */
export function showTest() {
    const user = getCurrentUser();
    if (!user) {
        showLoginRequiredModal();
        return;
    }

    // Генерируем вопросы
    generateTestQuestions();

    if (testQuestions.length === 0) {
        alert('Нет доступных вопросов для теста.');
        return;
    }

    // Сбрасываем состояние
    currentQuestionIndex = 0;
    testAnswers = [];

    // Создаем и показываем модальное окно
    createTestModal();
    testModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    renderQuestion();
}

/**
 * Отображение текущего вопроса
 */
function renderQuestion() {
    if (currentQuestionIndex >= testQuestions.length) {
        showResults();
        return;
    }

    const question = testQuestions[currentQuestionIndex];
    const content = testModal.querySelector('#test-content');
    const progress = testModal.querySelector('#test-progress');
    const results = testModal.querySelector('#test-results');

    results.style.display = 'none';
    content.style.display = 'block';

    progress.textContent = `Вопрос ${currentQuestionIndex + 1} из ${testQuestions.length}`;

    content.innerHTML = `
        <div class="test-question">${question.question}</div>
        <div class="test-options"></div>
    `;

    const optionsContainer = content.querySelector('.test-options');

    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'task-opt-btn';
        btn.textContent = option;
        btn.onclick = () => selectAnswer(index);
        optionsContainer.appendChild(btn);
    });
}

/**
 * Выбор ответа
 */
function selectAnswer(selectedIndex) {
    const question = testQuestions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswer;

    testAnswers.push({
        questionIndex: currentQuestionIndex,
        selectedAnswer: selectedIndex,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect
    });

    // Показываем правильный ответ
    const options = testModal.querySelectorAll('.task-opt-btn');
    options.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === question.correctAnswer) {
            btn.style.background = 'var(--secondary-color)';
            btn.style.color = '#fff';
        } else if (idx === selectedIndex && !isCorrect) {
            btn.style.background = 'var(--danger-color)';
            btn.style.color = '#fff';
        }
    });

    // Переходим к следующему вопросу через 1 секунду
    setTimeout(() => {
        currentQuestionIndex++;
        renderQuestion();
    }, 1000);
}

/**
 * Показать результаты теста
 */
async function showResults() {
    const content = testModal.querySelector('#test-content');
    const results = testModal.querySelector('#test-results');
    const scoreEl = testModal.querySelector('#test-score');

    content.style.display = 'none';
    results.style.display = 'block';

    const correctAnswers = testAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = testQuestions.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    scoreEl.innerHTML = `
        <div style="font-size: 2em; margin: 20px 0;">
            ${correctAnswers} из ${totalQuestions}
        </div>
        <div style="font-size: 1.2em; color: var(--secondary-color);">
            ${percentage}% правильных ответов
        </div>
    `;

    // Разблокируем достижение "Полиглот"
    unlockAchievement('polyglot');

    // Сохраняем результат на сервер
    const user = getCurrentUser();
    if (user && user.userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/test-result`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.userId,
                    score: correctAnswers,
                    total_questions: totalQuestions
                })
            });

            if (response.ok) {
                console.log('Test result saved successfully');
                // Обновляем лидерборд
                if (window.updateLeaderboard) {
                    window.updateLeaderboard();
                }
            } else {
                console.error('Failed to save test result');
            }
        } catch (error) {
            console.error('Error saving test result:', error);
        }
    }
}

/**
 * Закрыть тест
 */
function closeTest() {
    if (testModal) {
        testModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

