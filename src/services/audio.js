// Аудио-произношение слов.
// Двухуровневый: mp3 если есть, иначе Web Speech API (kk-KZ → tr-TR fallback).

let voices = [];
let voicesLoaded = false;

/**
 * Прогревает список голосов. Вызывается один раз в initializeApp.
 * speechSynthesis.getVoices() в Chrome асинхронный — ждём voiceschanged.
 */
export function preloadVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    voices = speechSynthesis.getVoices();
    if (voices.length > 0) { voicesLoaded = true; return; }
    speechSynthesis.addEventListener('voiceschanged', () => {
        voices = speechSynthesis.getVoices();
        voicesLoaded = true;
    });
}

function findVoice() {
    const kkVoice = voices.find(v => v.lang === 'kk-KZ' || v.lang === 'kk');
    if (kkVoice) return kkVoice;
    const trVoice = voices.find(v => v.lang === 'tr-TR' || v.lang === 'tr');
    return trVoice ?? null;
}

/**
 * Произносит казахское слово.
 * @param {string} text — казахское слово
 * @param {string|null} audioUrl — опциональный путь к mp3
 * @param {{ onStart?: ()=>void, onEnd?: ()=>void }} callbacks
 */
export async function speakKazakh(text, audioUrl = null, callbacks = {}) {
    const { onStart, onEnd } = callbacks;

    if (audioUrl) {
        try {
            const audio = new Audio(audioUrl);
            audio.addEventListener('play', onStart);
            audio.addEventListener('ended', onEnd);
            audio.addEventListener('error', () => {
                // Fallback на Web Speech при ошибке загрузки mp3
                speakWithTTS(text, callbacks);
            });
            await audio.play();
            return;
        } catch {
            // Fallback
        }
    }

    speakWithTTS(text, callbacks);
}

function speakWithTTS(text, { onStart, onEnd } = {}) {
    if (typeof speechSynthesis === 'undefined') {
        onEnd?.();
        return;
    }

    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;

    const voice = findVoice();
    if (voice) {
        utt.voice = voice;
        utt.lang = voice.lang;
    } else {
        utt.lang = 'kk-KZ';
    }

    utt.onstart = onStart;
    utt.onend = onEnd;
    utt.onerror = onEnd;
    speechSynthesis.speak(utt);
}

export function hasAudioSupport() {
    return typeof speechSynthesis !== 'undefined' || typeof Audio !== 'undefined';
}
