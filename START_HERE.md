# Macへ持ち帰ったら、ここから

## 1. まず動かす

ZIPを展開して `tsuzuku-studio` フォルダをMacに置きます。ターミナルでそのフォルダに移動し、Node.js 22.12以上が利用できることを確認します。

```bash
node --version
npm run dev
```

`http://localhost:5173` をMacのブラウザで開き、「まずはデモで試す」を押してください。終了するときはターミナルで Control + C です。

## 2. Codexにはこのフォルダを渡す

このフォルダを作業対象にして、次の文を渡してください。

> このリポジトリの AGENTS.md、README.md、docs/CODEX_HANDOFF.md、docs/TESTING.md を読んでください。仕様だけでなく実装も入っています。全面的に作り直さず、まず npm run check、npm test、npm run build を実行して現在の動作を確認してください。写真をサーバーに送らない、ログインしない、端末間同期をしない、最後の投稿はInstagramアプリ、という条件を維持してください。次に私のiPhoneでHEICの取り込みと画像保存を確認し、必要な修正だけを行ってください。GitHubへのpushや公開の前には、変更内容と公開先を私に確認してください。

## 3. iPhoneで使えるURLにする

GitHubリポジトリへ管理用のソースを置き、同梱のGitHub Actionsで `dist/` を公開する構成です。手順は `docs/DEPLOY.md` にあります。GitHubの認証・リポジトリ作成・公開設定はMac側で行います。この納品時点ではGitHubへのpushや公開はしていません。

## 4. 最初の実機テスト

公開されたHTTPSのURLをiPhoneのSafariで開き、横長写真1枚で「2枚」「全体を残す」を試してください。書き出し後、2枚を保存し、Instagramで01、02の順に選びます。左右のつながり、画面比率、保存枚数を確認できれば、日常の写真で試し始められます。

一括で画像を保存できなければ、書き出し画面の1枚ずつの保存を使ってください。実機確認表は `docs/TESTING.md` に用意しています。
