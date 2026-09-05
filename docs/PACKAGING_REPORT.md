# Mac持ち帰り版 — 統合と検証の記録

確認日：2026-09-05。作業種別は既存成果物の再梱包・説明書の追加です。
**アプリのソース、仕様、既存のテスト・資料は変更していません。**

## 1. 統合したもの

元の `tsuzuku-studio.zip` の79ファイルを、そのままの相対パスで収録しています。
展開・構文確認・テスト・再ビルド後も、すべて元のZIPとバイト単位で一致することを確認しました。
元のZIPを入れ子で収録するのではなく、その中身を通常の開発フォルダとして収録しています。

| 別添されていたもの | 今回の収録先と照合結果 |
|---|---|
| `tsuzuku-start-here.md` | `START_HERE.md` と同内容。既存ファイルで収録。 |
| 別添の要件定義書 | `docs/REQUIREMENTS.md` と同内容。既存ファイルで収録。 |
| 最終回答に添付されたデスクトップ画像 | `docs/screenshots/editor-desktop.png` と同内容。既存ファイルで収録。 |
| 会話中の別版のデスクトップ画像 | `docs/screenshots/conversation/editor-desktop.png` に原データを収録。 |
| 会話中の別版のモバイル画像 | `docs/screenshots/conversation/editor-mobile.png` に原データを収録。 |
| 会話中の別版の書き出し画像 | `docs/screenshots/conversation/export-mobile.png` に原データを収録。 |

追加した総合ガイドには、目的、ユーザーの確定条件、実装内容、初期値、余白と切り取り、画質と上限、Macの起動、保存と投稿、下書き、Codexへの依頼、GitHub管理、公開、実機確認、トラブル対応、未実装、更新、資料一覧、整合性確認を記載しました。

`00_READ_ME_FIRST.txt` は入口、`01_MAC_GUIDE.html` はブラウザで直接開ける説明書、`MAC_HANDOFF.md` はその原稿、`02_CODEX_REQUEST.txt` は全文を渡せる依頼文です。
HTMLは同梱画像と内部スタイルだけを使用し、外部フォント・スクリプト等を読み込みません。
全ファイル一覧を `PACKAGE_CONTENTS.txt`、SHA-256を `CHECKSUMS.sha256` に記載しています。

## 2. 今回再実行したコード検証

環境：Linux、Node.js v22.16.0、npm 10.9.2。

| コマンド | 結果 |
|---|---|
| `npm run check` | PASS。16 JavaScriptモジュール。 |
| `npm test` | PASS。82件成功、失敗0、skip0。 |
| `npm run build` | PASS。ビルド識別子 `b9cf766ad81c2a76`。 |

出力は `docs/packaging-validation.txt` に収録しています。
再ビルドした `dist/` も元の納品ZIPと同一でした。

## 3. 梱包と説明書の確認

- 元ZIPの79ファイルが欠けていないこと、内容を変更していないことを照合。
- 別添ファイルを全件比較し、同内容は既存ファイルで、異なる画像は別名の場所で収録。
- `.github/`、`.gitignore`、`.nvmrc`、`dist/.nojekyll` 等の隠しファイルも収録。
- 開発／配信用のローカルHTTP配信で、HTML・JavaScript・CSS等の取得を確認。
- 総合ガイドのローカルリンクと画像参照先が存在することを確認。
- Chromiumに総合ガイドのHTMLを直接渡し、1440px／390px幅で横はみ出しがないことを確認。表示確認用にのみ同梱画像を埋め込み、CSPを外した一時コピーを使用。配布HTMLは変更していません。これはアプリの機能テストとは別です。
- 最終ZIPのCRC、内容一覧、チェックサムを照合。チェックサムはチェックサムファイル自身を除く。

検証コンテナのブラウザは管理ポリシーにより `file://` とlocalhostのURL遷移をブロックしたため、URLを開く形の表示確認はできませんでした。上記のHTML直接描画と、PythonによるローカルHTTP応答の確認を分けて実施しています。MacのFinderからの実際のダブルクリック操作は未確認です。

## 4. 今回の作業では未実行・未確認のもの

元資料の19ブラウザシナリオは前回納品時の記録です。今回は再実行していません。
元の `docs/TESTING.md`、`docs/browser-results.json`、`docs/test-command-results.txt` を保持しています。

MacのSafari、iPhone実機のHEIC読み込み・向き・色・写真保存・Instagram投稿、
iPhoneの高解像度写真での負荷、ホーム画面起動の実動作は未確認です。
GitHubのアカウント操作、リポジトリ作成、push、Pages公開も未実行です。

今回、Node.js・GitHub・Instagram・iOS・Codex等のプラットフォーム仕様を新しく調査したものではありません。
既存の要件・実装・資料を整理した版であり、管理画面や料金・利用条件等は実際の設定時に公式情報を確認してください。

## 5. 同梱しないもの

Node.js、Codex、Git、Python等のツール本体、任意テスト用のインストール済みライブラリ、
利用者のアカウント・認証情報、実写真、下書き、個人のGit履歴、旧ZIPそのものは含めません。
通常のアプリ起動にnpm依存パッケージやAPIキーは不要です。

このZIPだけでコード・仕様・手順をMacへ持ち帰れますが、開発ツールの導入、
GitHubでの認証・公開先の設定、iPhone実機の確認はMac側で行う作業です。
