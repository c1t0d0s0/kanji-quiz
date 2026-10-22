# 漢字クイズ (Kanji Quiz)

小学校1〜6年生で習う配当漢字（1,026字）と熟語（6,000語以上）を楽しく学べる、ブラウザで動く4択クイズ＆熟語組み立てWebアプリケーションです。

インストールやユーザー登録なしですぐに遊べます。PC、タブレット、スマートフォン（GIGAスクール端末等）に対応しています。

---

## 🌟 主な機能と特徴

### 1. 3つのクイズモード
- **漢字から読み**: 表示された漢字の正しい読みを4択から選びます。
- **読みから漢字**: 表示された読みに合う漢字を4択から選びます。
- **熟語くみたて**: 読みに合う漢字タイルを順番にタップして熟語を組み立てます。意味のヒント付きで、間違えたタイルは枠をタップして戻せます。

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

外部ライブラリへのビルド依存がない静的Webサイト（Vanilla HTML/CSS/JS）です。任意のWebサーバーで起動できます。

### ローカルサーバーでの起動例

```bash
# リポジトリのクローン
git clone https://github.com/c1t0d0s0/kanji-quiz.git
cd kanji-quiz

# Python 3 を使う場合
python3 -m http.server 8000

# Node.js (npx) を使う場合
npx serve .
```

ブラウザで `http://localhost:8000` を開きます。

### 学年直接リンクの利用

```
http://localhost:8000/?grade=1  # 1年生
http://localhost:8000/?grade=2  # 2年生
http://localhost:8000/?grade=3  # 3年生
http://localhost:8000/?grade=4  # 4年生
http://localhost:8000/?grade=5  # 5年生
http://localhost:8000/?grade=6  # 6年生
http://localhost:8000/?grade=all # 全学年
```

---

## ⚙️ オプション設定 (`config.js`)

Google AnalyticsやFirebaseによるクラウドアカウント同期を有効にする場合は、`config.example.js` をコピーして `config.js` を作成します。

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
```
※ `config.js` はGitの追跡対象外（`.gitignore`）です。設定しない場合でも全クイズ機能はローカルストレージで正常に動作します。

---

## 📁 ファイル構成

```text
kanji-quiz/
├── index.html              # メインHTML
├── style.css               # スタイルシート（レスポンシブ、ダークモード、教科書体）
├── script.js               # アプリケーション全体の制御ロジック・UIハンドラ
├── records.js              # 成績・ずかん・設定・ごほうびの管理（localStorage / Firestore連携）
├── cloud.js                # Firebase Authentication & Firestore クラウド同期処理
├── kanji-data.js           # 小学校1〜6年生の漢字データ（1,026字）
├── jukugo-data.js          # 各学年向けの熟語データ（6,100語以上）
├── lynx.js                 # ヤマネコキャラクター描画・きせかえアイテム定義
├── config.example.js       # 設定ファイルのテンプレート
├── scripts/
│   ├── check-data.js       # 漢字・熟語データの整合性・学年範囲・重複等の検証スクリプト
│   └── add-versions.js     # デプロイ用キャッシュバスティング（?v=ハッシュ）付与スクリプト
└── .github/workflows/
    └── deploy.yml          # GitHub Pages への自動デプロイワークフロー
```

---

## 🧪 データの検証

漢字データと熟語データの整合性（学年配当、読みの妥当性、意味・ヒントの重複など）をチェックするスクリプトが用意されています。

```bash
node scripts/check-data.js
```

---

## 🚢 デプロイ (GitHub Pages)

`main` ブランチにプッシュすると、GitHub Actions（`.github/workflows/deploy.yml`）によって自動的にデータ整合性チェックが実行され、GitHub Pages へデプロイされます。

リポジトリの Settings > Secrets and variables > Actions > Variables に以下の変数を登録することで、本番環境の `config.js` が自動生成されます。
- `GTM_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

---

## 📄 ライセンス

[MIT License](LICENSE)
