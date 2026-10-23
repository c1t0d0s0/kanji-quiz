import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const configFile = fileURLToPath(new URL('./config.js', import.meta.url));

/** config.js に書かれた `名前 = '値'` を読む (実行はせず、文字として読み取る) */
function readFromConfigJs(name: string): string {
    if (!existsSync(configFile)) return '';
    const match = readFileSync(configFile, 'utf8').match(new RegExp(`^\\s*(?:const|let|var)\\s+${name}\\s*=\\s*(['"\`])(.*?)\\1`, 'm'));
    return match ? match[2].trim() : '';
}

/** 環境変数があればその値、なければ config.js の値 (GitHub Actions では Variables を環境変数でわたす) */
const setting = (name: string) => (process.env[name] ?? '').trim() || readFromConfigJs(name);

/**
 * Google のタグの ID。GTM-… なら Google タグ マネージャー、G-… なら Google アナリティクス (gtag.js)。
 * なければタグは埋め込まない。
 */
function readGtmId(): string {
    const value = setting('GTM_ID');
    // HTML にそのまま書きこむので、ID の形をしていないものは受けつけない
    if (value && !/^(GTM|G)-[A-Z0-9]+$/.test(value)) {
        throw new Error(`GTM_ID の形式が正しくありません: "${value}" (GTM-XXXXXXX または G-XXXXXXXXXX)`);
    }
    return value;
}

/**
 * Firebase の設定 (Google ログインと Firestore への保存、意味かるた たいせん に使う)。
 * FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID の4つがそろっていなければ null で、
 * そのときはログインと対戦の入り口を出さず、Firebase のコードも読みこまれない。
 * FIREBASE_DATABASE_URL もあれば、意味かるた たいせん が使えるようになる。
 */
function readFirebaseConfig(): Record<string, string> | null {
    const config: Record<string, string> = {
        apiKey: setting('FIREBASE_API_KEY'),
        authDomain: setting('FIREBASE_AUTH_DOMAIN'),
        projectId: setting('FIREBASE_PROJECT_ID'),
        appId: setting('FIREBASE_APP_ID')
    };
    const filled = Object.values(config).filter(Boolean).length;
    if (filled === 0) return null;
    if (filled < 4) throw new Error('Firebase の設定が足りません。FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID の4つを入れてください');
    const databaseURL = setting('FIREBASE_DATABASE_URL');
    return databaseURL ? { ...config, databaseURL } : config;
}

/** 手元の Firebase エミュレーターにつなぐか (開発用)。環境変数 FIREBASE_EMULATOR=1 か、config.js の FIREBASE_EMULATOR = true */
function readEmulator(): boolean {
    if (process.env.FIREBASE_EMULATOR === '1') return true;
    if (!existsSync(configFile)) return false;
    return /^\s*(?:const|let|var)\s+FIREBASE_EMULATOR\s*=\s*true\b/m.test(readFileSync(configFile, 'utf8'));
}

/** GTM-… なら Google タグ マネージャー、G-… なら Google アナリティクス (gtag.js) のタグ */
function googleTags(id: string): HtmlTagDescriptor[] {
    if (id.startsWith('GTM-')) {
        return [
            {
                tag: 'script',
                injectTo: 'head',
                children:
                    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});" +
                    "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;" +
                    "j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);" +
                    `})(window,document,'script','dataLayer','${id}');`
            }
        ];
    }
    return [
        { tag: 'script', injectTo: 'head', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${id}` } },
        {
            tag: 'script',
            injectTo: 'head',
            children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`
        }
    ];
}

function googleTagPlugin(id: string): Plugin {
    return {
        name: 'kanji-quiz-google-tag',
        transformIndexHtml: () => (id ? googleTags(id) : [])
    };
}

/**
 * 公開したあとも、ブラウザに少しのあいだ古い index.html が残る (GitHub Pages は10分キャッシュさせる)。
 * ビルドごとの番号 (できたファイル全部の中身から作る) を <meta name="build"> と version.json に書いておき、
 * index.html の先頭の処理が、古いページを開いたときに新しい版を読みこみ直す。
 * ほかのファイルは Vite が名前に中身のハッシュを付けるので、キャッシュの心配はない。
 */
function buildVersionPlugin(): Plugin {
    return {
        name: 'kanji-quiz-build-version',
        apply: 'build',
        enforce: 'post',
        generateBundle(_options, bundle) {
            const html = bundle['index.html'];
            if (!html || html.type !== 'asset') return;
            const hash = createHash('sha256');
            for (const name of Object.keys(bundle).sort()) {
                const file = bundle[name];
                if (name === 'index.html') continue;
                hash.update(name);
                hash.update(file.type === 'chunk' ? file.code : file.source);
            }
            hash.update(String(html.source));
            const build = hash.digest('hex').slice(0, 10);
            html.source = String(html.source).replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <meta name="build" content="${build}">`);
            this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ build })}\n` });
        }
    };
}

export default defineConfig({
    // 相対パスで出力し、サブディレクトリ (…/kanji-quiz/) でもそのまま配信できるようにする
    base: './',
    plugins: [vue(), googleTagPlugin(readGtmId()), buildVersionPlugin()],
    define: {
        __FIREBASE_CONFIG__: JSON.stringify(readFirebaseConfig()),
        __FIREBASE_EMULATOR__: JSON.stringify(readEmulator())
    },
    build: {
        // The main script carries the kanji and 熟語 data (about 380 kB before compression)
        chunkSizeWarningLimit: 600
    },
    test: {
        include: ['tests/**/*.test.ts']
    }
});
