// --- 意味かるた たいせん: the screens ---
// entrance → waiting room (code, QR, URL) → field to look over → game → result.
// The game uses the quiz screen and the field of the one-player 意味かるた (script.js).
// Everything follows the room in Realtime Database; only the host moves it on.
const BattleUI = (() => {
    const NAME_KEY = 'kanji_quiz_battle_name';
    const QR_MODULE = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';
    const TICK_MS = 100;

    const $ = id => document.getElementById(id);
    const screen = $('battle-screen');
    const views = { entry: $('battle-entry'), lobby: $('battle-lobby'), result: $('battle-result') };
    const openBtn = $('battle-open');
    const homeBtn = $('battle-home');
    const nameInput = $('battle-name');
    const gradeOptions = $('battle-grade').querySelectorAll('.seg-option');
    const countOptions = $('battle-count').querySelectorAll('.seg-option');
    const createBtn = $('battle-create');
    const codeInput = $('battle-code');
    const joinBtn = $('battle-join');
    const roomCodeEl = $('battle-room-code');
    const roomSettingEl = $('battle-room-setting');
    const qrImg = $('battle-qr');
    const urlInput = $('battle-url');
    const copyBtn = $('battle-copy');
    const playersEl = $('battle-players');
    const startBtn = $('battle-start');
    const standingsEl = $('battle-standings');
    const newWordsSection = $('battle-new-words');
    const newWordsListEl = $('battle-new-words-list');
    const rematchBtn = $('battle-rematch');
    const messageEl = $('battle-message');
    const leaveBtn = $('battle-leave');
    const scoresEl = $('battle-scores');

    let net = null;
    let code = null;
    let room = null;
    let unwatch = null;
    let busy = false;
    let choice = { grade: 'all', count: 10 };

    // The game of the current round
    let game = null; // { key, questions, cards }
    let shownQ = -1; // the question on the screen
    let settledQ = -1; // the last question whose answer is shown
    let advancedQ = -1; // host: the last question moved on from
    let streak = 0;
    let tick = null;
    let recorded = null; // the round already put in the ずかん

    const isHost = () => Boolean(room && net && room.hostUid === net.uid);
    const mySeat = () => (net && code ? net.seatIn(code) : null);
    const gradeLabel = grade => (grade === 'all' ? '全学年' : `${grade}年生`);

    function readName() {
        try {
            return localStorage.getItem(NAME_KEY) || '';
        } catch {
            return '';
        }
    }

    function saveName(name) {
        try {
            localStorage.setItem(NAME_KEY, name);
        } catch {
            // Not kept on this device; asked again next time
        }
    }

    function say(text) {
        messageEl.textContent = text;
    }

    function showView(name) {
        Object.entries(views).forEach(([key, view]) => { view.hidden = key !== name; });
        leaveBtn.hidden = name === 'entry';
    }

    function setUrl(roomCode) {
        const url = new URL(location.href);
        if (roomCode) url.searchParams.set('battle', roomCode);
        else url.searchParams.delete('battle');
        history.replaceState(null, '', url);
    }

    const inviteUrl = roomCode => {
        const url = new URL(location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('battle', roomCode);
        return url.href;
    };

    // --- Entrance ---
    function open(prefill) {
        clearTimeout(nextQuestionTimeout);
        clearInterval(timerInterval);
        initAudio();
        choice = { grade: selectedGrade, count: selectedQuestionCount };
        selectPill(gradeOptions, 'grade', choice.grade);
        selectPill(countOptions, 'count', choice.count);
        nameInput.value = readName();
        codeInput.value = prefill || '';
        say('');
        showView('entry');
        showScreen(screen);
        if (prefill && nameInput.value) join();
        else if (prefill) nameInput.focus();
    }

    function takeName() {
        const name = Battle.cleanName(nameInput.value);
        if (!name) {
            say('なまえを 入れてね');
            nameInput.focus();
            return null;
        }
        nameInput.value = name;
        saveName(name);
        return name;
    }

    async function connect() {
        say('つないでいます…');
        net = await BattleNet.connect();
        return net;
    }

    async function run(job) {
        if (busy) return;
        busy = true;
        createBtn.disabled = true;
        joinBtn.disabled = true;
        try {
            await job();
        } catch (e) {
            console.error('Battle failed', e);
            say('つながりませんでした。時間を おいて、もう一度 ためしてね。');
        } finally {
            busy = false;
            createBtn.disabled = false;
            joinBtn.disabled = false;
        }
    }

    function create() {
        const name = takeName();
        if (!name) return;
        run(async () => {
            await connect();
            enter(await net.create(choice.grade, choice.count, name));
        });
    }

    const JOIN_ERRORS = {
        missing: 'その コードの 部屋は 見つからないよ。',
        started: 'その 部屋は もう はじまっているよ。',
        full: 'その 部屋は いっぱいだよ（8人まで）。',
        version: 'ページを 読みこみ直してから 入ってね（新しい 問題に なっているよ）。'
    };

    function join() {
        const name = takeName();
        if (!name) return;
        const roomCode = Battle.parseCode(codeInput.value);
        if (!roomCode) {
            say('コードは 数字5けただよ');
            codeInput.focus();
            return;
        }
        run(async () => {
            await connect();
            const result = await net.join(roomCode, name);
            if (result === 'ok') enter(roomCode);
            else say(JOIN_ERRORS[result]);
        });
    }

    function enter(roomCode) {
        code = roomCode;
        room = null;
        game = null;
        recorded = null;
        say('');
        setUrl(code);
        renderInvite();
        unwatch = net.watch(code, onRoom);
    }

    // Leaves the room (the host's room is removed for everyone)
    async function leave() {
        const left = code;
        stop();
        if (left && net) await net.leave(left).catch(() => {});
    }

    function stop() {
        if (unwatch) unwatch();
        unwatch = null;
        code = null;
        room = null;
        game = null;
        stopTick();
        setUrl(null);
    }

    async function goHome() {
        await leave();
        renderHome();
        showScreen(startScreen);
    }

    // --- Waiting room ---
    async function renderInvite() {
        const url = inviteUrl(code);
        roomCodeEl.textContent = code;
        urlInput.value = url;
        qrImg.hidden = true;
        try {
            const QRCode = (await import(QR_MODULE)).default;
            qrImg.src = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#1c2a4a', light: '#fdfdfa' } });
            qrImg.hidden = false;
        } catch {
            // Without the QR code, the code and the URL still work
        }
    }

    function renderLobby() {
        roomSettingEl.textContent = `${gradeLabel(Battle.gradeOf(room))}・${room.count}問`;
        const players = Battle.playersList(room);
        playersEl.replaceChildren(...players.map(p => {
            const li = el('li', p.online ? 'battle-player' : 'battle-player is-offline', p.name);
            if (p.uid === room.hostUid) li.append(el('span', 'battle-tag', 'ホスト'));
            if (p.seat === mySeat()) li.append(el('span', 'battle-tag is-me', 'じぶん'));
            if (!p.online) li.append(el('span', 'battle-tag', 'ぬけた'));
            return li;
        }));
        const here = players.filter(p => p.online).length;
        startBtn.hidden = !isHost();
        startBtn.disabled = here < 2;
        if (isHost()) say(here < 2 ? 'ともだちが 入るのを まってね。コードか QRコードを 見せよう！' : 'みんな そろったら スタート！');
        else say('ホストが スタートするのを まってね');
        showView('lobby');
    }

    // --- Following the room ---
    function onRoom(next) {
        if (!code) return;
        if (!next) {
            stop();
            open();
            say('部屋が なくなりました（ホストが 出たよ）');
            return;
        }
        room = next;
        if (room.status === 'playing') {
            startGame();
            renderScores();
            step();
            return;
        }
        stopTick();
        showScreen(screen);
        if (room.status === 'waiting') renderLobby();
        else renderResult();
    }

    function startGame() {
        const key = `${room.round}:${room.seed}`;
        if (game && game.key === key) return;
        game = { key, ...Battle.makeGame(room) };
        shownQ = -1;
        settledQ = -1;
        advancedQ = -1;
        streak = 0;
        quizMode = 'karuta';
        quizScreen.classList.remove('is-kumitate');
        quizScreen.classList.add('is-karuta', 'is-battle');
        optionsArea.hidden = true;
        buildArea.hidden = true;
        karutaArea.hidden = false;
        questionHint.hidden = true;
        resetQuestionState();
        progressBar.style.width = '0%';
        questionCounter.textContent = `${game.questions.length}問`;
        gradeBadge.textContent = gradeLabel(Battle.gradeOf(room));
        showScreen(quizScreen);
        renderKarutaField(game.cards, takeCard);
        stopTick();
        tick = setInterval(step, TICK_MS);
    }

    function stopTick() {
        clearInterval(tick);
        tick = null;
    }

    function renderScores() {
        const seat = mySeat();
        scoresEl.replaceChildren(...Battle.standings(room).map(row => {
            const li = el('li', `battle-score${row.seat === seat ? ' is-me' : ''}${row.online ? '' : ' is-offline'}`);
            li.append(el('span', 'battle-score-name', row.name), el('b', 'battle-score-num', `${row.cards}`));
            return li;
        }));
    }

    // Runs every TICK_MS while playing, and on every change of the room
    function step() {
        if (!room || room.status !== 'playing' || !game) return;
        const now = net.serverNow();
        if (now < room.startAt) {
            const left = Math.ceil((room.startAt - now) / 1000);
            questionEl.textContent = `${left}`;
            questionEl.classList.add('is-countdown');
            feedbackEl.textContent = '場を よく 見て おこう！';
            timerDisplay.textContent = '';
            return;
        }
        const q = room.q;
        // The next meaning waits until the answer of the last one has been shown
        if (now < room.qAt) return;
        if (shownQ !== q) showQuestion(q);

        const limit = Karuta.timeLimit(game.cards.length) * 1000;
        const timedOut = now >= room.qAt + limit;
        if (settledQ !== q) {
            const left = Math.max(0, Math.ceil((room.qAt + limit - now) / 1000));
            timerDisplay.textContent = left;
            timerDisplay.classList.toggle('warning', left <= 3);
            if (Battle.settled(room, q) || timedOut) reveal(q);
        }
        if (isHost() && settledQ === q && advancedQ !== q) {
            advancedQ = q;
            if (q + 1 < game.questions.length) net.advance(code, q + 1).catch(e => console.error(e));
            else setTimeout(() => { if (code) net.end(code).catch(e => console.error(e)); }, Battle.REVEAL_MS);
        }
    }

    function showQuestion(q) {
        resetQuestionState();
        shownQ = q;
        const item = game.questions[q];
        questionEl.classList.remove('is-countdown', 'is-kanji');
        questionEl.textContent = item.meaning;
        questionCounter.textContent = `第${q + 1}問 / ${game.questions.length}問`;
        gradeBadge.textContent = `${item.grade}年生`;
        progressBar.style.width = `${(q / game.questions.length) * 100}%`;
        // The cards of the questions before this one have left the field
        const words = new Set(game.questions.slice(0, q).map(i => i.word));
        karuta.cards.forEach(card => { card.taken = words.has(card.item.word); });
        karuta.answer = -1;
        nextKaruta(item);
        // Back after a reload: someone who took a wrong card still sits out
        if (Battle.faulted(room, q, mySeat())) karuta.locked = true;
    }

    function takeCard(index) {
        if (karuta.locked || shownQ !== room.q || settledQ === shownQ) return;
        const q = shownQ;
        karuta.locked = true;
        if (index === karuta.answer) {
            karuta.buttons[index].classList.add('is-picked');
            net.take(code, room.round, q).catch(e => console.error(e));
            return;
        }
        karuta.buttons[index].classList.add('is-wrong');
        feedbackEl.textContent = 'おてつき！ この問題は お休み';
        feedbackEl.classList.add('incorrect');
        playSound(false);
        net.fault(code, q);
    }

    function reveal(q) {
        settledQ = q;
        karuta.locked = true;
        karuta.buttons.forEach(button => { button.disabled = true; });
        const item = game.questions[q];
        const take = Battle.takeOf(room, q);
        const mine = Boolean(take && take.seat === mySeat());
        const answer = karuta.buttons[karuta.answer];
        answer.classList.remove('is-picked');
        answer.classList.add(mine ? 'is-correct' : 'is-answer');
        if (!mine) {
            answer.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
        feedbackEl.className = '';
        if (mine) {
            streak++;
            feedbackEl.textContent = 'とった！';
            feedbackEl.classList.add('correct');
            if (streak >= 2) {
                feedbackEl.append(el('span', 'combo', `${streak}れんぞく！`));
                feedbackEl.classList.add('is-combo');
            }
            playSound(true, streak);
        } else {
            streak = 0;
            const taker = take && room.players[take.seat];
            feedbackEl.textContent = taker ? `${taker.name}さんが とった！` : 'だれも とれなかった…';
            feedbackEl.classList.add('incorrect');
        }
        timerDisplay.classList.remove('warning');
        showAnswerNote(item);
    }

    // --- Result ---
    function renderResult() {
        const seat = mySeat();
        const rows = Battle.standings(room);
        standingsEl.replaceChildren(...rows.map(row => {
            const li = el('li', `battle-standing${row.seat === seat ? ' is-me' : ''}${row.online ? '' : ' is-offline'}`);
            li.append(
                el('span', 'battle-rank', row.rank ? `${row.rank}位` : '―'),
                el('span', 'battle-standing-name', row.name),
                el('span', 'battle-standing-cards', `${row.cards}まい`),
                el('span', 'battle-standing-faults', row.online ? `おてつき ${row.faults}` : 'ぬけた')
            );
            return li;
        }));
        const me = rows.find(row => row.seat === seat);
        const key = `${code}:${room.round}:${room.seed}`;
        if (me && room.seed && recorded !== key) {
            recorded = key;
            const { newlyCollectedWords } = Records.recordResult(null, me.cards, room.count, [], me.words, 'yomi');
            newWordsSection.hidden = newlyCollectedWords.length === 0;
            newWordsListEl.replaceChildren(...newlyCollectedWords.map((word, i) => {
                const chip = el('span', 'new-kanji-chip new-word-chip', word);
                chip.style.animationDelay = `${0.4 + i * 0.08}s`;
                return chip;
            }));
            playResultSound(me.rank === 1 ? 100 : me.cards > 0 ? 50 : 0);
        }
        rematchBtn.hidden = !isHost();
        say(isHost() ? '' : 'ホストが「もう一度」を おすと、つぎの たいせんが はじまるよ');
        showView('result');
    }

    // --- Buttons ---
    gradeOptions.forEach(button => button.addEventListener('click', () => {
        choice.grade = button.dataset.grade;
        selectPill(gradeOptions, 'grade', choice.grade);
    }));
    countOptions.forEach(button => button.addEventListener('click', () => {
        choice.count = Number(button.dataset.count);
        selectPill(countOptions, 'count', choice.count);
    }));
    createBtn.addEventListener('click', create);
    joinBtn.addEventListener('click', join);
    codeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') join();
    });
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(urlInput.value);
            say('URLを コピーしたよ');
        } catch {
            urlInput.select();
        }
    });
    startBtn.addEventListener('click', () => {
        startBtn.disabled = true;
        net.start(code).catch(e => {
            console.error(e);
            startBtn.disabled = false;
        });
    });
    rematchBtn.addEventListener('click', () => {
        rematchBtn.disabled = true;
        net.rematch(code, room.round).catch(e => console.error(e)).finally(() => { rematchBtn.disabled = false; });
    });
    leaveBtn.addEventListener('click', async () => {
        await leave();
        open();
    });
    homeBtn.addEventListener('click', goHome);
    openBtn.addEventListener('click', () => open());

    // --- Init ---
    if (Cloud.battleAvailable) {
        openBtn.hidden = false;
        $('howto-battle').hidden = false;
        const invited = Battle.parseCode(new URLSearchParams(location.search).get('battle') || '');
        if (invited) open(invited);
    }

    return {
        // Is a 対戦 on the quiz screen
        playing: () => Boolean(code && room && room.status === 'playing' && quizScreen.classList.contains('active')),
        quit() {
            if (confirm('たいせんを ぬけますか？')) goHome();
        }
    };
})();
