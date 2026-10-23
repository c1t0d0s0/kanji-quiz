// --- 意味かるた たいせん: the screens ---
// entrance → waiting room (code, QR, URL) → field to look over → game → result.
// The game uses the quiz screen and the field of the one-player 意味かるた.
// Everything follows the room in Realtime Database; only the host moves it on.
import { reactive } from 'vue';
import * as Battle from '../core/battle';
import type { Room, SeatedPlayer, Standing } from '../core/battle';
import type { JukugoItem } from '../data/jukugo';
import * as Karuta from '../core/karuta';
import * as Records from '../core/records';
import { initAudio, playResultSound, playSound } from '../core/sound';
import { connectBattle, type BattleNet, type JoinResult } from '../cloud/battle-net';
import { goHome as showHome, screen, selection, showScreen } from './state';
import { clearFeedback, layField, nextCard, quiz, showCard, wordNote } from './quiz-view';
import { stopQuiz } from './session';

const NAME_KEY = 'kanji_quiz_battle_name';
const TICK_MS = 100;

export const gradeLabel = (grade: string | number) => (grade === 'all' ? '全学年' : `${grade}年生`);

// What the 対戦 screen shows
export const battle = reactive({
    view: 'entry' as 'entry' | 'lobby' | 'result',
    name: '',
    code: '',
    choice: { grade: 'all', count: 10 },
    busy: false,
    message: '',
    // Waiting room
    roomCode: '',
    roomSetting: '',
    inviteUrl: '',
    qr: '',
    players: [] as (SeatedPlayer & { host: boolean; me: boolean })[],
    isHost: false,
    canStart: false,
    starting: false,
    // Result
    standings: [] as (Standing & { me: boolean })[],
    newWords: [] as string[],
    rematching: false,
    // Goes up for every result, so its animations start again
    turn: 0
});

let net: BattleNet | null = null;
let code: string | null = null;
let room: Room | null = null;
let unwatch: (() => void) | null = null;

// The game of the current round
let game: { key: string; questions: JukugoItem[]; cards: JukugoItem[] } | null = null;
let shownQ = -1; // the question on the screen
let settledQ = -1; // the last question whose answer is shown
let advancedQ = -1; // host: the last question moved on from
let streak = 0;
let tick: ReturnType<typeof setInterval> | undefined;
let recorded: string | null = null; // the round already put in the ずかん

const isHost = () => Boolean(room && net && room.hostUid === net.uid);
const mySeat = () => (net && code ? net.seatIn(code) : null);

function readName() {
    try {
        return localStorage.getItem(NAME_KEY) || '';
    } catch {
        return '';
    }
}

function saveName(name: string) {
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch {
        // Not kept on this device; asked again next time
    }
}

function say(text: string) {
    battle.message = text;
}

function setUrl(roomCode: string | null) {
    const url = new URL(location.href);
    if (roomCode) url.searchParams.set('battle', roomCode);
    else url.searchParams.delete('battle');
    history.replaceState(null, '', url);
}

const inviteUrl = (roomCode: string) => {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('battle', roomCode);
    return url.href;
};

// --- Entrance ---
// Focuses an input of the entrance (BattleScreen.vue gives the elements)
export const focus = { name: () => {}, code: () => {} };

export function openBattle(prefill?: string) {
    stopQuiz();
    initAudio();
    battle.choice = { grade: selection.grade, count: selection.count };
    battle.name = readName();
    battle.code = prefill || '';
    say('');
    battle.view = 'entry';
    showScreen('battle');
    if (prefill && battle.name) join();
    else if (prefill) setTimeout(() => focus.name());
}

function takeName() {
    const name = Battle.cleanName(battle.name);
    if (!name) {
        say('なまえを 入れてね');
        focus.name();
        return null;
    }
    battle.name = name;
    saveName(name);
    return name;
}

async function connect() {
    say('つないでいます…');
    net = await connectBattle();
    return net;
}

async function run(job: () => Promise<void>) {
    if (battle.busy) return;
    battle.busy = true;
    try {
        await job();
    } catch (e) {
        console.error('Battle failed', e);
        say('つながりませんでした。時間を おいて、もう一度 ためしてね。');
    } finally {
        battle.busy = false;
    }
}

export function create() {
    const name = takeName();
    if (!name) return;
    void run(async () => {
        const n = await connect();
        enter(await n.create(battle.choice.grade, battle.choice.count, name));
    });
}

const JOIN_ERRORS: Record<Exclude<JoinResult, 'ok'>, string> = {
    missing: 'その コードの 部屋は 見つからないよ。',
    started: 'その 部屋は もう はじまっているよ。',
    full: 'その 部屋は いっぱいだよ（8人まで）。',
    version: 'ページを 読みこみ直してから 入ってね（新しい 問題に なっているよ）。'
};

export function join() {
    const name = takeName();
    if (!name) return;
    const roomCode = Battle.parseCode(battle.code);
    if (!roomCode) {
        say('コードは 数字5けただよ');
        focus.code();
        return;
    }
    void run(async () => {
        const n = await connect();
        const result = await n.join(roomCode, name);
        if (result === 'ok') enter(roomCode);
        else say(JOIN_ERRORS[result]);
    });
}

function enter(roomCode: string) {
    code = roomCode;
    room = null;
    game = null;
    recorded = null;
    say('');
    setUrl(code);
    void renderInvite(code);
    unwatch = net!.watch(code, onRoom);
}

// Leaves the room (the host's room is removed for everyone)
async function leave() {
    const left = code;
    stop();
    if (left && net) await net.leave(left).catch(() => {});
}

export async function leaveRoom() {
    await leave();
    openBattle();
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

export async function goHome() {
    await leave();
    showHome();
}

// Is a 対戦 on the quiz screen
export const playing = () => Boolean(code && room && room.status === 'playing' && screen.value === 'quiz');

export function quitBattle() {
    if (confirm('たいせんを ぬけますか？')) void goHome();
}

// --- Waiting room ---
async function renderInvite(roomCode: string) {
    const url = inviteUrl(roomCode);
    battle.roomCode = roomCode;
    battle.inviteUrl = url;
    battle.qr = '';
    try {
        const QRCode = (await import('qrcode')).default;
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#1c2a4a', light: '#fdfdfa' } });
        if (code === roomCode) battle.qr = qr;
    } catch {
        // Without the QR code, the code and the URL still work
    }
}

export async function copyUrl(select: () => void) {
    try {
        await navigator.clipboard.writeText(battle.inviteUrl);
        say('URLを コピーしたよ');
    } catch {
        select();
    }
}

function renderLobby(r: Room) {
    battle.roomSetting = `${gradeLabel(Battle.gradeOf(r))}・${r.count}問`;
    const seat = mySeat();
    const players = Battle.playersList(r);
    battle.players = players.map(p => ({ ...p, host: p.uid === r.hostUid, me: p.seat === seat }));
    const here = players.filter(p => p.online).length;
    battle.isHost = isHost();
    battle.canStart = here >= 2;
    if (battle.isHost) say(here < 2 ? 'ともだちが 入るのを まってね。コードか QRコードを 見せよう！' : 'みんな そろったら スタート！');
    else say('ホストが スタートするのを まってね');
    battle.view = 'lobby';
}

export function start() {
    if (!net || !code) return;
    battle.starting = true;
    net.start(code)
        .catch(e => console.error(e))
        .finally(() => {
            battle.starting = false;
        });
}

export function rematch() {
    if (!net || !code || !room) return;
    battle.rematching = true;
    net.rematch(code, room.round)
        .catch(e => console.error(e))
        .finally(() => {
            battle.rematching = false;
        });
}

// --- Following the room ---
function onRoom(next: Room | null) {
    if (!code) return;
    if (!next) {
        stop();
        openBattle();
        say('部屋が なくなりました（ホストが 出たよ）');
        return;
    }
    room = next;
    if (room.status === 'playing') {
        startGame(room);
        renderScores(room);
        step();
        return;
    }
    stopTick();
    showScreen('battle');
    if (room.status === 'waiting') renderLobby(room);
    else renderResult(room);
}

function startGame(r: Room) {
    const key = `${r.round}:${r.seed}`;
    if (game && game.key === key) return;
    game = { key, ...Battle.makeGame(r) };
    shownQ = -1;
    settledQ = -1;
    advancedQ = -1;
    streak = 0;
    quiz.mode = 'karuta';
    quiz.battle = true;
    quiz.hint = null;
    quiz.build = null;
    quiz.options = [];
    clearFeedback();
    quiz.progress = 0;
    quiz.counter = `${game.questions.length}問`;
    quiz.badge = gradeLabel(Battle.gradeOf(r));
    quiz.timer = '';
    showScreen('quiz');
    layField(game.cards);
    stopTick();
    tick = setInterval(step, TICK_MS);
}

function stopTick() {
    clearInterval(tick);
    tick = undefined;
}

function renderScores(r: Room) {
    const seat = mySeat();
    quiz.scores = Battle.standings(r).map(row => ({ seat: row.seat, name: row.name, cards: row.cards, me: row.seat === seat, online: row.online }));
}

// Runs every TICK_MS while playing, and on every change of the room
function step() {
    if (!room || room.status !== 'playing' || !game || !net || !code) return;
    const now = net.serverNow();
    if (now < (room.startAt ?? 0)) {
        const left = Math.ceil(((room.startAt ?? 0) - now) / 1000);
        quiz.question = `${left}`;
        quiz.questionKind = 'countdown';
        quiz.feedback = { text: '場を よく 見て おこう！', kind: '', combo: 0 };
        quiz.timer = '';
        return;
    }
    const q = room.q ?? 0;
    // The next meaning waits until the answer of the last one has been shown
    if (now < (room.qAt ?? 0)) return;
    if (shownQ !== q) showQuestion(room, q);

    const limit = Karuta.timeLimit(game.cards.length) * 1000;
    const qAt = room.qAt ?? 0;
    const timedOut = now >= qAt + limit;
    if (settledQ !== q) {
        const left = Math.max(0, Math.ceil((qAt + limit - now) / 1000));
        quiz.timer = String(left);
        quiz.timerWarning = left <= 3;
        if (Battle.settled(room, q) || timedOut) reveal(room, q);
    }
    if (isHost() && settledQ === q && advancedQ !== q) {
        advancedQ = q;
        const roomCode = code;
        if (q + 1 < game.questions.length) net.advance(roomCode, q + 1).catch(e => console.error(e));
        else setTimeout(() => {
            if (code && net) net.end(code).catch(e => console.error(e));
        }, Battle.REVEAL_MS);
    }
}

function showQuestion(r: Room, q: number) {
    const k = quiz.karuta;
    if (!game || !k) return;
    clearFeedback();
    shownQ = q;
    const item = game.questions[q];
    quiz.turn++;
    quiz.question = item.meaning;
    quiz.questionKind = 'text';
    quiz.counter = `第${q + 1}問 / ${game.questions.length}問`;
    quiz.badge = `${item.grade}年生`;
    quiz.progress = (q / game.questions.length) * 100;
    // The cards of the questions before this one have left the field
    const words = new Set(game.questions.slice(0, q).map(i => i.word));
    k.cards.forEach(card => {
        card.taken = words.has(card.item.word);
    });
    k.answer = -1;
    nextCard(item);
    // Back after a reload: someone who took a wrong card still sits out
    if (Battle.faulted(r, q, mySeat())) k.locked = true;
}

export function takeBattleCard(index: number) {
    const k = quiz.karuta;
    if (!k || !room || !net || !code || k.locked || shownQ !== room.q || settledQ === shownQ) return;
    const q = shownQ;
    k.locked = true;
    if (index === k.answer) {
        k.cards[index].state = 'is-picked';
        net.take(code, room.round, q).catch(e => console.error(e));
        return;
    }
    k.cards[index].state = 'is-wrong';
    quiz.feedback = { text: 'おてつき！ この問題は お休み', kind: 'incorrect', combo: 0 };
    playSound(false);
    void net.fault(code, q);
}

function reveal(r: Room, q: number) {
    const k = quiz.karuta;
    if (!game || !k) return;
    settledQ = q;
    k.locked = true;
    k.finished = true;
    const item = game.questions[q];
    const take = Battle.takeOf(r, q);
    const mine = Boolean(take && take.seat === mySeat());
    k.cards[k.answer].state = mine ? 'is-correct' : 'is-answer';
    if (!mine) showCard(k.answer);
    if (mine) {
        streak++;
        quiz.feedback = { text: 'とった！', kind: 'correct', combo: streak >= 2 ? streak : 0 };
        playSound(true, streak);
    } else {
        streak = 0;
        const taker = take && r.players[take.seat];
        quiz.feedback = { text: taker ? `${taker.name}さんが とった！` : 'だれも とれなかった…', kind: 'incorrect', combo: 0 };
    }
    quiz.timerWarning = false;
    quiz.note = wordNote(item);
}

// --- Result ---
function renderResult(r: Room) {
    const seat = mySeat();
    const rows = Battle.standings(r);
    battle.standings = rows.map(row => ({ ...row, me: row.seat === seat }));
    const me = rows.find(row => row.seat === seat);
    const key = `${code}:${r.round}:${r.seed}`;
    if (me && r.seed && recorded !== key) {
        recorded = key;
        const { newlyCollectedWords } = Records.recordResult(null, me.cards, r.count, [], me.words, 'yomi');
        battle.newWords = newlyCollectedWords;
        battle.turn++;
        playResultSound(me.rank === 1 ? 100 : me.cards > 0 ? 50 : 0);
    }
    battle.isHost = isHost();
    say(battle.isHost ? '' : 'ホストが「もう一度」を おすと、つぎの たいせんが はじまるよ');
    battle.view = 'result';
}
