# 漢字クイズ (Kanji Quiz)

小学校1〜6年生で習う配当漢字（1,026字）と熟語（6,000語以上）を楽しく学べる、ブラウザで動く4択クイズ＆熟語組み立てWebアプリケーションです。

インストールやユーザー登録なしですぐに遊べます。PC、タブレット、スマートフォン（GIGAスクール端末等）に対応しています。

---

## 🌟 主な機能と特徴

### 1. クイズモード
- **漢字から読み**: 表示された漢字の正しい読みを4択から選びます。
- **読みから漢字**: 表示された読みに合う漢字を4択から選びます。
- **熟語くみたて**: 読みに合う漢字タイルを順番にタップして熟語を組み立てます。意味のヒント付きで、間違えたタイルは枠をタップして戻せます。
- **意味かるた**: 意味に合う熟語のかるたを場から探して取ります（2〜8人の「たいせん」もあります）。
- **手書き**: 「(あか)いくつ」のように読みをひらがなで出題し、マスに指やペンで漢字を書いて答えます。[KanjiVG](https://kanjivg.tagaini.net) の字形とくらべて判定し、答えたあとはお手本を書き順の番号つきで表示します。低学年の字はくずれやすいので判定は甘めにし、学年が上がるほど厳しくなります。書き順は、ホームの「書き順も みる」を ON にしたときだけ判定し（初期値は OFF）、ON のときはどの学年でも書き順と画の向きがお手本どおりの字だけを正解にします（まちがえた画は答えのお手本で目立たせます）。じこベストは ON と OFF で別に記録します。正しく書けた漢字は「読みから漢字」のずかんに入ります。

### 2. 学年と出題数の選択
- **学年**: 1年生〜6年生、または全学年
- **出題数**: 5問 / 10問 / 20問
- **URL学年指定**: `index.html?grade=3` のようにクエリパラメータを付与することで、指定学年を選択した状態で開くことができます（学校の授業や宿題のリンクに便利です）。

### 3. 子どもの学習を支える仕組み
- **教科書体フォント**: 正しいトメ・ハネ・ハライが学べるよう、教科書体（UDデジタル教科書体、游教科書体、Klee One）を採用。
- **答えの解説ノート**: 1問解くごとにその漢字のすべての読みが表示され、解きながら語彙を広げられます。
- **復習モード**: 間違えた問題や時間切れになった漢字だけを、結果画面からもう一度集中して練習できます。
- **演出とサウンド**: 正解時のチャイム（連続正解で音階が上がるコンボ演出）、花丸アニメーション、ランク評価（S〜D）。

### 4. コレクション＆きせかえ（ゲーミフィケーション）
- **漢字ずかん**: 正解した漢字が集まります。「漢字から読み」と「読みから漢字」で個別に記録されます。
- **熟語ずかん**: クイズで正解した熟語がコレクションされます（6,000語以上収録）。
- **ヤマネコのきせかえ**: 学年の漢字をコンプリートしたり、熟語を集めたりすると、キャラクター「ヤマネコ」に装着できる帽子やアクセサリーなどのごほうびアイテムが手に入ります。
- **自己ベスト・練習日数**: モード・学年・出題数ごとの自己ベスト記録や、練習した日数が自動で記録されます。

### 5. データ保存とマルチデバイス同期
- **オフライン/ゲスト利用**: ブラウザの `localStorage` に記録を自動保存。ログイン不要ですぐに遊べます。
- **Googleアカウント同期（オプション）**: Firebase Firestoreと連携し、別の端末やブラウザでも同じ続きからプレイ可能です。

### 6. 配慮されたデザイン
- 原稿用紙と先生の赤ペンをモチーフにした親しみやすいデザイン。
- システムのダークモード設定に連動（黒板とチョーク風の配色に変化）。

---

## 🚀 使い方 / 起動方法

Vue 3 + TypeScript + Vite で作っています。Node.js 20.19 以上（推奨 24）が必要です。

### 開発サーバーでの起動

```bash
# リポジトリのクローン
git clone https://github.com/c1t0d0s0/kanji-quiz.git
cd kanji-quiz

npm install
npm run dev      # http://localhost:5173 で開発サーバーが起動します
```

### ビルドとテスト

```bash
npm test         # 自動テスト（Vitest）。記録・同期・出題・対戦のルール・漢字/熟語データの検証
npm run build    # 型の検査をしてから dist/ に公開用のファイルを作ります
npm run preview  # できた dist/ を http://localhost:4173 で確認します
```

`dist/` の中身をそのまま任意のWebサーバーに置けば動きます（サブディレクトリでも動くよう相対パスで出力します）。

### 学年直接リンクの利用

```
http://localhost:5173/?grade=1  # 1年生
http://localhost:5173/?grade=2  # 2年生
http://localhost:5173/?grade=3  # 3年生
http://localhost:5173/?grade=4  # 4年生
http://localhost:5173/?grade=5  # 5年生
http://localhost:5173/?grade=6  # 6年生
http://localhost:5173/?grade=all # 全学年
```

---

## ⚙️ オプション設定 (`config.js`)

Google AnalyticsやFirebaseによるクラウドアカウント同期を有効にする場合は、`config.example.js` をコピーして `config.js` を作成します。`config.js` は `npm run dev` / `npm run build` のときに `vite.config.ts` が読み取り、ページに埋めこみます（同じ名前の環境変数があれば、そちらが優先されます）。

```bash
cp config.example.js config.js
```

`config.js` の内容：
```javascript
// Google Tag Manager / Google Analytics (GA4)
// 空文字の場合はタグを読み込みません
const GTM_ID = 'G-XXXXXXXXXX';

// Firebase (Googleログイン & Firestore同期)
// 4項目すべて設定するとログイン機能が有効になります
const FIREBASE_API_KEY = '';
const FIREBASE_AUTH_DOMAIN = '';
const FIREBASE_PROJECT_ID = '';
const FIREBASE_APP_ID = '';

// 意味かるた たいせん (Firebase Realtime Database)。上の4項目も必要です
const FIREBASE_DATABASE_URL = '';
```
※ `config.js` はGitの追跡対象外（`.gitignore`）です。設定しない場合でも全クイズ機能はローカルストレージで正常に動作します。設定を変えたら、開発サーバーを起動し直してください。

開発中に手元の Firebase エミュレーターを使う場合は、`config.js` に `const FIREBASE_EMULATOR = true;` を書き、`npx firebase-tools emulators:start --only auth,firestore,database --project demo-kanji-quiz` で起動します。

---

## 📁 ファイル構成

```text
kanji-quiz/
├── index.html              # Vite の入口（フォント、新しい版の確認）
├── vite.config.ts          # Vue / Google タグ / Firebase 設定の埋めこみ / version.json の出力
├── config.example.js       # 設定ファイルのテンプレート
├── database.rules.json     # 意味かるた たいせん の Realtime Database ルール
├── public/                # ファビコン（favicon.svg / .ico、apple-touch-icon.png）。そのまま dist/ にコピーされます
├── src/
│   ├── main.ts, App.vue    # 起動と画面の組み立て
│   ├── styles.css          # スタイルシート（レスポンシブ、ダークモード、教科書体）
│   ├── data/               # 漢字データ（1,026字）、熟語データ jukugo.txt（6,100語以上）、
│   │                       # 手書きの例文 reibun.txt、KanjiVG から作った字形 kanjivg.ts
│   ├── core/               # 画面に関係ない処理（記録・同期・出題・かるた・対戦のルール・ヤマネコ・効果音）
│   ├── cloud/              # Firebase（ログイン・Firestore 同期・対戦の通信）。必要なときだけ読みこみます
│   ├── app/                # 画面の状態（クイズの進行・対戦の進行・選択中の学年など）
│   └── components/         # 画面とダイアログの Vue コンポーネント
├── tests/                  # Vitest のテスト（データの検証を含む）
└── .github/workflows/
    └── deploy.yml          # GitHub Pages への自動デプロイワークフロー
```

---

## 🧪 データの検証

漢字データと熟語データの整合性（学年配当、読みの妥当性、意味・ヒントの重複など）は、自動テストの一部（`tests/data.test.ts`）として検証されます。

```bash
npm test
```

---

## 🚢 デプロイ (GitHub Pages)

`main` ブランチにプッシュすると、GitHub Actions（`.github/workflows/deploy.yml`）によって自動的にテスト（データ整合性チェックを含む）とビルドが実行され、`dist/` が GitHub Pages へデプロイされます。

リポジトリの Settings > Secrets and variables > Actions > Variables に以下の変数を登録すると、ビルドのときにページに埋めこまれます。
- `GTM_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_DATABASE_URL`（意味かるた たいせん）

---

## 📄 ライセンス

[MIT License](LICENSE)

ただし `src/data/kanjivg.ts`（手書きの字形と書き順のデータ）は、Ulrich Apel 氏の [KanjiVG](https://kanjivg.tagaini.net) を加工して作ったもので、元と同じ [クリエイティブ・コモンズ 表示 - 継承 3.0（CC BY-SA 3.0）](https://creativecommons.org/licenses/by-sa/3.0/) で配布します。アプリの画面（手書きの画面と「あそびかた」）にもこの表示を出しています。データは `npm run kanjivg` で KanjiVG のリリースから作り直せます。
