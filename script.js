// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startKtoYBtn = document.getElementById('start-k-to-y');
const startYtoKBtn = document.getElementById('start-y-to-k');
const retryBtn = document.getElementById('retry-btn');
const quitBtn = document.getElementById('quit-btn');

const gradePills = document.querySelectorAll('.grade-pill');
const countPills = document.querySelectorAll('.count-pill');

const progressBar = document.getElementById('progress-bar');
const questionCounter = document.getElementById('question-counter');
const gradeBadge = document.getElementById('grade-badge');
const timerDisplay = document.getElementById('timer');
const questionEl = document.getElementById('question');
const optionButtons = Array.from(document.getElementsByClassName('option'));
const feedbackEl = document.getElementById('feedback');

const rankBadge = document.getElementById('rank-badge');
const scoreEl = document.getElementById('score');
const detailScoreEl = document.getElementById('detail-score');
const messageEl = document.getElementById('message');
const bestNoteEl = document.getElementById('best-note');
const resultHanamaru = document.getElementById('result-hanamaru');

const practiceDays = document.getElementById('practice-days');
const practiceDaysNum = document.getElementById('practice-days-num');
const bestEls = {
    'k-to-y': document.getElementById('best-k-to-y'),
    'y-to-k': document.getElementById('best-y-to-k')
};
const accountEl = document.getElementById('account');
const accountBody = document.getElementById('account-body');

// --- Quiz Settings & State ---
let selectedGrade = 'all'; // 'all' or '1'..'6'
let selectedQuestionCount = 10;

let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timerInterval;
let nextQuestionTimeout;
let quizMode = ''; // 'k-to-y' or 'y-to-k'
let quizItemId = ''; // record id of the quiz being played (mode + grade + count)
const TIME_LIMIT = 10;
let audioCtx;

// --- Event Listeners for Selectors ---
function selectPill(pills, attr, value) {
    pills.forEach(p => {
        const selected = p.dataset[attr] === String(value);
        p.classList.toggle('active', selected);
        p.setAttribute('aria-pressed', String(selected));
    });
}

gradePills.forEach(pill => {
    pill.addEventListener('click', () => {
        selectedGrade = pill.dataset.grade;
        selectPill(gradePills, 'grade', selectedGrade);
        Records.setSettings({ grade: selectedGrade });
        renderRecords();
    });
});

countPills.forEach(pill => {
    pill.addEventListener('click', () => {
        selectedQuestionCount = parseInt(pill.dataset.count, 10);
        selectPill(countPills, 'count', selectedQuestionCount);
        Records.setSettings({ count: selectedQuestionCount });
        renderRecords();
    });
});

// --- Records on the Start Screen ---
function formatBest(best) {
    return `${best.total}問中 ${best.best}問正解`;
}

function renderRecords() {
    Object.keys(bestEls).forEach(mode => {
        const best = Records.getBest(Records.itemId(mode, selectedGrade, selectedQuestionCount));
        bestEls[mode].hidden = !best;
        bestEls[mode].textContent = best ? `じこベスト ${formatBest(best)}` : '';
    });
    const days = Records.activeDayCount();
    practiceDays.hidden = days === 0;
    practiceDaysNum.textContent = `${days}日`;
}

// Restores the last selection and redraws the records (also after a sync replaced them)
function renderHome() {
    const settings = Records.getSettings();
    selectedGrade = settings.grade || selectedGrade;
    selectedQuestionCount = settings.count || selectedQuestionCount;
    selectPill(gradePills, 'grade', selectedGrade);
    selectPill(countPills, 'count', selectedQuestionCount);
    renderRecords();
}

// --- Account (Google Sign-In) ---
const ACCOUNT_TEXT = {
    note: 'Googleで ログインすると、ほかの ブラウザや たんまつでも 同じ きろくで 遊べます。ログインしなくても 遊べます。',
    signIn: 'Googleで ログイン',
    signedIn: 'ログイン中',
    signOut: 'ログアウト',
    loading: 'たしかめています…',
    syncing: 'ほぞん中…',
    synced: 'ほぞんずみ',
    offline: 'まだ ほぞんできていません。つながったら ほぞんします。',
    askMigrate: 'この たんまつの きろくを アカウントに うつしますか？\n\n「OK」… うつす (アカウントの きろくと 合わせます)\n「キャンセル」… うつさない (たんまつの きろくは そのまま のこります)',
    signOutUnsynced: 'まだ ほぞんできていない きろくが あります。今 ログアウトすると、その分は なくなります。ログアウトしますか？',
    signInFailed: 'ログインできませんでした。もういちど ためしてください。'
};

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function renderAccount() {
    const { uid, status } = Cloud.state;
    accountEl.hidden = !Cloud.available || status === 'unavailable';
    if (accountEl.hidden) return;

    if (status === 'loading') {
        accountBody.replaceChildren(el('p', 'account-status', ACCOUNT_TEXT.loading));
        return;
    }

    if (uid === null) {
        const error = el('p', 'account-error');
        error.setAttribute('role', 'alert');
        const button = el('button', 'btn btn-primary', ACCOUNT_TEXT.signIn);
        button.type = 'button';
        button.addEventListener('click', async () => {
            button.disabled = true;
            error.textContent = '';
            try {
                await Cloud.signIn();
            } catch (err) {
                // Say nothing when the user closed the sign-in window themselves
                const code = (err && err.code) || '';
                if (!/popup-closed-by-user|cancelled-popup-request/.test(code)) {
                    error.textContent = code ? `${ACCOUNT_TEXT.signInFailed} (${code})` : ACCOUNT_TEXT.signInFailed;
                }
                button.disabled = false;
            }
        });
        accountBody.replaceChildren(el('p', 'account-note', ACCOUNT_TEXT.note), button, error);
        return;
    }

    const stateLine = el('p', 'account-state');
    const statusEl = el('span', `account-status is-${status}`, ACCOUNT_TEXT[status] || '');
    statusEl.setAttribute('role', 'status');
    stateLine.append(el('b', '', ACCOUNT_TEXT.signedIn), statusEl);
    const signOut = el('button', 'btn', ACCOUNT_TEXT.signOut);
    signOut.type = 'button';
    signOut.addEventListener('click', async () => {
        signOut.disabled = true;
        if ((await Cloud.signOut()) === 'unsynced') {
            if (confirm(ACCOUNT_TEXT.signOutUnsynced)) await Cloud.signOut(true);
            else signOut.disabled = false;
        }
    });
    accountBody.replaceChildren(stateLine, signOut);
}

// --- Audio Logic ---
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }
}

function playSound(correct) {
    if (!audioCtx) return;

    if (correct) {
        const oscillator1 = audioCtx.createOscillator();
        oscillator1.type = 'sine';
        oscillator1.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator1.connect(audioCtx.destination);
        oscillator1.start();
        oscillator1.stop(audioCtx.currentTime + 0.1);

        const oscillator2 = audioCtx.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
        oscillator2.connect(audioCtx.destination);
        oscillator2.start(audioCtx.currentTime + 0.1);
        oscillator2.stop(audioCtx.currentTime + 0.2);
    } else {
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    }
}

function playResultSound(percentage) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (percentage === 100) {
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.connect(audioCtx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.1);
        });
    } else if (percentage >= 80) {
        const freqs = [783.99, 1046.50];
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            osc.connect(audioCtx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.15);
        });
    } else if (percentage >= 50) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    } else {
        const freqs = [392.00, 369.99];
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.connect(audioCtx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.2);
        });
    }
}

// --- Helpers ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// The spiral flower a teacher draws with a red pen (inside a 100 x 100 box)
function hanamaruPoints() {
    const pts = [];
    for (let i = 0; i <= 140; i++) {
        const t = i / 140;
        const a = t * 3 * Math.PI * 2 - Math.PI / 2;
        const r = 3 + t * 24;
        pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
    }
    for (let i = 1; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 2 - Math.PI / 2;
        const r = 27 + 13 * Math.abs(Math.sin(t * Math.PI * 6));
        pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
}

function showScreen(screen) {
    [startScreen, quizScreen, resultScreen].forEach(s => s.classList.toggle('active', s === screen));
    window.scrollTo(0, 0);
}

function getFilteredKanjiList() {
    if (selectedGrade === 'all') {
        return [...kanjiDatabase];
    }
    const targetGrade = parseInt(selectedGrade, 10);
    return kanjiDatabase.filter(item => item.grade === targetGrade);
}

// --- Quiz Controller ---
function startQuiz(mode) {
    initAudio();
    quizMode = mode;
    currentQuestionIndex = 0;
    score = 0;

    const availablePool = getFilteredKanjiList();
    const shuffledPool = shuffleArray([...availablePool]);
    
    // Total questions capped by available pool size
    const questionLimit = Math.min(selectedQuestionCount, shuffledPool.length);
    currentQuiz = shuffledPool.slice(0, questionLimit).map(item => {
        const targetReading = item.readings[Math.floor(Math.random() * item.readings.length)];
        return { ...item, targetReading };
    });

    quizItemId = Records.itemId(mode, selectedGrade, selectedQuestionCount);

    showScreen(quizScreen);
    displayQuestion();
}

function displayQuestion() {
    resetQuestionState();

    if (currentQuestionIndex >= currentQuiz.length) {
        endQuiz();
        return;
    }

    // Update Progress Bar
    const progressPercent = (currentQuestionIndex / currentQuiz.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    questionCounter.textContent = `第${currentQuestionIndex + 1}問 / ${currentQuiz.length}問`;

    const currentKanji = currentQuiz[currentQuestionIndex];
    gradeBadge.textContent = `${currentKanji.grade}年生`;

    let questionText, correctAnswer;
    if (quizMode === 'k-to-y') {
        questionText = currentKanji.kanji;
        correctAnswer = currentKanji.targetReading;
    } else {
        questionText = currentKanji.targetReading;
        correctAnswer = currentKanji.kanji;
    }

    questionEl.textContent = questionText;
    questionEl.classList.toggle('is-kanji', quizMode === 'k-to-y');
    optionButtons.forEach(button => button.classList.toggle('is-kanji', quizMode === 'y-to-k'));

    const options = generateOptions(currentKanji, correctAnswer);
    optionButtons.forEach((button, index) => {
        button.textContent = options[index];
        button.onclick = () => checkAnswer(button.textContent, correctAnswer);
    });

    startTimer();
}

function generateOptions(currentKanji, correctAnswer) {
    const options = [correctAnswer];
    const isReadingMode = quizMode === 'k-to-y';

    if (isReadingMode) {
        const currentReadings = currentKanji.readings;
        const pool = kanjiDatabase
            .flatMap(item => item.readings)
            .filter(r => !currentReadings.includes(r));

        while (options.length < 4 && pool.length > 0) {
            const randomOption = pool[Math.floor(Math.random() * pool.length)];
            if (!options.includes(randomOption)) {
                options.push(randomOption);
            }
        }
    } else {
        const targetReading = currentKanji.targetReading;
        const pool = kanjiDatabase
            .filter(item => !item.readings.includes(targetReading))
            .map(item => item.kanji);

        while (options.length < 4 && pool.length > 0) {
            const randomOption = pool[Math.floor(Math.random() * pool.length)];
            if (!options.includes(randomOption)) {
                options.push(randomOption);
            }
        }
    }
    return shuffleArray(options);
}

function startTimer() {
    timer = TIME_LIMIT;
    timerDisplay.textContent = timer;
    timerDisplay.classList.remove('warning');

    timerInterval = setInterval(() => {
        timer--;
        timerDisplay.textContent = timer;

        if (timer <= 3) {
            timerDisplay.classList.add('warning');
        }

        if (timer <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 1000);
}

function resetQuestionState() {
    clearInterval(timerInterval);
    feedbackEl.textContent = '';
    feedbackEl.className = '';
    timerDisplay.classList.remove('warning');

    optionButtons.forEach(button => {
        button.disabled = false;
        button.className = 'option';
        button.onclick = null;
        button.blur();
    });

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
}

function checkAnswer(selectedAnswer, correctAnswer) {
    clearInterval(timerInterval);
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    optionButtons.forEach(button => {
        button.disabled = true;
        button.blur();
    });

    if (selectedAnswer === correctAnswer) {
        score++;
        feedbackEl.textContent = '正解！';
        feedbackEl.classList.add('correct');
        highlightAnswer(selectedAnswer, true, correctAnswer);
        playSound(true);
    } else {
        feedbackEl.textContent = '不正解...';
        feedbackEl.classList.add('incorrect');
        highlightAnswer(selectedAnswer, false, correctAnswer);
        playSound(false);
    }

    nextQuestionTimeout = setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1400);
}

function handleTimeout() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    optionButtons.forEach(button => {
        button.disabled = true;
        button.blur();
    });
    feedbackEl.textContent = '時間切れ！';
    feedbackEl.classList.add('incorrect');
    const correctAnswer = (quizMode === 'k-to-y') ? currentQuiz[currentQuestionIndex].targetReading : currentQuiz[currentQuestionIndex].kanji;
    highlightAnswer(null, false, correctAnswer);
    playSound(false);

    nextQuestionTimeout = setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1400);
}

function highlightAnswer(selectedAnswer, isCorrect, correctAnswer) {
    optionButtons.forEach(button => {
        if (button.textContent === correctAnswer) {
            button.classList.add('correct');
        } else if (button.textContent === selectedAnswer && !isCorrect) {
            button.classList.add('incorrect');
        }
    });
}

function endQuiz() {
    showScreen(resultScreen);

    const total = currentQuiz.length;
    const percentage = Math.round((score / total) * 100);
    const scoreNum = document.createElement('b');
    scoreNum.textContent = percentage;
    scoreEl.replaceChildren('正解率 ', scoreNum, '%');
    detailScoreEl.textContent = `${total}問中 ${score}問正解`;

    // Rank Calculation
    let rank = 'D';
    let rankClass = 'rank-d';
    if (percentage === 100) {
        rank = 'RANK S';
        rankClass = 'rank-s';
        messageEl.textContent = 'おめでとう！パーフェクト！君は漢字マスターだ！';
    } else if (percentage >= 80) {
        rank = 'RANK A';
        rankClass = 'rank-a';
        messageEl.textContent = '素晴らしい！あと少しでパーフェクト！';
    } else if (percentage >= 60) {
        rank = 'RANK B';
        rankClass = 'rank-b';
        messageEl.textContent = 'よく頑張ったね！この調子で練習しよう！';
    } else if (percentage >= 40) {
        rank = 'RANK C';
        rankClass = 'rank-c';
        messageEl.textContent = 'まだまだ伸びしろがあるぞ！もう一度挑戦しよう！';
    } else {
        rank = 'RANK D';
        rankClass = 'rank-d';
        messageEl.textContent = 'お疲れ様！次はもっと点数が伸びるはず！';
    }

    rankBadge.textContent = rank;
    rankBadge.className = `rank-badge ${rankClass}`;
    resultHanamaru.toggleAttribute('hidden', percentage < 80);

    const { previous, isBest } = Records.recordResult(quizItemId, score, total);
    // Nothing to compare with on the first play
    bestNoteEl.hidden = !previous;
    bestNoteEl.classList.toggle('is-new', isBest);
    bestNoteEl.textContent = !previous ? '' : isBest ? 'じこベスト こうしん！' : `じこベスト ${formatBest(previous)}`;

    playResultSound(percentage);
}

// --- Global Handlers ---
startKtoYBtn.addEventListener('click', () => startQuiz('k-to-y'));
startYtoKBtn.addEventListener('click', () => startQuiz('y-to-k'));
retryBtn.addEventListener('click', () => {
    renderHome();
    showScreen(startScreen);
});
quitBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    clearTimeout(nextQuestionTimeout);
    renderHome();
    showScreen(startScreen);
});

// --- Init ---
resultHanamaru.querySelector('polyline').setAttribute('points', hanamaruPoints());
// On wide screens there is room for the how-to, so it starts open
document.getElementById('howto').open = matchMedia('(min-width: 64rem)').matches;
Cloud.restore();
renderHome();
renderAccount();
Cloud.start({
    onStatus: renderAccount,
    onData: renderHome,
    askMigrate: () => confirm(ACCOUNT_TEXT.askMigrate)
});