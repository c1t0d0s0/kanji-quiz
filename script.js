// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startKtoYBtn = document.getElementById('start-k-to-y');
const startYtoKBtn = document.getElementById('start-y-to-k');
const retryBtn = document.getElementById('retry-btn');

const questionCounter = document.getElementById('question-counter');
const timerDisplay = document.getElementById('timer');
const questionEl = document.getElementById('question');
const optionsArea = document.getElementById('options-area');
const optionButtons = Array.from(document.getElementsByClassName('option'));
const feedbackEl = document.getElementById('feedback');

const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');

// --- Kanji Data ---
const kanjiData = [
    // Grade 1
    {kanji: "一", reading: "いち"}, {kanji: "右", reading: "みぎ"}, {kanji: "雨", reading: "あめ"}, {kanji: "円", reading: "えん"}, {kanji: "王", reading: "おう"},
    {kanji: "音", reading: "おと"}, {kanji: "下", reading: "した"}, {kanji: "火", reading: "ひ"}, {kanji: "花", reading: "はな"}, {kanji: "貝", reading: "かい"},
    {kanji: "学", reading: "がく"}, {kanji: "気", reading: "き"}, {kanji: "九", reading: "きゅう"}, {kanji: "休", reading: "やす"}, {kanji: "玉", reading: "たま"},
    {kanji: "金", reading: "きん"}, {kanji: "空", reading: "そら"}, {kanji: "月", reading: "つき"}, {kanji: "犬", reading: "いぬ"}, {kanji: "見", reading: "み"},
    {kanji: "五", reading: "ご"}, {kanji: "口", reading: "くち"}, {kanji: "校", reading: "こう"}, {kanji: "左", reading: "ひだり"}, {kanji: "三", reading: "さん"},
    {kanji: "山", reading: "やま"}, {kanji: "子", reading: "こ"}, {kanji: "四", reading: "し"}, {kanji: "糸", reading: "いと"}, {kanji: "字", reading: "じ"},
    {kanji: "耳", reading: "みみ"}, {kanji: "七", reading: "なな"}, {kanji: "車", reading: "くるま"}, {kanji: "手", reading: "て"}, {kanji: "十", reading: "じゅう"},
    {kanji: "出", reading: "で"}, {kanji: "女", reading: "おんな"}, {kanji: "小", reading: "しょう"}, {kanji: "上", reading: "うえ"}, {kanji: "森", reading: "もり"},
    {kanji: "人", reading: "ひと"}, {kanji: "水", reading: "みず"}, {kanji: "正", reading: "せい"}, {kanji: "生", reading: "せい"}, {kanji: "青", reading: "あお"},
    {kanji: "夕", reading: "ゆう"}, {kanji: "石", reading: "いし"}, {kanji: "赤", reading: "あか"}, {kanji: "千", reading: "せん"}, {kanji: "川", reading: "かわ"},
    {kanji: "先", reading: "せん"}, {kanji: "早", reading: "はや"}, {kanji: "草", reading: "くさ"}, {kanji: "足", reading: "あし"}, {kanji: "村", reading: "むら"},
    {kanji: "大", reading: "だい"}, {kanji: "男", reading: "おとこ"}, {kanji: "竹", reading: "たけ"}, {kanji: "中", reading: "なか"}, {kanji: "虫", reading: "むし"},
    {kanji: "町", reading: "まち"}, {kanji: "天", reading: "てん"}, {kanji: "田", reading: "た"}, {kanji: "土", reading: "つち"}, {kanji: "二", reading: "に"},
    {kanji: "日", reading: "にち"}, {kanji: "入", reading: "はい"}, {kanji: "年", reading: "ねん"}, {kanji: "白", reading: "しろ"}, {kanji: "八", reading: "はち"},
    {kanji: "百", reading: "ひゃく"}, {kanji: "文", reading: "ぶん"}, {kanji: "木", reading: "き"}, {kanji: "本", reading: "ほん"}, {kanji: "名", reading: "な"},
    {kanji: "目", reading: "め"}, {kanji: "立", reading: "た"}, {kanji: "力", reading: "ちから"}, {kanji: "林", reading: "はやし"}, {kanji: "六", reading: "ろく"},
    // Grade 2
    {kanji: "引", reading: "ひ"}, {kanji: "羽", reading: "はね"}, {kanji: "雲", reading: "くも"}, {kanji: "園", reading: "えん"}, {kanji: "遠", reading: "とお"},
    {kanji: "何", reading: "なに"}, {kanji: "科", reading: "か"}, {kanji: "夏", reading: "なつ"}, {kanji: "家", reading: "いえ"}, {kanji: "歌", reading: "うた"},
    {kanji: "画", reading: "が"}, {kanji: "回", reading: "かい"}, {kanji: "会", reading: "かい"}, {kanji: "海", reading: "うみ"}, {kanji: "絵", reading: "え"},
    {kanji: "外", reading: "そと"}, {kanji: "角", reading: "かど"}, {kanji: "楽", reading: "がく"}, {kanji: "活", reading: "かつ"}, {kanji: "間", reading: "あいだ"},
    {kanji: "丸", reading: "まる"}, {kanji: "岩", reading: "いわ"}, {kanji: "顔", reading: "かお"}, {kanji: "汽", reading: "き"}, {kanji: "記", reading: "き"},
    {kanji: "帰", reading: "かえ"}, {kanji: "弓", reading: "ゆみ"}, {kanji: "牛", reading: "うし"}, {kanji: "魚", reading: "さかな"}, {kanji: "京", reading: "きょう"},
    {kanji: "強", reading: "つよ"}, {kanji: "教", reading: "きょう"}, {kanji: "近", reading: "ちか"}, {kanji: "兄", reading: "あに"}, {kanji: "形", reading: "かたち"},
    {kanji: "計", reading: "けい"}, {kanji: "元", reading: "げん"}, {kanji: "言", reading: "げん"}, {kanji: "原", reading: "はら"}, {kanji: "戸", reading: "こ"},
    {kanji: "古", reading: "ふる"}, {kanji: "午", reading: "ご"}, {kanji: "後", reading: "あと"}, {kanji: "語", reading: "ご"}, {kanji: "工", reading: "こう"},
    {kanji: "公", reading: "こう"}, {kanji: "広", reading: "ひろ"}, {kanji: "交", reading: "こう"}, {kanji: "光", reading: "ひかり"}, {kanji: "考", reading: "こう"},
    {kanji: "行", reading: "い"}, {kanji: "高", reading: "たか"}, {kanji: "黄", reading: "き"}, {kanji: "合", reading: "あ"}, {kanji: "谷", reading: "たに"},
    {kanji: "国", reading: "くに"}, {kanji: "黒", reading: "くろ"}, {kanji: "今", reading: "いま"}, {kanji: "才", reading: "さい"}, {kanji: "細", reading: "ほそ"},
    {kanji: "作", reading: "つく"}, {kanji: "算", reading: "さん"}, {kanji: "止", reading: "と"}, {kanji: "市", reading: "し"}, {kanji: "矢", reading: "や"},
    {kanji: "姉", reading: "あね"}, {kanji: "思", reading: "おも"}, {kanji: "紙", reading: "かみ"}, {kanji: "寺", reading: "てら"}, {kanji: "自", reading: "じ"},
    {kanji: "時", reading: "とき"}, {kanji: "室", reading: "しつ"}, {kanji: "社", reading: "しゃ"}, {kanji: "弱", reading: "よわ"}, {kanji: "首", reading: "くび"},
    {kanji: "秋", reading: "あき"}, {kanji: "週", reading: "しゅう"}, {kanji: "春", reading: "はる"}, {kanji: "書", reading: "か"}, {kanji: "少", reading: "すく"},
    {kanji: "場", reading: "ば"}, {kanji: "色", reading: "いろ"}, {kanji: "食", reading: "た"}, {kanji: "心", reading: "こころ"}, {kanji: "新", reading: "あたら"},
    {kanji: "親", reading: "おや"}, {kanji: "図", reading: "ず"}, {kanji: "数", reading: "かず"}, {kanji: "西", reading: "にし"}, {kanji: "声", reading: "こえ"},
    {kanji: "星", reading: "ほし"}, {kanji: "晴", reading: "は"}, {kanji: "切", reading: "き"}, {kanji: "雪", reading: "ゆき"}, {kanji: "船", reading: "ふね"},
    {kanji: "線", reading: "せん"}, {kanji: "前", reading: "まえ"}, {kanji: "組", reading: "くみ"}, {kanji: "走", reading: "はし"}, {kanji: "多", reading: "おお"},
    {kanji: "太", reading: "ふと"}, {kanji: "体", reading: "からだ"}, {kanji: "台", reading: "だい"}, {kanji: "地", reading: "ち"}, {kanji: "池", reading: "いけ"},
    {kanji: "知", reading: "し"}, {kanji: "茶", reading: "ちゃ"}, {kanji: "昼", reading: "ひる"}, {kanji: "長", reading: "なが"}, {kanji: "鳥", reading: "とり"},
    {kanji: "朝", reading: "あさ"}, {kanji: "通", reading: "とお"}, {kanji: "弟", reading: "おとうと"}, {kanji: "店", reading: "みせ"}, {kanji: "点", reading: "てん"},
    {kanji: "電", reading: "でん"}, {kanji: "刀", reading: "かたな"}, {kanji: "冬", reading: "ふゆ"}, {kanji: "当", reading: "とう"}, {kanji: "東", reading: "ひがし"},
    {kanji: "答", reading: "こた"}, {kanji: "頭", reading: "あたま"}, {kanji: "同", reading: "おな"}, {kanji: "道", reading: "みち"}, {kanji: "読", reading: "よ"},
    {kanji: "内", reading: "うち"}, {kanji: "南", reading: "みなみ"}, {kanji: "肉", reading: "にく"}, {kanji: "馬", reading: "うま"}, {kanji: "売", reading: "う"},
    {kanji: "買", reading: "か"}, {kanji: "麦", reading: "むぎ"}, {kanji: "半", reading: "はん"}, {kanji: "番", reading: "ばん"}, {kanji: "父", reading: "ちち"},
    {kanji: "風", reading: "かぜ"}, {kanji: "分", reading: "わ"}, {kanji: "聞", reading: "き"}, {kanji: "米", reading: "こめ"}, {kanji: "歩", reading: "ある"},
    {kanji: "母", reading: "はは"}, {kanji: "方", reading: "ほう"}, {kanji: "北", reading: "きた"}, {kanji: "毎", reading: "まい"}, {kanji: "妹", reading: "いもうと"},
    {kanji: "万", reading: "まん"}, {kanji: "明", reading: "あか"}, {kanji: "鳴", reading: "な"}, {kanji: "毛", reading: "け"}, {kanji: "門", reading: "もん"},
    {kanji: "夜", reading: "よる"}, {kanji: "野", reading: "の"}, {kanji: "友", reading: "とも"}, {kanji: "用", reading: "よう"}, {kanji: "曜", reading: "よう"},
    {kanji: "来", reading: "く"}, {kanji: "里", reading: "さと"}, {kanji: "理", reading: "り"}, {kanji: "話", reading: "はなし"}
];

// --- Quiz State ---
let currentQuiz = [];
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timerInterval;
let quizMode = ''; // 'k-to-y' or 'y-to-k'
const TOTAL_QUESTIONS = 10;
const TIME_LIMIT = 10;
let audioCtx;

// --- Functions ---

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
        // Simple "correct" sound (e.g., two ascending tones)
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
        // Simple "incorrect" sound (e.g., a low buzz)
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startQuiz(mode) {
    initAudio(); // Initialize AudioContext on user gesture
    quizMode = mode;
    currentQuestionIndex = 0;
    score = 0;
    
    const shuffledKanji = shuffleArray([...kanjiData]);
    currentQuiz = shuffledKanji.slice(0, TOTAL_QUESTIONS);

    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    quizScreen.classList.add('active');
    
    displayQuestion();
}

function displayQuestion() {
    resetQuestionState();
    
    if (currentQuestionIndex >= TOTAL_QUESTIONS) {
        endQuiz();
        return;
    }

    questionCounter.textContent = `第${currentQuestionIndex + 1}問`;
    
    const currentKanji = currentQuiz[currentQuestionIndex];
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
    const pool = kanjiData.map(item => isReading ? item.reading : item.kanji);

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
    timerInterval = setInterval(() => {
        timer--;
        timerDisplay.textContent = timer;
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
        highlightAnswer(selectedAnswer, true);
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
    }, 1500);
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
    }, 1500);
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

function playResultSound(percentage) {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    
    if (percentage === 100) {
        // Fanfare for perfect score
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.15);
            osc.connect(audioCtx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.1);
        });
    } else if (percentage >= 80) {
        // Good score sound
        const freqs = [783.99, 1046.50]; // G5, C6
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            osc.connect(audioCtx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.15);
        });
    } else if (percentage >= 50) {
        // Passable score sound
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    } else {
        // Low score sound
        const freqs = [392.00, 369.99]; // G4, F#4
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

function endQuiz() {
    quizScreen.classList.remove('active');
    resultScreen.classList.add('active');

    const percentage = (score / TOTAL_QUESTIONS) * 100;
    scoreEl.textContent = `正解率: ${percentage}%`;
    
    playResultSound(percentage);

    if (percentage === 100) {
        messageEl.textContent = 'おめでとう！パーフェクト！君は漢字マスターだ！';
    } else if (percentage >= 80) {
        messageEl.textContent = '素晴らしい！あと少しでパーフェクト！';
    } else if (percentage >= 50) {
        messageEl.textContent = 'よく頑張ったね！この調子で頑張ろう！';
    } else {
        messageEl.textContent = 'お疲れ様！次はもっと頑張ろう！';
    }
}

// --- Event Listeners ---
startKtoYBtn.addEventListener('click', () => startQuiz('k-to-y'));
startYtoKBtn.addEventListener('click', () => startQuiz('y-to-k'));
retryBtn.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
});