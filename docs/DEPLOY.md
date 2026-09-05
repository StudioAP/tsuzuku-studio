# GitHubで管理し、iPhone用のURLを公開する

この納品時点では、ユーザーのGitHubリポジトリの作成・push・公開は行っていません。以下はMac側で行う手順です。認証情報をチャット、コード、`.env`、Gitに書き込まないでください。

## 1. Macで事前確認

```bash
cd /path/to/tsuzuku-studio
npm run check
npm test
npm run build
npm run preview
```

`/path/to/tsuzuku-studio` は実際のフォルダへ置き換えます。`http://localhost:5173` を開いてデモを確認し、Control + Cで終了してください。`npm run dev` を別ターミナルで実行中なら、先に終了するか、`npm run preview -- --port 5174` を使います。

`dist/` はビルド生成物でありGit管理対象から外しています。ZIPにはすぐ配信できるビルドを同梱しますが、変更したら必ず再ビルドしてください。Macのフォルダ名に空白や日本語があってもビルドパスを扱えるよう実装しています。

## 2. 自分のGitHubにソースを置く

GitHubで空のリポジトリを作ります。名前の例は `tsuzuku-studio`。このアプリを一般公開する前提ならPublicが扱いやすいですが、公開範囲は自分で確認してください。PrivateリポジトリのPages利用可否はプラン等に依存します。[S6]

このフォルダを初めてGitに入れる場合の例です。

```bash
git init
git add .
git status --short
git commit -m "Initial local-only carousel editor"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

`YOUR_GITHUB_REPOSITORY_URL` はGitHubが表示するSSHまたはHTTPSのリポジトリURLに置き換えます。認証はMac側の通常のGitHub手順で行ってください。すでにGit管理中のフォルダなら、`git init` やremote追加を重ねず現状を確認します。

**commit前に `git status --short` を見て、実写真、書き出した画像、`.tsuzuku`、認証情報が入っていないことを確認してください。**標準では `private-photos/`、`exports/`、`test-results/`、`.env`、`*.tsuzuku` 等を除外しています。任意の別フォルダへ実写真を置いた場合まで自動検出する仕組みではありません。

## 3. PagesをGitHub Actions方式にする

リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。同梱の `.github/workflows/pages.yml` は、mainへのpushか手動実行で動きます。[S6]

最初のpush時はPages設定が未完了でワークフローが失敗する場合があります。設定後、**Actions → Deploy to GitHub Pages → Run workflow** でmainを選んで再実行してください。

ワークフローはソースの構文確認・テスト・ビルドを行い、`dist/` だけを配信アーティファクトにします。docs、テスト、作業用ファイル、`.git` をそのままWeb公開する構成ではありません。失敗しているジョブがあればログを読み、緑色になってから次に進みます。

Pagesの設定や完了したActionsに表示される公開URLを開いてください。HTTPSを使用し、設定画面で可能なら **Enforce HTTPS** を有効にします。[S6]

アプリ自体はログイン不要で、公開URLにアクセスした人は編集画面を使えます。あなたの下書きが他の人へ公開されるわけではありません。ただし、GitHubリポジトリをPublicにした場合、その中のソースと資料は公開されます。

## 4. iPhoneで確認する

公開されたHTTPSのURLをSafariで開きます。Macの `localhost` や `file://` のHTMLはiPhoneの本番確認には使いません。Web Share APIには安全なコンテキストとユーザー操作が必要です。[S3]

デモだけでなく実写真を1枚選び、2枚につなぎ、書き出して保存してください。一括保存の表示がなければ個別保存を試します。写真アプリで枚数を確認し、Instagramアプリで01、02の順に選び、比率を変えずにプレビューを確認します。

その後、Safariの共有メニューから「ホーム画面に追加」を選ぶと、アプリ風に開く入口を作れます。現行のiPhoneガイドでは「Webアプリとして開く」の設定も案内されていますが、具体的な表示はOSバージョンによって異なります。[S7]

## 5. 日常の更新

```bash
npm run check
npm test
npm run build
git diff
git add src styles public index.html sw.js manifest.webmanifest scripts tests docs README.md AGENTS.md
# 変更内容に合わせて対象を調整し、privateなファイルがないか確認する
git commit -m "Improve carousel editor"
git push
```

mainへのpush後は、Actionsの成功と公開URLでの動作を確認してください。画像処理や共有を変更したときは、ブラウザテストとiPhoneの保存テストも必要です。

## 別の静的ホスティングを使う場合

公開ディレクトリを `dist`、ビルドコマンドを `npm run build` とし、HTTPSで配信します。サーバー側のAPIや画像アップロード先は作りません。サービス固有の追加JavaScript、解析、画像最適化、フォーム収集を自動で挿入しない設定にしてください。

Nodeサーバーの常時稼働は不要です。ローカルの `scripts/serve.mjs` は開発補助用で、本番公開用のサーバーではありません。
