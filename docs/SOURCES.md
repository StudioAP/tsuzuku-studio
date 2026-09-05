# 設計時に確認した一次資料

確認日：2026-09-05。以下はプラットフォーム側の条件を確認する資料であり、このアプリの実機テスト結果ではありません。Instagramアプリの上限を、InstagramのAPI自動投稿に関する別の上限と混同しないでください。

## [S1] Instagramの写真サイズ

Instagram Help Center, “Image resolution of photos you share on Instagram”

`https://help.instagram.com/1631821640426723/`

幅1080pxを基準とする写真アップロードと、1.91:1〜3:4の比率の案内を確認。今回の3種類の縦横比プリセットの根拠。

## [S2] Instagramアプリからの複数投稿

Instagram Help Center, “Share a post with multiple photos or videos on Instagram”

`https://help.instagram.com/269314186824048/`

スマートフォンのライブラリから最大20の写真・動画を選ぶ手順を確認。今回の出力20枚上限の根拠。ヘルプセンターは閲覧環境によってログイン等で本文表示が制限される場合がある。

## [S3] Web Share API

MDN, “Navigator: share() method” / “Web Share API”

`https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share`

`https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API`

安全なコンテキスト、ユーザー操作の一時的な有効状態、共有先のOS依存性、ファイル共有確認の要件を参照。画像生成と最終共有クリックを分離した理由。

## [S4] HEICのブラウザデコード

WebKit, “WebKit Features in Safari 17.0”

`https://webkit.org/blog/14445/webkit-features-in-safari-17-0/`

Safari 17でのHEICサポート追加を確認。実装はブラウザが読める場合だけHEICを受け付け、失敗時にはJPEGでの再選択を案内する。ファイルごとの実機成功を保証する根拠ではない。

## [S5] 端末保存の永続性

WebKit, “Updates to Storage Policy”

`https://webkit.org/blog/14403/updates-to-storage-policy/`

ブラウザ保存領域は通常best-effortで、削除・退避の可能性があることを確認。下書きを絶対に残るものとして扱わず、任意のファイルバックアップを提供する理由。

## [S6] GitHub Pagesでの静的配信

GitHub Docs, “Using custom workflows with GitHub Pages”

`https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`

GitHub Actions公式の静的Pagesスターターワークフロー

`https://github.com/actions/starter-workflows/blob/main/pages/static.yml`

GitHub Docs, “Securing your GitHub Pages site with HTTPS”

`https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https`

GitHub Docs, “Configuring a custom domain for your GitHub Pages site”

`https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site`

Actionsを配信元にする手順、アーティファクトのアップロードとデプロイ、HTTPS、公開・非公開リポジトリとプランの関係を参照。今回のワークフロー自体は、ユーザーのGitHubアカウント上では未実行。

## [S7] iPhoneのホーム画面から起動

Apple iPhone User Guide, “Turn a website into an app in Safari on iPhone”

`https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios`

Safariからホーム画面に追加する手順を確認。具体的なメニュー配置はiOS版によって異なる。

## [S8] Codexの引き継ぎ

OpenAI, “Custom instructions with AGENTS.md”

`https://developers.openai.com/codex/agent-configuration/agents-md`

継続的なリポジトリ指示をAGENTS.mdへ置く方法を参照。プロンプトだけでなく、ユーザーの確定した制約をリポジトリに残すために利用。
