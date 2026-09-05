つづく / tsuzuku — Macへ持ち帰る一式
==================================

このZIPひとつで大丈夫です。
前回のZIP・別添の説明・スクリーンショットを別に集める必要はありません。
元のアプリ実装と資料に、持ち帰り用の総合ガイドを加えてあります。

【最初にすること】

1. ZIPをMacのFinderで展開します。
2. 出てきた「tsuzuku-studio」フォルダを、フォルダごと保管します。
   以前の開発フォルダがある場合は上書きせず、別の場所に展開してください。
3. 「01_MAC_GUIDE.html」をダブルクリックして、説明を開いてください。
   これは説明書なので、そのまま開けます。インターネット接続は不要です。

【Codexに任せて始める】

MacのCodexで「tsuzuku-studio」フォルダを作業対象にし、
「02_CODEX_REQUEST.txt」の全文を貼り付けてください。
読む資料、確定条件、確認の順番、公開前にあなたへ確認する条件まで入っています。
このチャットを遡って依頼文を集め直す必要はありません。

【自分でMacで試す】

Node.js 22.12.0以上が必要です。
ターミナルで「cd 」と入力し（半角スペースを含む）、
Finderから「tsuzuku-studio」フォルダをドラッグしてEnterを押します。

次を実行します。

  node --version
  npm --version
  npm run dev

Macのブラウザで http://localhost:5173 を開き、
「まずはデモで試す」を押してください。
終了するときは、起動したターミナルで Control + C です。

通常の起動に npm install、APIキー、環境変数は不要です。
Node.jsが入っていない場合は、総合ガイドの「Macで起動する」を読んでください。

【間違えやすいこと】

・アプリの index.html をダブルクリックするのではなく、上の方法で起動します。
・Codexには dist/ だけでなく、tsuzuku-studio 全体を渡します。
・iPhoneではMacのlocalhostではなく、公開したHTTPS URLを開きます。
・GitHubへのpushや公開は、まだ行っていません。
・iPhone実機でのHEIC・写真への保存・Instagram投稿は未確認です。
・アプリのログイン、写真のサーバー送信、自動同期はありません。
・投稿の最後は、書き出した画像をInstagramアプリで選んで行います。

【どこに何があるか】

総合ガイド（読みやすい版）       01_MAC_GUIDE.html
総合ガイド（編集できる原稿）     MAC_HANDOFF.md
Codexへ貼り付ける全文            02_CODEX_REQUEST.txt
要件定義                        docs/REQUIREMENTS.md
技術設計                        docs/ARCHITECTURE.md
GitHub管理・公開手順             docs/DEPLOY.md
テスト・iPhone実機チェック表     docs/TESTING.md
今回の再梱包・確認記録           docs/PACKAGING_REPORT.md
全ファイルの一覧                PACKAGE_CONTENTS.txt

Node.jsやCodex本体、GitHubのアカウント・認証情報は同梱していません。
この一式にあなたの実写真は入っていません。
日常の編集写真・下書き・認証情報をGitや外部開発ツールへ送らないでください。
