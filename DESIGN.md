---
version: alpha
name: Tsuzuku Studio Design System
description: 写真を主役に、編集の判断を静かに支えるiPhone-firstのローカル写真編集UI。
colors:
  primary: "#242E2B"
  secondary: "#647055"
  tertiary: "#D9EE82"
  neutral: "#F7F8F2"
  surface: "#FFFFFF"
  on-surface: "#242E2B"
  on-primary: "#253022"
  line: "#E0E4DB"
  warning: "#985B47"
typography:
  headline:
    fontFamily: "Hiragino Kaku Gothic ProN"
    fontSize: 23px
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: 0.04em
  body:
    fontFamily: "Hiragino Kaku Gothic ProN"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0em
  label:
    fontFamily: "Hiragino Kaku Gothic ProN"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0.04em
rounded:
  sm: 7px
  md: 12px
  lg: 18px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 16px
  editor-panel:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 16px
  warning-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
    rounded: "{rounded.md}"
    padding: 12px
  divider:
    backgroundColor: "{colors.line}"
    textColor: "{colors.primary}"
    height: 1px
  studio-order-dock:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 12px
  studio-order-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: 46px
  photo-edit-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 16px
---
# Tsuzuku Studio Design System

## Overview
写真を主役にし、操作は編集室の道具のように静かに置く。生成AI風の華美さではなく、紙・植物・自然光を思わせる淡いニュートラルと黄緑の一点アクセントで、初めてでも順序を見失わない画面にする。署名的な表現は、複数ページを一続きに見せるプレビューと、その境界線である。

## Colors
- **Primary** (`#242E2B`): 本文と重要な判断。真っ黒は使わない。
- **Secondary** (`#647055`): 補助操作、説明、未選択状態。
- **Tertiary** (`#D9EE82`): 書き出しや確定など、各画面で一つの主操作に限定する。
- **Neutral** (`#F7F8F2`): アプリ全体の静かな背景。
- **Surface** (`#FFFFFF`): 編集カード、ダイアログ、写真を載せる面。
- **Warning** (`#985B47`): 削除と復旧が必要なエラーだけに使う。

## Typography
- **Headline**: 日本語の読みやすさを優先し、過度に太くしない。ブランド名のみGeorgia系を使える。
- **Body**: 小さめでも行間を広く取り、写真操作の説明は二文以内にする。
- **Label**: 操作名と現在値を近接させ、英大文字のeyebrowは装飾的な補助情報に限定する。

## Layout
デスクトップはプレビューを主、編集パネルを従とする二列。800px以下は一列にし、写真の順番・掲載ページ数・仕上がりを一つの「スタジオ」にまとめる。個別設定はプレビュー上の写真か写真カードの一タップで全画面の写真編集シートを開き、一覧まで移動する縦スクロールをなくす。戻った時は同じ写真・画面位置を保つ。選択中の写真は安定した位置の並べ替えドックから前後へ一段ずつ動かせ、先頭・末尾へも一度で移動できる。カード自体が動いても操作位置を追いかけさせない。タッチ対象は原則44px以上。編集シートの固定ヘッダーには対象写真のサムネイル・名前・選択位置を常時残し、下部メニューまで移動しても指示対象を見失わせない。前処理は元写真と変更結果を同時に判断できる専用ダイアログに集約する。書き出し操作は編集領域の後に配置し、プレビューや操作部品へ重ねない。

## Elevation & Depth
基本は細い境界線で区切り、影は写真プレビューとモーダルだけに使う。写真編集面には淡い植物色のグラデーションを許可するが、コンテンツより強くしない。

## Shapes
カードは18px、操作は7〜12pxの角丸。写真そのものは小さい角丸または直角とし、輪郭を曖昧にしない。ピル形状はページ番号や短い状態表示だけに使う。

## Components
- **Continuous Preview**: ページ境界を見せつつ、出力画像にガイドを混ぜない。表示ページ上の写真をタップした場所から、その写真の編集を開く。
- **Studio Workspace**: 投稿の形、背景、プレビュー、写真一覧、分割枚数、前処理を一つの編集場所に集約する。
- **Stable Order Dock**: 選択写真の現在位置と、固定配置の「前へ」「次へ」「先頭へ」「末尾へ」を示す。移動でボタンの場所を変えない。
- **Photo Editing Sheet**: スタジオの写真カードから一タップで入る独立画面。固定ヘッダーに対象写真のサムネイル・名前・選択位置を出す。固定ヘッダーと固定の完了操作の間に、対象ブロックの出力ページを横につないだライブプレビューを置く。プレビューは操作中も視界に残し、同じ描画シーンで設定変更を即時反映する。前後の写真へシート内で切り替え、一覧のスクロール位置と最後に選んだ写真を維持して戻る。
- **Photo Preparation Dialog**: 写真面を直接1本指でドラッグ、2本指でピンチ拡大できることを主操作にする。元の縦横フレームを固定した回転、±0.1度の微調整、拡大スライダー、中央復帰、四辺トリミング、正方形プリセット、確定と取消も同じ画面に置く。回転・移動中のプレビューに白場を見せない。
- **Selection Card**: サムネイル、ファイル名、1枚／連結／組み合わせ状態を一読できる。
- **Primary Button**: 一画面一つ。黄緑面と濃色文字を使う。
- **Range Control**: ラベルと現在値を同じ行に置き、変更中の結果を即時プレビューする。

## Do's and Don'ts
- Do keep original photos untouched and describe edits as reversible preparation.
- Do show whether a photo is square, cropped, or tilted before layout controls.
- Do pair the rotation slider with explicit minus and plus buttons for fine correction.
- Do use direct manipulation on the photo while retaining labeled controls as an accessible fallback.
- Do keep repeated actions in a stable screen location and offer both one-step and direct-to-edge movement.
- Do preserve the user's viewport and selected photo after a reorder.
- Do open per-photo settings directly from the preview or photo card and return to its prior screen position.
- Do keep the export action in document flow so it never obscures the preview or controls.
- Do default portraits to frame-filling; let square and landscape singles fill the width and leave the top/bottom to the chosen background.
- Do preserve one output ratio while allowing differently prepared photos to coexist.
- Do verify the hardest mobile viewport and the exported pixels.
- Don't turn the editor into a free-form canvas with hidden gestures.
- Don't require dragging or repeatedly chasing a moving per-photo control to reorder.
- Don't use color alone to communicate selection or completion.
- Don't place page numbers, crop guides, or controls in exported images.
- Don't let secondary photo controls compete with the export action.
