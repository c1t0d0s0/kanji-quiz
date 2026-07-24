// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startKtoYBtn = document.getElementById('start-k-to-y');
const startYtoKBtn = document.getElementById('start-y-to-k');
const retryBtn = document.getElementById('retry-btn');

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

// --- Quiz Settings & State ---
let selectedGrade = 'all'; // 'all' or '1'..'6'
let selectedQuestionCount = 10;

let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timerInterval;
let quizMode = ''; // 'k-to-y' or 'y-to-k'
const TIME_LIMIT = 10;
let audioCtx;

// --- Event Listeners for Selectors ---
gradePills.forEach(pill => {
    pill.addEventListener('click', () => {
        gradePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedGrade = pill.dataset.grade;
    });
});

countPills.forEach(pill => {
    pill.addEventListener('click', () => {
        countPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedQuestionCount = parseInt(pill.dataset.count, 10);
    });
});

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
    currentQuiz = shuffledPool.slice(0, questionLimit);

    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    quizScreen.classList.add('active');

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
        correctAnswer = currentKanji.reading;
    } else {
        questionText = currentKanji.reading;
        correctAnswer = currentKanji.kanji;
    }

    questionEl.textContent = questionText;

    const options = generateOptions(correctAnswer);
    optionButtons.forEach((button, index) => {
        button.textContent = options[index];
        button.onclick = () => checkAnswer(button.textContent, correctAnswer);
    });

    startTimer();
}

function generateOptions(correctAnswer) {
    const options = [correctAnswer];
    const isReading = quizMode === 'k-to-y';
    const pool = kanjiDatabase.map(item => isReading ? item.reading : item.kanji);

    while (options.length < 4) {
        const randomOption = pool[Math.floor(Math.random() * pool.length)];
        if (!options.includes(randomOption)) {
            options.push(randomOption);
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
    });
}

function checkAnswer(selectedAnswer, correctAnswer) {
    clearInterval(timerInterval);
    optionButtons.forEach(button => button.disabled = true);

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

    setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1400);
}

function handleTimeout() {
    optionButtons.forEach(button => button.disabled = true);
    feedbackEl.textContent = '時間切れ！';
    feedbackEl.classList.add('incorrect');
    const correctAnswer = (quizMode === 'k-to-y') ? currentQuiz[currentQuestionIndex].reading : currentQuiz[currentQuestionIndex].kanji;
    highlightAnswer(null, false, correctAnswer);
    playSound(false);

    setTimeout(() => {
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
    quizScreen.classList.remove('active');
    resultScreen.classList.add('active');

    const total = currentQuiz.length;
    const percentage = Math.round((score / total) * 100);
    scoreEl.textContent = `正解率: ${percentage}%`;
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

    playResultSound(percentage);
}

// --- Global Handlers ---
startKtoYBtn.addEventListener('click', () => startQuiz('k-to-y'));
startYtoKBtn.addEventListener('click', () => startQuiz('start-y-to-k' === 'start-y-to-k' ? 'y-to-k' : 'y-to-k'));
retryBtn.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
});