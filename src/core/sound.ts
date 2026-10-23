// --- The chimes (Web Audio) ---
// The audio context can only start after the player touched the page, so initAudio() is
// called when a quiz or a 対戦 starts.
let audioCtx: AudioContext | null = null;

export function initAudio() {
    if (audioCtx) return;
    try {
        const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Context();
    } catch {
        console.error('Web Audio API is not supported in this browser');
    }
}

function tone(ctx: AudioContext, type: OscillatorType, freq: number, start: number, stop: number) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(ctx.destination);
    osc.start(start);
    osc.stop(stop);
}

// The chime goes up a little with every correct answer in a row
export function playSound(correct: boolean, streak = 1) {
    const ctx = audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (correct) {
        const lift = 1 + Math.min(streak - 1, 8) * 0.06;
        tone(ctx, 'sine', 600 * lift, now, now + 0.1);
        tone(ctx, 'sine', 800 * lift, now + 0.1, now + 0.2);
    } else {
        tone(ctx, 'sawtooth', 200, now, now + 0.3);
    }
}

export function playResultSound(percentage: number) {
    const ctx = audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (percentage === 100) {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, 'sine', freq, now + i * 0.15, now + i * 0.15 + 0.1));
    } else if (percentage >= 80) {
        [783.99, 1046.5].forEach((freq, i) => tone(ctx, 'sine', freq, now + i * 0.1, now + i * 0.1 + 0.15));
    } else if (percentage >= 50) {
        tone(ctx, 'sine', 523.25, now, now + 0.2);
    } else {
        [392.0, 369.99].forEach((freq, i) => tone(ctx, 'sawtooth', freq, now + i * 0.15, now + i * 0.15 + 0.2));
    }
}
