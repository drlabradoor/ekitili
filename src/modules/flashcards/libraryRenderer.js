// Библиотека слов: что уже в ротации (все/учу/выучено) и что можно добавить (доступно).

import { userWords, enrollWord, enrollWords } from '../../data/userWords.js';
import { getWord, WORDS } from '../../data/words.js';
import { syncFlashcardsShim } from '../../data/flashcards.js';
import { speakKazakh } from '../../services/audio.js';
import { postEnroll } from '../../services/srsSync.js';

const SRS_COLORS = ['', '#fbbc05', '#4285f4', '#34a853', '#a142f4', '#ea4335'];

// Внешние модули могут попросить открыть библиотеку с конкретным фильтром.
let pendingInitialFilter = null;
export function setInitialLibraryFilter(filter) { pendingInitialFilter = filter; }

export function renderLibrary(container) {
    let currentFilter = pendingInitialFilter || 'all';
    pendingInitialFilter = null;
    let searchQuery = '';

    container.innerHTML = `
        <div class="srs-library">
            <div class="srs-lib-header">
                <div class="srs-lib-header-top">
                    <input class="srs-lib-search" id="srs-lib-search" type="text"
                        placeholder="Поиск по слову..." autocomplete="off">
                    <div class="srs-lib-counter" id="srs-lib-counter"></div>
                </div>
                <div class="srs-lib-filters" id="srs-lib-filters">
                    <button class="srs-lib-filter-btn" data-filter="all">Все</button>
                    <button class="srs-lib-filter-btn" data-filter="learning">Учу</button>
                    <button class="srs-lib-filter-btn" data-filter="reviewed">Выучено</button>
                    <button class="srs-lib-filter-btn" data-filter="available">Доступно</button>
                </div>
                <div class="srs-lib-batch" id="srs-lib-batch"></div>
            </div>
            <div class="srs-lib-table" id="srs-lib-table"></div>
        </div>
    `;

    function updateCounter() {
        const enrolled = Object.keys(userWords).length;
        const total = Object.keys(WORDS).length;
        const counterEl = container.querySelector('#srs-lib-counter');
        if (counterEl) counterEl.textContent = `${enrolled} / ${total} слов`;
    }

    function setActiveFilterBtn() {
        container.querySelectorAll('.srs-lib-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === currentFilter);
        });
    }

    function renderBatchActions() {
        const batchEl = container.querySelector('#srs-lib-batch');
        if (!batchEl) return;
        batchEl.innerHTML = '';
        if (currentFilter !== 'available') return;

        const available = getAvailableWords();
        if (available.length === 0) return;

        [5, 10].forEach(n => {
            if (available.length < 1) return;
            const btn = document.createElement('button');
            btn.className = 'srs-lib-batch-btn';
            btn.textContent = `+ ${Math.min(n, available.length)} случайных`;
            btn.addEventListener('click', () => addRandomAvailable(Math.min(n, available.length)));
            batchEl.appendChild(btn);
        });
    }

    function getAvailableWords() {
        return Object.values(WORDS)
            .filter(w => !userWords[w.id])
            .sort((a, b) => (a.difficulty ?? 1) - (b.difficulty ?? 1));
    }

    function getEnrolledFiltered() {
        return Object.values(userWords).map(uw => {
            const word = getWord(uw.wordId);
            return word ? { ...uw, _word: word } : null;
        }).filter(Boolean).filter(uw => {
            if (currentFilter === 'learning' && (uw.status === 'new' || uw.status === 'mastered')) return false;
            if (currentFilter === 'reviewed' && uw.status !== 'reviewed' && uw.status !== 'mastered') return false;
            return true;
        });
    }

    function matchesSearch(word) {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return word.kz.toLowerCase().includes(q) || word.ru.toLowerCase().includes(q);
    }

    function renderTable() {
        const table = container.querySelector('#srs-lib-table');
        if (!table) return;
        table.innerHTML = '';

        if (currentFilter === 'available') {
            const rows = getAvailableWords().filter(w => matchesSearch(w));
            if (rows.length === 0) {
                table.innerHTML = '<div class="srs-lib-empty">Все слова уже в ротации 🎉</div>';
                return;
            }
            table.appendChild(buildHeaderRow('add'));
            rows.forEach(word => table.appendChild(buildAvailableRow(word)));
        } else {
            const rows = getEnrolledFiltered().filter(uw => matchesSearch(uw._word));
            if (rows.length === 0) {
                table.innerHTML = '<div class="srs-lib-empty">Ничего не найдено.</div>';
                return;
            }
            table.appendChild(buildHeaderRow('srs'));
            rows.forEach(uw => table.appendChild(buildEnrolledRow(uw)));
        }
    }

    function buildHeaderRow(mode) {
        const row = document.createElement('div');
        row.className = 'lib-row lib-header';
        row.innerHTML = `
            <div>Слово (KZ)</div>
            <div>Перевод</div>
            <div>Транскрипция</div>
            <div>${mode === 'add' ? '' : 'SRS'}</div>
            <div></div>
        `;
        return row;
    }

    function buildEnrolledRow(uw) {
        const word = uw._word;
        const color = SRS_COLORS[uw.srsLevel] || '#bbb';
        const row = document.createElement('div');
        row.className = 'lib-row';
        row.innerHTML = `
            <div class="lib-cell lib-kz">${escapeHtml(word.kz)}</div>
            <div class="lib-cell">${escapeHtml(word.ru)}${word.ruAlt ? ` <span class="lib-alt">(${escapeHtml(word.ruAlt[0])})</span>` : ''}</div>
            <div class="lib-cell lib-phonetic">${escapeHtml(word.phonetic || '')}</div>
            <div class="lib-cell">
                <span class="lib-srs" style="background:${color}" title="Уровень ${uw.srsLevel}">${uw.srsLevel}</span>
                ${(uw.ruLevel ?? 0) > 0 ? `<span class="lib-srs lib-srs-ru" style="background:${SRS_COLORS[uw.ruLevel]}" title="→KZ уровень ${uw.ruLevel}">${uw.ruLevel}</span>` : ''}
            </div>
            <div class="lib-cell">
                <button class="srs-audio-btn srs-audio-btn-sm lib-audio-btn" aria-label="Произнести">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
        row.querySelector('.lib-audio-btn')?.addEventListener('click', () => speakKazakh(word.kz, word.audioUrl));
        return row;
    }

    function buildAvailableRow(word) {
        const row = document.createElement('div');
        row.className = 'lib-row';
        row.innerHTML = `
            <div class="lib-cell lib-kz">${escapeHtml(word.kz)}</div>
            <div class="lib-cell">${escapeHtml(word.ru)}${word.ruAlt ? ` <span class="lib-alt">(${escapeHtml(word.ruAlt[0])})</span>` : ''}</div>
            <div class="lib-cell lib-phonetic">${escapeHtml(word.phonetic || '')}</div>
            <div class="lib-cell">
                <span class="srs-lib-available-badge">Новое</span>
            </div>
            <div class="lib-cell lib-add-cell">
                <button class="srs-audio-btn srs-audio-btn-sm lib-audio-btn" aria-label="Произнести">
                    <i class="fas fa-volume-up"></i>
                </button>
                <button class="srs-lib-add-btn" data-wordid="${word.id}">
                    <i class="fas fa-plus"></i> Добавить
                </button>
            </div>
        `;
        row.querySelector('.lib-audio-btn')?.addEventListener('click', () => speakKazakh(word.kz, word.audioUrl));
        row.querySelector('.srs-lib-add-btn')?.addEventListener('click', () => addOne(word.id));
        return row;
    }

    async function addOne(wordId) {
        enrollWord({ wordId, fromLessonId: null });
        syncFlashcardsShim();
        postEnroll([wordId], null).catch(() => {});
        refresh();
    }

    async function addRandomAvailable(count) {
        const available = getAvailableWords();
        if (available.length === 0) return;
        const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, count);
        const ids = shuffled.map(w => w.id);
        enrollWords(ids, null);
        syncFlashcardsShim();
        postEnroll(ids, null).catch(() => {});
        refresh();
    }

    function refresh() {
        updateCounter();
        renderBatchActions();
        renderTable();
    }

    // Init
    setActiveFilterBtn();
    refresh();

    container.querySelector('#srs-lib-search')?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderTable();
    });

    container.querySelectorAll('.srs-lib-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            setActiveFilterBtn();
            refresh();
        });
    });
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
