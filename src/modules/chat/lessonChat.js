// Боковой ИИ-чат внутри окна урока.
// Маунтится при открытии урока, демаунтится при закрытии — за пределами
// урока кнопка не видна. Сообщения уходят на /api/chat, который проксирует
// запрос к Groq (Llama). Текущий шаг урока передаётся в контексте, чтобы
// бот мог отвечать предметно.
import { apiPost } from '../../services/apiClient.js';

let mounted = false;
let dom = null;
let lessonCtx = null;
let history = [];
let panelOpen = false;
let sending = false;

const GREETING = 'Привет! Я помогу с уроком. Спроси, что непонятно 🧡';

// ---------- Жизненный цикл ----------
export function mountLessonChat(initialLesson) {
    if (mounted) {
        updateLessonContext(initialLesson);
        return;
    }
    history = [];
    panelOpen = false;
    sending = false;
    lessonCtx = sanitizeLesson(initialLesson);

    const root = document.createElement('div');
    root.className = 'lesson-chat';
    root.innerHTML = `
        <button type="button" class="lesson-chat-fab" aria-label="ИИ-помощник">
            <img src="assets/images/horse_happy.png" alt="" class="lesson-chat-fab-icon" aria-hidden="true">
        </button>
        <div class="lesson-chat-panel" hidden>
            <div class="lesson-chat-head">
                <div class="lesson-chat-title">Помощник</div>
                <button type="button" class="lesson-chat-close" aria-label="Закрыть">✕</button>
            </div>
            <div class="lesson-chat-log" role="log" aria-live="polite"></div>
            <form class="lesson-chat-form" autocomplete="off">
                <input type="text" class="lesson-chat-input"
                       placeholder="Спросить про урок…" maxlength="500"
                       aria-label="Сообщение помощнику">
                <button type="submit" class="lesson-chat-send" aria-label="Отправить">➤</button>
            </form>
        </div>
    `;
    document.body.appendChild(root);

    dom = {
        root,
        fab: root.querySelector('.lesson-chat-fab'),
        panel: root.querySelector('.lesson-chat-panel'),
        log: root.querySelector('.lesson-chat-log'),
        form: root.querySelector('.lesson-chat-form'),
        input: root.querySelector('.lesson-chat-input'),
        send: root.querySelector('.lesson-chat-send'),
        close: root.querySelector('.lesson-chat-close')
    };

    dom.fab.addEventListener('click', () => setPanelOpen(!panelOpen));
    dom.close.addEventListener('click', () => setPanelOpen(false));
    dom.form.addEventListener('submit', onSubmit);

    appendMsg('assistant', GREETING);
    mounted = true;
}

export function unmountLessonChat() {
    if (!mounted) return;
    if (dom && dom.root) dom.root.remove();
    dom = null;
    mounted = false;
    panelOpen = false;
    sending = false;
    history = [];
    lessonCtx = null;
}

export function updateLessonContext(lessonInfo) {
    if (!mounted) return;
    lessonCtx = sanitizeLesson(lessonInfo);
}

// ---------- Внутренности ----------
function sanitizeLesson(lesson) {
    if (!lesson) return null;
    const out = {
        title: typeof lesson.title === 'string' ? lesson.title.slice(0, 120) : '',
        subtitle: typeof lesson.subtitle === 'string' ? lesson.subtitle.slice(0, 120) : ''
    };
    const s = lesson.step;
    if (s && typeof s === 'object') {
        const step = { type: s.type };
        if (s.title) step.title = String(s.title).slice(0, 160);
        if (s.eyebrow) step.eyebrow = String(s.eyebrow).slice(0, 160);
        if (s.html) step.html = String(s.html).slice(0, 1200);
        if (s.question) step.question = String(s.question).slice(0, 240);
        if (Array.isArray(s.options)) step.options = s.options.slice(0, 8).map(o => String(o).slice(0, 120));
        if (Array.isArray(s.pairs)) {
            step.pairs = s.pairs.slice(0, 12).map(p => ({
                kz: String(p.kz || '').slice(0, 80),
                ru: String(p.ru || '').slice(0, 80)
            }));
        }
        if (Array.isArray(s.tokens)) step.tokens = s.tokens.slice(0, 16).map(t => String(t).slice(0, 80));
        if (s.ru) step.ru = String(s.ru).slice(0, 240);
        out.step = step;
    }
    return out;
}

function setPanelOpen(open) {
    panelOpen = !!open;
    if (!dom) return;
    dom.panel.hidden = !panelOpen;
    dom.root.classList.toggle('is-open', panelOpen);
    if (panelOpen) {
        setTimeout(() => { if (dom && dom.input) dom.input.focus(); }, 50);
    }
}

function appendMsg(role, content) {
    if (!dom) return null;
    const el = document.createElement('div');
    el.className = `lesson-chat-msg lesson-chat-msg--${role}`;
    el.textContent = content;
    dom.log.appendChild(el);
    dom.log.scrollTop = dom.log.scrollHeight;
    return el;
}

function setSending(busy) {
    sending = busy;
    if (!dom) return;
    dom.input.disabled = busy;
    dom.send.disabled = busy;
}

async function onSubmit(e) {
    e.preventDefault();
    if (sending || !dom) return;
    const text = dom.input.value.trim();
    if (!text) return;

    dom.input.value = '';
    appendMsg('user', text);
    history.push({ role: 'user', content: text });

    setSending(true);
    const typing = appendMsg('assistant', '…');
    if (typing) typing.classList.add('is-typing');

    try {
        const res = await apiPost('/chat', { messages: history, lesson: lessonCtx });
        if (!res || !res.ok) {
            const err = await safeJson(res);
            if (typing) {
                typing.classList.remove('is-typing');
                typing.textContent = (err && err.error) || 'Не получилось ответить. Попробуйте позже.';
            }
            return;
        }
        const data = await res.json();
        const reply = (data && data.reply) || '…';
        if (typing) {
            typing.classList.remove('is-typing');
            typing.textContent = reply;
        }
        history.push({ role: 'assistant', content: reply });
        // Ограничиваем историю — иначе контекст для модели разрастается.
        if (history.length > 20) history = history.slice(-20);
    } catch (err) {
        if (typing) {
            typing.classList.remove('is-typing');
            typing.textContent = 'Сбой связи. Попробуйте снова.';
        }
    } finally {
        setSending(false);
    }
}

async function safeJson(res) {
    try { return res ? await res.json() : null; } catch { return null; }
}
