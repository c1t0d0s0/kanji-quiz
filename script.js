// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startKtoYBtn = document.getElementById('start-k-to-y');
const startYtoKBtn = document.getElementById('start-y-to-k');
const startKumitateBtn = document.getElementById('start-kumitate');
const retryBtn = document.getElementById('retry-btn');
const reviewBtn = document.getElementById('review-btn');
const quitBtn = document.getElementById('quit-btn');

const gradePills = document.querySelectorAll('.grade-pill');
const countPills = document.querySelectorAll('.count-pill');

const progressBar = document.getElementById('progress-bar');
const questionCounter = document.getElementById('question-counter');
const gradeBadge = document.getElementById('grade-badge');
const timerDisplay = document.getElementById('timer');
const questionEl = document.getElementById('question');
const optionButtons = Array.from(document.getElementsByClassName('option'));
const optionsArea = document.getElementById('options-area');
const buildArea = document.getElementById('build-area');
const buildSlots = document.getElementById('build-slots');
const buildTiles = document.getElementById('build-tiles');
const feedbackEl = document.getElementById('feedback');
const answerNoteEl = document.getElementById('answer-note');

const rankBadge = document.getElementById('rank-badge');
const scoreEl = document.getElementById('score');
const detailScoreEl = document.getElementById('detail-score');
const messageEl = document.getElementById('message');
const bestNoteEl = document.getElementById('best-note');
const resultHanamaru = document.getElementById('result-hanamaru');
const comboNoteEl = document.getElementById('combo-note');
const newKanjiSection = document.getElementById('new-kanji');
const newKanjiList = document.getElementById('new-kanji-list');
const newWordsSection = document.getElementById('new-words');
const newWordsList = document.getElementById('new-words-list');
const missedSection = document.getElementById('missed');
const missedTitle = document.getElementById('missed-title');
const missedList = document.getElementById('missed-list');

const practiceDays = document.getElementById('practice-days');
const practiceDaysNum = document.getElementById('practice-days-num');
const bestEls = {
    'k-to-y': document.getElementById('best-k-to-y'),
    'y-to-k': document.getElementById('best-y-to-k'),
    kumitate: document.getElementById('best-kumitate')
};
const accountEl = document.getElementById('account');
const accountBody = document.getElementById('account-body');

const zukanOpenBtn = document.getElementById('zukan-open');
const zukanCount = document.getElementById('zukan-count');
const zukanMeterBar = document.getElementById('zukan-meter-bar');
const wordZukanOpenBtn = document.getElementById('word-zukan-open');
const wordZukanCount = document.getElementById('word-zukan-count');
const wordZukanMeterBar = document.getElementById('word-zukan-meter-bar');
const zukanDialog = document.getElementById('zukan');
const zukanTitle = document.getElementById('zukan-title');
const zukanTabs = document.querySelectorAll('.zukan-tabs .seg-option');
const zukanSummary = document.getElementById('zukan-summary');
const zukanDetail = document.getElementById('zukan-detail');
const zukanBody = document.getElementById('zukan-body');

// --- Quiz Settings & State ---
const GRADES = [1, 2, 3, 4, 5, 6];
const VALID_GRADES = ['all', ...GRADES.map(String)];
const gradeParam = new URLSearchParams(window.location.search).get('grade');
let urlGrade = VALID_GRADES.includes(gradeParam) ? gradeParam : null;
let selectedGrade = 'all'; // 'all' or '1'..'6'
let selectedQuestionCount = 10;

let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timerInterval;
let nextQuestionTimeout;
let quizMode = ''; // 'k-to-y', 'y-to-k' or 'kumitate' (熟語くみたて)
let quizItemId = null; // record id of the quiz being played (mode + grade + count); null for a review
let combo = 0; // correct answers in a row
let maxCombo = 0;
let missedItems = []; // questions answered wrong or too late, for the review
let correctKanji = []; // kanji answered correctly, for the 漢字ずかん
let correctWords = []; // 熟語 built correctly, for the 熟語ずかん
let build = null; // 熟語くみたて: { tiles: [{ char, used }], slots: [tile index or null], locked }
const TIME_LIMIT = 10;
// 熟語くみたて: more time for longer words, and always 8 tiles (4 x 2)
const KUMITATE_TIME_LIMIT = { 2: 15, 3: 18, 4: 21 };
const TILE_COUNT = 8;

const kanjiReadings = new Map(kanjiDatabase.map(item => [item.kanji, item.readings]));
const kanjiGrade = new Map(kanjiDatabase.map(item => [item.kanji, item.grade]));
// Words with the same reading (科学 / 化学): building any of them is correct
const wordsByReading = new Map();
jukugoDatabase.forEach(item => wordsByReading.set(item.reading, [...(wordsByReading.get(item.reading) || []), item.word]));
// Kanji sharing a reading make good look-alike tiles (校 こう → 高・交・考)
const kanjiByReading = new Map();
kanjiDatabase.forEach(item => item.readings.forEach(r => kanjiByReading.set(r, [...(kanjiByReading.get(r) || []), item.kanji])));
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
        urlGrade = null;
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
    renderZukanCount();
}

// --- 漢字ずかん (kanji collected by answering them correctly) ---
function countCollected(collected, list) {
    return list.filter(item => collected.has(item.kanji)).length;
}

function renderZukanCount() {
    const collected = Records.getCollected();
    const got = countCollected(collected, kanjiDatabase);
    zukanCount.textContent = `${got} / ${kanjiDatabase.length}`;
    zukanMeterBar.style.width = `${(got / kanjiDatabase.length) * 100}%`;
    zukanOpenBtn.setAttribute('aria-label', `漢字ずかんを ひらく (${kanjiDatabase.length}字中 ${got}字 あつめた)`);

    const words = Records.getCollectedWords();
    const gotWords = jukugoDatabase.filter(item => words.has(item.word)).length;
    wordZukanCount.textContent = `${gotWords} / ${jukugoDatabase.length}`;
    wordZukanMeterBar.style.width = `${(gotWords / jukugoDatabase.length) * 100}%`;
    wordZukanOpenBtn.setAttribute('aria-label', `熟語ずかんを ひらく (${jukugoDatabase.length}語中 ${gotWords}語 あつめた)`);
}

function readingsText(item) {
    return item.readings.join('・');
}

let zukanKind = 'kanji'; // 'kanji' or 'words'

function renderZukan() {
    zukanTitle.textContent = zukanKind === 'kanji' ? '漢字ずかん' : '熟語ずかん';
    zukanTabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.zukan === zukanKind)));
    if (zukanKind === 'words') {
        renderWordZukan();
        return;
    }
    const collected = Records.getCollected();
    const got = countCollected(collected, kanjiDatabase);
    zukanSummary.textContent = got === kanjiDatabase.length
        ? `${got}字 ぜんぶ あつめた！ すごい！`
        : `${kanjiDatabase.length}字中 ${got}字 あつめたよ`;
    zukanDetail.textContent = 'あつめた 漢字を おすと、読みが 見られるよ。';

    const sections = GRADES.map(grade => {
        const list = kanjiDatabase.filter(item => item.grade === grade);
        const section = el('section', 'zukan-grade');
        const heading = el('h2', '', `${grade}年生`);
        const gradeGot = countCollected(collected, list);
        heading.append(el('span', gradeGot === list.length ? 'zukan-grade-count is-complete' : 'zukan-grade-count',
            gradeGot === list.length ? `${gradeGot} / ${list.length} コンプリート！` : `${gradeGot} / ${list.length}`));
        const grid = el('div', 'zukan-grid');
        list.forEach(item => {
            const has = collected.has(item.kanji);
            const cell = el('button', has ? 'zukan-cell is-collected' : 'zukan-cell', item.kanji);
            cell.type = 'button';
            if (has) {
                cell.setAttribute('aria-label', `${item.kanji} (${readingsText(item)})`);
                cell.addEventListener('click', () => {
                    zukanDetail.replaceChildren(el('b', 'zukan-detail-kanji', item.kanji), ` ${readingsText(item)}`);
                });
            } else {
                // Shown faintly, so children can see what is left to collect
                cell.setAttribute('aria-label', `${item.kanji} (まだ あつめていない)`);
                cell.addEventListener('click', () => {
                    zukanDetail.textContent = `「${item.kanji}」は まだ あつめていないよ。クイズで 正解すると あつまるよ！`;
                });
            }
            grid.append(cell);
        });
        section.append(heading, grid);
        return section;
    });
    zukanBody.replaceChildren(...sections);
}

// The 熟語 are many, so each grade is folded and its words are drawn when it is opened
function renderWordZukan() {
    const collected = Records.getCollectedWords();
    const got = jukugoDatabase.filter(item => collected.has(item.word)).length;
    zukanSummary.textContent = got === jukugoDatabase.length
        ? `${got}語 ぜんぶ あつめた！ すごい！`
        : `${jukugoDatabase.length}語中 ${got}語 あつめたよ`;
    zukanDetail.textContent = '学年を おすと 熟語が 見られるよ。あつめた 熟語を おすと、読みが 出るよ。';

    const sections = GRADES.map(grade => {
        const list = jukugoDatabase.filter(item => item.grade === grade);
        const gradeGot = list.filter(item => collected.has(item.word)).length;
        const section = el('details', 'zukan-grade zukan-fold');
        const summary = el('summary', '', `${grade}年生`);
        summary.append(el('span', gradeGot === list.length ? 'zukan-grade-count is-complete' : 'zukan-grade-count',
            gradeGot === list.length ? `${gradeGot} / ${list.length} コンプリート！` : `${gradeGot} / ${list.length}`));
        section.append(summary);
        section.addEventListener('toggle', () => {
            if (!section.open || section.querySelector('.zukan-grid')) return;
            const grid = el('div', 'zukan-grid zukan-word-grid');
            list.forEach(item => {
                const has = collected.has(item.word);
                const cell = el('button', has ? 'zukan-cell zukan-word is-collected' : 'zukan-cell zukan-word', item.word);
                cell.type = 'button';
                cell.setAttribute('aria-label', has ? `${item.word} (${item.reading})` : `${item.word} (まだ あつめていない)`);
                cell.addEventListener('click', () => {
                    if (has) zukanDetail.replaceChildren(el('b', 'zukan-detail-kanji', item.word), ` ${item.reading}`);
                    else zukanDetail.textContent = `「${item.word}」は まだ あつめていないよ。熟語くみたてで 正解すると あつまるよ！`;
                });
                grid.append(cell);
            });
            section.append(grid);
        });
        return section;
    });
    zukanBody.replaceChildren(...sections);
}

function openZukan(kind) {
    zukanKind = kind;
    renderZukan();
    zukanDialog.showModal();
    zukanBody.scrollTop = 0;
}

zukanOpenBtn.addEventListener('click', () => openZukan('kanji'));
wordZukanOpenBtn.addEventListener('click', () => openZukan('words'));
zukanTabs.forEach(tab => tab.addEventListener('click', () => {
    zukanKind = tab.dataset.zukan;
    renderZukan();
    zukanBody.scrollTop = 0;
}));
document.getElementById('zukan-close').addEventListener('click', () => zukanDialog.close());
// Tapping the dark backdrop also closes it
zukanDialog.addEventListener('click', event => {
    if (event.target === zukanDialog) zukanDialog.close();
});

// Restores the last selection and redraws the records (also after a sync replaced them)
function renderHome() {
    const settings = Records.getSettings();
    selectedGrade = urlGrade || settings.grade || selectedGrade;
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

// The chime goes up a little with every correct answer in a row
function playSound(correct, streak = 1) {
    if (!audioCtx) return;

    if (correct) {
        const lift = 1 + Math.min(streak - 1, 8) * 0.06;
        const oscillator1 = audioCtx.createOscillator();
        oscillator1.type = 'sine';
        oscillator1.frequency.setValueAtTime(600 * lift, audioCtx.currentTime);
        oscillator1.connect(audioCtx.destination);
        oscillator1.start();
        oscillator1.stop(audioCtx.currentTime + 0.1);

        const oscillator2 = audioCtx.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(800 * lift, audioCtx.currentTime + 0.1);
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

function getFilteredJukugoList() {
    if (selectedGrade === 'all') {
        return [...jukugoDatabase];
    }
    const targetGrade = parseInt(selectedGrade, 10);
    return jukugoDatabase.filter(item => item.grade === targetGrade);
}

// --- Quiz Controller ---
// reviewItems: the questions missed last time, asked again with the same readings
function startQuiz(mode, reviewItems) {
    initAudio();
    quizMode = mode;
    currentQuestionIndex = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    missedItems = [];
    correctKanji = [];
    correctWords = [];
    const isKumitate = mode === 'kumitate';
    quizScreen.classList.toggle('is-kumitate', isKumitate);
    optionsArea.hidden = isKumitate;
    buildArea.hidden = !isKumitate;

    if (reviewItems) {
        currentQuiz = shuffleArray([...reviewItems]);
        quizItemId = null;
    } else if (isKumitate) {
        const shuffledPool = shuffleArray(getFilteredJukugoList());
        currentQuiz = shuffledPool.slice(0, Math.min(selectedQuestionCount, shuffledPool.length));
        quizItemId = Records.itemId(mode, selectedGrade, selectedQuestionCount);
    } else {
        const availablePool = getFilteredKanjiList();
        const shuffledPool = shuffleArray([...availablePool]);

        // Total questions capped by available pool size
        const questionLimit = Math.min(selectedQuestionCount, shuffledPool.length);
        currentQuiz = shuffledPool.slice(0, questionLimit).map(item => {
            const targetReading = item.readings[Math.floor(Math.random() * item.readings.length)];
            return { ...item, targetReading };
        });
        quizItemId = Records.itemId(mode, selectedGrade, selectedQuestionCount);
    }

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

    if (quizMode === 'kumitate') {
        questionEl.textContent = currentKanji.reading;
        questionEl.classList.remove('is-kanji');
        startBuild(currentKanji);
        startTimer(KUMITATE_TIME_LIMIT[[...currentKanji.word].length] || TIME_LIMIT);
        return;
    }

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

// --- 熟語くみたて ---
// The tiles: the kanji of the word, then look-alikes that share a reading with them,
// then any kanji of the same grade or below. Kanji that could build another word with
// the same reading are left out, so only one order of the tiles is right.
function makeTiles(item) {
    const chars = [...item.word];
    const used = new Set(chars);
    (wordsByReading.get(item.reading) || []).forEach(word => [...word].forEach(k => used.add(k)));
    const fits = k => !used.has(k) && (kanjiGrade.get(k) || 7) <= item.grade;
    const similar = shuffleArray([...new Set(chars.flatMap(k => (kanjiReadings.get(k) || []).flatMap(r => kanjiByReading.get(r) || [])))].filter(fits));
    const others = shuffleArray(kanjiDatabase.map(entry => entry.kanji).filter(fits));
    const extra = [...new Set([...similar.slice(0, 3), ...others])].slice(0, TILE_COUNT - chars.length);
    return shuffleArray([...chars, ...extra]).map(char => ({ char, used: false }));
}

function startBuild(item) {
    build = { tiles: makeTiles(item), slots: new Array([...item.word].length).fill(null), locked: false };
    renderBuild();
}

function renderBuild() {
    const next = build.slots.indexOf(null);
    buildSlots.replaceChildren(...build.slots.map((tileIndex, i) => {
        const slot = el('button', i === next && !build.locked ? 'slot is-next' : 'slot', tileIndex === null ? '' : build.tiles[tileIndex].char);
        slot.type = 'button';
        slot.disabled = build.locked || tileIndex === null;
        slot.setAttribute('aria-label', tileIndex === null ? `${i + 1}字目 (まだ)` : `${i + 1}字目 ${build.tiles[tileIndex].char} (おすと もどす)`);
        slot.addEventListener('click', () => {
            // Put the tile back, so a wrong pick can be fixed before the last square
            build.tiles[tileIndex].used = false;
            build.slots[i] = null;
            renderBuild();
        });
        return slot;
    }));
    buildTiles.replaceChildren(...build.tiles.map((tile, i) => {
        const button = el('button', tile.used ? 'tile is-used' : 'tile', tile.char);
        button.type = 'button';
        button.disabled = build.locked || tile.used;
        button.addEventListener('click', () => placeTile(i));
        return button;
    }));
}

function placeTile(tileIndex) {
    const next = build.slots.indexOf(null);
    if (build.locked || next === -1 || build.tiles[tileIndex].used) return;
    build.tiles[tileIndex].used = true;
    build.slots[next] = tileIndex;
    renderBuild();
    if (!build.slots.includes(null)) checkBuild();
}

function checkBuild() {
    const item = currentQuiz[currentQuestionIndex];
    const built = build.slots.map(i => build.tiles[i].char).join('');
    const isCorrect = built === item.word || (wordsByReading.get(item.reading) || []).includes(built);
    finishBuild(item, isCorrect ? built : null, isCorrect ? '正解！' : '不正解...');
}

// Shows the right word in the squares and moves on. built is the word made, or null.
function finishBuild(item, built, message) {
    clearInterval(timerInterval);
    build.locked = true;
    if (!built) {
        // Fill the squares with the right answer, so it can be seen
        const taken = [];
        build.slots = [...item.word].map(char => {
            const i = build.tiles.findIndex((tile, j) => tile.char === char && !taken.includes(j));
            taken.push(i);
            return i;
        });
        build.tiles.forEach((tile, j) => { tile.used = taken.includes(j); });
    }
    renderBuild();
    buildSlots.classList.add(built ? 'correct' : 'incorrect');
    feedbackEl.textContent = message;
    if (built) {
        score++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        correctWords.push(built);
        feedbackEl.classList.add('correct');
        if (combo >= 2) {
            feedbackEl.append(el('span', 'combo', `${combo}れんぞく！`));
            feedbackEl.classList.add('is-combo');
        }
        playSound(true, combo);
    } else {
        combo = 0;
        missedItems.push(item);
        feedbackEl.classList.add('incorrect');
        playSound(false);
    }
    showAnswerNote(built ? { ...item, word: built } : item);
    goToNextQuestion();
}

function startTimer(limit = TIME_LIMIT) {
    timer = limit;
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
    answerNoteEl.replaceChildren();
    timerDisplay.classList.remove('warning');
    buildSlots.className = 'build-slots';

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

    const item = currentQuiz[currentQuestionIndex];
    if (selectedAnswer === correctAnswer) {
        score++;
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        correctKanji.push(item.kanji);
        feedbackEl.textContent = '正解！';
        feedbackEl.classList.add('correct');
        if (combo >= 2) {
            feedbackEl.append(el('span', 'combo', `${combo}れんぞく！`));
            feedbackEl.classList.add('is-combo');
        }
        highlightAnswer(selectedAnswer, true, correctAnswer);
        playSound(true, combo);
    } else {
        combo = 0;
        missedItems.push(item);
        feedbackEl.textContent = '不正解...';
        feedbackEl.classList.add('incorrect');
        highlightAnswer(selectedAnswer, false, correctAnswer);
        playSound(false);
    }
    showAnswerNote(item);
    goToNextQuestion();
}

// Shows the kanji with all its readings, so every question also teaches something.
// For a 熟語, the word with its reading, and the readings of each of its kanji.
function showAnswerNote(item) {
    if (item.word) {
        const parts = el('span', 'answer-parts');
        parts.append(...[...new Set(item.word)].map(k => el('span', '', `${k} ${(kanjiReadings.get(k) || []).slice(0, 3).join('・')}`)));
        answerNoteEl.replaceChildren(el('span', 'answer-kanji', item.word), ` ${item.reading}`, parts);
        return;
    }
    const readings = item.readings.map(reading =>
        reading === item.targetReading ? el('b', '', reading) : document.createTextNode(reading));
    const parts = [el('span', 'answer-kanji', item.kanji), ' '];
    readings.forEach((node, i) => {
        if (i > 0) parts.push('・');
        parts.push(node);
    });
    answerNoteEl.replaceChildren(...parts);
}

// A little longer than before, so there is time to read the answer note
function goToNextQuestion() {
    nextQuestionTimeout = setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1900);
}

function handleTimeout() {
    if (quizMode === 'kumitate') {
        finishBuild(currentQuiz[currentQuestionIndex], null, '時間切れ！');
        return;
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    optionButtons.forEach(button => {
        button.disabled = true;
        button.blur();
    });
    feedbackEl.textContent = '時間切れ！';
    feedbackEl.classList.add('incorrect');
    const item = currentQuiz[currentQuestionIndex];
    const correctAnswer = (quizMode === 'k-to-y') ? item.targetReading : item.kanji;
    highlightAnswer(null, false, correctAnswer);
    playSound(false);
    combo = 0;
    missedItems.push(item);
    showAnswerNote(item);
    goToNextQuestion();
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

    const { previous, isBest, newlyCollected, newlyCollectedWords } =
        Records.recordResult(quizItemId, score, total, correctKanji, correctWords);
    // Nothing to compare with on the first play, nor on a review
    bestNoteEl.hidden = !previous;
    bestNoteEl.classList.toggle('is-new', isBest);
    bestNoteEl.textContent = !previous ? '' : isBest ? 'じこベスト こうしん！' : `じこベスト ${formatBest(previous)}`;

    comboNoteEl.hidden = maxCombo < 3;
    comboNoteEl.textContent = `さいこう ${maxCombo}れんぞく 正解！`;

    renderNewKanji(newlyCollected);
    renderNewWords(newlyCollectedWords);
    renderMissed();

    playResultSound(percentage);
}

function renderNewKanji(list) {
    newKanjiSection.hidden = list.length === 0;
    newKanjiList.replaceChildren(...list.map((kanji, i) => {
        const chip = el('span', 'new-kanji-chip', kanji);
        chip.style.animationDelay = `${0.4 + i * 0.08}s`;
        return chip;
    }));
}

function renderNewWords(list) {
    newWordsSection.hidden = list.length === 0;
    newWordsList.replaceChildren(...list.map((word, i) => {
        const chip = el('span', 'new-kanji-chip new-word-chip', word);
        chip.style.animationDelay = `${0.4 + i * 0.08}s`;
        return chip;
    }));
}

function renderMissed() {
    // The same question can be missed only once per quiz, but keep it tidy anyway
    const unique = [...new Map(missedItems.map(item => [item.word || item.kanji, item])).values()];
    const what = quizMode === 'kumitate' ? '熟語' : '漢字';
    missedTitle.textContent = `まちがえた ${what}`;
    reviewBtn.textContent = `まちがえた ${what}だけ もう一度`;
    missedSection.hidden = unique.length === 0;
    reviewBtn.hidden = unique.length === 0;
    missedList.replaceChildren(...unique.map(item => {
        const li = el('li', item.word ? 'missed-item is-word' : 'missed-item');
        li.append(el('span', 'missed-kanji', item.word || item.kanji), el('span', 'missed-readings', item.word ? item.reading : readingsText(item)));
        return li;
    }));
}

// --- Global Handlers ---
startKtoYBtn.addEventListener('click', () => startQuiz('k-to-y'));
startYtoKBtn.addEventListener('click', () => startQuiz('y-to-k'));
startKumitateBtn.addEventListener('click', () => startQuiz('kumitate'));
reviewBtn.addEventListener('click', () => startQuiz(quizMode, missedItems));
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