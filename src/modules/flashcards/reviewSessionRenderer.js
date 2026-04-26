// Рендеринг сессии повторения карточек (новый UI).

import { userWords, updateUserWord } from '../../data/userWords.js';
import { syncFlashcardsShim } from '../../data/flashcards.js';
import { getWord } from '../../data/words.js';
import { applyReview } from '../../services/srsEngine.js';
import { classifyAnswer, getCurrentTolerance, recalcTolerance } from '../../services/fuzzyMatch.js';
import { speakKazakh } from '../../services/audio.js';
import { buildReviewQueue, getDailyProgress, incrementDailyProgress, suggestExtraWords } from '../../services/wordQueue.js';
import { postReview } from '../../services/srsSync.js';
import { recordActivity } from '../../services/streak.js';

const SRS_INTERVALS = [0, 1, 3, 7, 21];

// Текущее состояние сессии (module-level)
let sessionContainer = null;  // DOM-элемент, переданный в renderReviewSession
let queue = [];
let queueIdx = 0;
let sessionMistakes = new Map(); // `${wordId}:${direction}` → attempts
let isAwaitingContinue = false;
let isPlaying = false;

function sessionKey(task) { return `${task.wordId}:${task.direction}`; }

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDailyGoal() {
    return parseInt(localStorage.getItem('ekitili_daily_goal_v1') ?? '10', 10);
}

// =====================================================
// Точка входа
// =====================================================
export function renderReviewSession(el, { recentLessonIds = [] } = {}) {
    sessionContainer = el;
    queue = buildReviewQueue(recentLessonIds, 50);
    queueIdx = 0;
    sessionMistakes = new Map();
    isAwaitingContinue = false;

    if (queue.length === 0) {
        renderEmptyState();
        return;
    }

    renderSessionShell();
    showCurrentCard();
}

// =====================================================
// Shell сессии
// =====================================================
function renderSessionShell() {
    sessionContainer.innerHTML = `
        <div class="srs-session">
            <div class="srs-progress">
                <div class="srs-progress-count">0 / ${queue.length}</div>
                <div class="srs-progress-bar"><div class="srs-progress-bar-fill" style="width:0%"></div></div>
                <div class="srs-progress-goal"></div>
            </div>
            <div class="srs-card-area"></div>
        </div>
    `;
    updateProgressBar();
}

function updateProgressBar() {
    const prog = sessionContainer?.querySelector('.srs-progress');
    if (!prog) return;
    const { done, goal } = getDailyProgress();
    const pct = queue.length > 0 ? Math.min(100, Math.round((queueIdx / queue.length) * 100)) : 100;
    prog.querySelector('.srs-progress-bar-fill').style.width = pct + '%';
    prog.querySelector('.srs-progress-count').textContent = `${queueIdx} / ${queue.length}`;
    prog.querySelector('.srs-progress-goal').textContent = done >= goal ? '✅ Норма' : `${done}/${goal}`;
}

// =====================================================
// Отображение карточки
// =====================================================
function showCurrentCard() {
    if (queueIdx >= queue.length) {
        renderSessionComplete();
        return;
    }

    const task = queue[queueIdx];
    const word = getWord(task.wordId);
    if (!word) { queueIdx++; showCurrentCard(); return; }

    const area = sessionContainer?.querySelector('.srs-card-area');
    if (!area) return;

    isAwaitingContinue = false;

    const isRuToKz = task.direction === 'ru_to_kz';
    const prompt = isRuToKz ? word.ru : word.kz;
    const promptPhonetic = isRuToKz ? '' : word.phonetic;
    const dirLabel = isRuToKz ? '→ KZ' : '→ RU';

    area.innerHTML = `
        <div class="srs-card" id="srs-card">
            <div class="srs-card-dir-label">${dirLabel}</div>
            <div class="srs-card-word">
                <span class="srs-card-word-text">${escapeHtml(prompt)}</span>
                ${!isRuToKz ? `<button class="srs-audio-btn" id="srs-audio-btn" title="Произнести" aria-label="Произнести слово">
                    <i class="fas fa-volume-up"></i>
                </button>` : ''}
            </div>
            ${promptPhonetic ? `<div class="srs-card-phonetic">${escapeHtml(promptPhonetic)}</div>` : ''}
            ${isRuToKz ? renderKzChipsHTML() : ''}
            <div class="srs-input-wrap">
                <input class="srs-input" id="srs-input" type="text"
                    lang="${isRuToKz ? 'kk' : 'ru'}"
                    autocomplete="off" autocapitalize="off"
                    autocorrect="off" spellcheck="false"
                    inputmode="text"
                    placeholder="${isRuToKz ? 'Напишите на казахском...' : 'Введите перевод...'}">
            </div>
            <div class="srs-actions">
                <button class="srs-btn-primary" id="srs-check-btn">Проверить</button>
                <button class="srs-btn-secondary" id="srs-skip-btn">Не помню</button>
            </div>
            <div class="srs-feedback-area"></div>
        </div>
    `;

    const input = area.querySelector('#srs-input');
    const checkBtn = area.querySelector('#srs-check-btn');
    const skipBtn = area.querySelector('#srs-skip-btn');
    const audioBtn = area.querySelector('#srs-audio-btn');

    audioBtn?.addEventListener('click', () => playAudio(word, audioBtn));
    if (isRuToKz) bindKzChips(area, input);

    input?.focus();

    input?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); isAwaitingContinue ? advanceCard() : handleCheck(task, word, input); }
        if (e.key === 'Escape') { e.preventDefault(); handleSkip(task, word); }
    });

    checkBtn?.addEventListener('click', () => handleCheck(task, word, input));
    skipBtn?.addEventListener('click', () => handleSkip(task, word));
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderKzChipsHTML() {
    const chars = ['ә', 'ғ', 'қ', 'ң', 'ө', 'ұ', 'ү', 'һ', 'і'];
    return `<div class="srs-kz-chips">${chars.map(ch =>
        `<button type="button" class="srs-chip" data-char="${ch}">${ch.toUpperCase()}</button>`
    ).join('')}</div>`;
}

function bindKzChips(area, input) {
    area.querySelectorAll('.srs-chip').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault();
            if (!input) return;
            const ch = btn.dataset.char;
            const start = input.selectionStart, end = input.selectionEnd;
            const char = start === 0 ? ch.toUpperCase() : ch;
            input.value = input.value.slice(0, start) + char + input.value.slice(end);
            input.setSelectionRange(start + char.length, start + char.length);
            input.focus();
        });
    });
}

async function playAudio(word, btn) {
    if (isPlaying) return;
    isPlaying = true;
    btn?.classList.add('is-playing');
    await speakKazakh(word.kz, word.audioUrl, {
        onEnd: () => { isPlaying = false; btn?.classList.remove('is-playing'); }
    });
}

// =====================================================
// Проверка ответа
// =====================================================
function handleCheck(task, word, input) {
    if (isAwaitingContinue) { advanceCard(); return; }
    const userInput = input?.value?.trim() ?? '';
    if (!userInput) { handleSkip(task, word); return; }

    const isRuToKz = task.direction === 'ru_to_kz';
    const expected = isRuToKz ? word.kz : word.ru;
    const alts = isRuToKz ? [] : (word.ruAlt ?? []);

    const tolerance = getCurrentTolerance();
    const outcome = classifyAnswer(userInput, expected, alts, tolerance);
    recalcTolerance(outcome);

    const key = sessionKey(task);
    const prevMistakes = sessionMistakes.get(key) ?? 0;

    const uw = userWords[task.wordId];
    if (!uw) { queueIdx++; showCurrentCard(); return; }

    const { newUserWord, creditsDailyGoal } = applyReview({
        userWord: uw,
        direction: task.direction,
        outcome,
        attemptNumber: outcome === 'wrong' ? prevMistakes + 1 : 1
    });

    updateUserWord(task.wordId, newUserWord);
    syncFlashcardsShim();

    if (outcome === 'wrong') sessionMistakes.set(key, prevMistakes + 1);

    postReview({ wordId: task.wordId, direction: task.direction, outcome, attemptNumber: prevMistakes + 1, newUserWord });

    if (creditsDailyGoal) {
        const progress = incrementDailyProgress();
        if (progress.done === getDailyGoal()) recordActivity();
    }

    showFeedback(task, word, outcome, expected, isRuToKz);
}

function handleSkip(task, word) {
    if (isAwaitingContinue) { advanceCard(); return; }

    const key = sessionKey(task);
    const prevMistakes = sessionMistakes.get(key) ?? 0;
    sessionMistakes.set(key, prevMistakes + 1);

    const uw = userWords[task.wordId];
    if (uw) {
        const { newUserWord } = applyReview({
            userWord: uw,
            direction: task.direction,
            outcome: 'wrong',
            attemptNumber: prevMistakes + 1
        });
        updateUserWord(task.wordId, newUserWord);
        syncFlashcardsShim();
        postReview({ wordId: task.wordId, direction: task.direction, outcome: 'wrong', attemptNumber: prevMistakes + 1, newUserWord });
    }

    const isRuToKz = task.direction === 'ru_to_kz';
    const expected = isRuToKz ? word.kz : word.ru;
    showFeedback(task, word, 'wrong', expected, isRuToKz);
}

function showFeedback(task, word, outcome, expected, isRuToKz) {
    isAwaitingContinue = true;

    const card = sessionContainer?.querySelector('#srs-card');
    if (!card) return;

    card.classList.remove('is-exact', 'is-near', 'is-wrong');
    card.classList.add(`is-${outcome}`);

    let icon, title, bodyHtml;
    if (outcome === 'exact') {
        icon = '✅'; title = 'Отлично!';
        bodyHtml = `<b>${escapeHtml(expected)}</b><br><small>${getNextDaysLabel(task)}</small>`;
    } else if (outcome === 'near') {
        icon = '⚠️'; title = 'Почти!';
        bodyHtml = `Правильно: <b>${escapeHtml(expected)}</b>`;
    } else {
        icon = '❌'; title = 'Не так.';
        bodyHtml = `Правильно: <b>${escapeHtml(expected)}</b>`;
    }

    const fbArea = card.querySelector('.srs-feedback-area');
    fbArea.innerHTML = `
        <div class="srs-feedback is-${outcome}">
            <div class="srs-feedback-icon">${icon}</div>
            <div class="srs-feedback-body">
                <div class="srs-feedback-title">${title}</div>
                <div class="srs-feedback-desc">${bodyHtml}</div>
            </div>
            ${!isRuToKz ? `<button class="srs-audio-btn srs-audio-btn-sm" id="srs-fb-audio" aria-label="Произнести">
                <i class="fas fa-volume-up"></i>
            </button>` : ''}
        </div>
    `;
    fbArea.querySelector('#srs-fb-audio')?.addEventListener('click', () => playAudio(word, fbArea.querySelector('#srs-fb-audio')));

    const checkBtn = card.querySelector('#srs-check-btn');
    const skipBtn = card.querySelector('#srs-skip-btn');
    const inputEl = card.querySelector('#srs-input');

    if (checkBtn) { checkBtn.textContent = 'Продолжить →'; checkBtn.onclick = advanceCard; }
    if (skipBtn) skipBtn.style.display = 'none';
    if (inputEl) inputEl.disabled = true;
    checkBtn?.focus();

    // Ошибка: добавляем карту в конец (до 2 раз)
    if (outcome === 'wrong') {
        const mistakes = sessionMistakes.get(sessionKey(task)) ?? 0;
        if (mistakes < 2) queue.push({ ...task });
    }

    updateProgressBar();

}

function advanceCard() {
    isAwaitingContinue = false;
    queueIdx++;
    showCurrentCard();
}

function getNextDaysLabel(task) {
    const uw = userWords[task.wordId];
    if (!uw) return '';
    const level = task.direction === 'kz_to_ru' ? uw.srsLevel : (uw.ruLevel ?? 1);
    const days = SRS_INTERVALS[(level ?? 1) - 1] ?? 0;
    if (days === 0) return 'Снова сегодня';
    if (days === 1) return 'Следующий показ: завтра';
    return `Следующий показ: через ${days} дн.`;
}

// =====================================================
// Пустое / завершённое состояние
// =====================================================
function renderEmptyState() {
    const { done, goal } = getDailyProgress();
    const goalDone = done >= goal;
    sessionContainer.innerHTML = `
        <div class="srs-session">
            <div class="srs-empty">
                <div class="srs-empty-illustration">${goalDone ? '🎉' : '📚'}</div>
                <div class="srs-empty-title">${goalDone ? 'Дневная норма выполнена!' : 'На сегодня всё!'}</div>
                <div class="srs-empty-sub">${goalDone ? `Повторено ${done} карточек. Приходите завтра!` : 'Нет карточек на повторение.'}</div>
                <div class="srs-empty-actions" id="srs-extra-actions"></div>
            </div>
        </div>
    `;
    renderExtraButtons(sessionContainer.querySelector('#srs-extra-actions'));
}

function renderSessionComplete() {
    const { done, goal } = getDailyProgress();
    sessionContainer.innerHTML = `
        <div class="srs-session">
            <div class="srs-empty">
                <div class="srs-empty-illustration">🎉</div>
                <div class="srs-empty-title">Сессия завершена!</div>
                <div class="srs-empty-sub">Повторено ${queueIdx} карточек. ${done >= goal ? 'Норма выполнена! 🔥' : `Сегодня: ${done}/${goal}`}</div>
                <div class="srs-empty-actions" id="srs-extra-actions"></div>
            </div>
        </div>
    `;
    renderExtraButtons(sessionContainer.querySelector('#srs-extra-actions'));
}

function renderExtraButtons(actionsEl) {
    if (!actionsEl) return;
    const extras = suggestExtraWords(1);
    if (extras.length === 0) return;

    const btn = document.createElement('button');
    btn.className = 'srs-extra-btn';
    btn.innerHTML = '<i class="fas fa-book"></i> Открыть библиотеку';
    btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('srs-open-library', {
            detail: { filter: 'available' }
        }));
    });
    actionsEl.appendChild(btn);
}
