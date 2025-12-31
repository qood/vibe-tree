# Claude Code 指示書: kthatoto/vibe-tree のDX/UXを「要件→自然に開発へ」に寄せる（統合1画面・唐突ターミナル問題の解消）

## 目的（ユーザーの不満の核心）
- 「Requirements（要件定義）を議論した後に、自然に開発へ入れる」体験がまだ達成できていない
- 初期から変にターミナル/Claude実行っぽい導線が見えて混乱する（＝“今は議論フェーズ”なのに実装フェーズに引っ張られる）
- NotesにNotionリンクを貼っても、それがどう活きるかが分からない（保存されるだけでUX的価値がない）
- 現状は Plan / TreeSpec / Chat が分断されていて「何をどこでやるのか」が分かりづらい

---

## ゴール（受け入れ条件 / Done）
プロジェクト選択後、ユーザーが迷わずこの流れを回せること：

1) Requirements パネルで要件を議論・整理（Notionリンク含む）
2) そこからタスク候補を生成（最低でも手動でBacklog投入が自然にできる）
3) Task Tree を確定
4) “明示的に” 開発開始（ブランチ/PR/Worktree/Claude）へ進む
   - 議論フェーズでは勝手にClaude/ターミナルが起動しない
   - 開発開始はユーザーが「Start Development」を押した時だけ

---

## 方針（最重要）
- 画面遷移は増やさず「統合1画面」で完結させる
- ただしフェーズ概念（議論→実装）をUI上で明示し、
  **自動で実装フェーズに入らない**ようにする

---

## Priority S（必ず実装）

### 1) Requirements Panel を “本当に使える” 状態にする（Plan UIの復活/統合）
#### 問題
- PlanはDBにあるがUIで contentMd が見えない/編集できない
- Notionリンクは貼れても活用されない

#### 実装
- メイン画面に Requirements Panel を常設（右 or 下）
- 以下を必ず提供：
  - Plan.title の表示/編集
  - Plan.contentMd の表示/編集（MarkdownテキストエリアでOK）
  - Notionリンク（URL）を貼る専用入力 + “リンク一覧”表示
    - URLを検出してリスト化し、ワンクリックで開ける
  - “Save” で plan.update（既存APIを使う or 追加）

#### UX要件
- プロジェクト選択直後は「Requirements」パネルを目立つ位置に置く
- 「まずここにPRD/Notionリンクを書け」状態を作る
- “Notionリンクを貼ったら何が起きる？”が見えるようにする
  - 最低限：リンク一覧化 + GitHub Issue作成時に含まれることを説明

---

### 2) フェーズ制御：勝手に実装に入らない
#### 問題
- 議論フェーズなのにタスク実行/Claude実行への圧が強い（混乱）

#### 実装
- Projectごとに “Workspace Phase” を持たせる（DBでもフロントstateでもOK）
  - `requirements` / `planning` / `execution`
- 初期は必ず `requirements`
- フェーズ遷移UI（メイン画面に小さく常設）：
  - Requirements → Planning（タスク化）
  - Planning → Execution（ブランチ/PR/Worktree/Claude開始）

#### 重要
- `execution` になるまで、Claude実行・ターミナルログ領域は
  - 完全非表示 or 折りたたみ + “Start Development” ボタンだけ表示
- 「変にターミナルが立ち上がる」を絶対に起こさない

---

### 3) Requirements → Backlog（タスク候補生成）の導線を作る
#### 問題
- 要件を議論しても、タスクツリーに落ちない
- 最初からタスクを自分で入力させられる

#### 実装（最短MVP）
- Requirements Panel に “タスク候補（箇条書き）”入力欄を追加
  - 例：1行=1タスク
- 「Backlogへ追加」ボタンで TreeSpec の Backlog に一括投入
  - 既存のタスク追加ロジックを再利用
- これにより「議論→タスク化」の自然な流れができる

#### 余裕があれば（任意）
- “Extract tasks from Requirements” ボタン
  - Claude（チャット）で要件テキストからタスク案を抽出して提案
  - ただしここは “チャット介在” が目的なので、
    ターミナル/Claude Code実行ではなく “要件整理用” として使う

---

### 4) Plan/TreeSpec/Chat の分断を減らす（最低限の統合）
#### 問題
- Planはあるがタスクと結びつかない
- Chatセッションがタスク/Worktree単位のみで、要件議論ができない

#### 実装
- Planに紐づく “Requirements Chat Session” を1つ用意する（オプション）
  - これは「要件整理用」で、実装実行用ではない
  - UI上は Requirements Panel内で軽く会話できればOK
- ただし、ユーザーの希望は「ターミナル中心」でもあるため、
  ここは “介在チャット” を最小限にし、あくまで要件整理に限定する

---

## Priority A（できればやる：開発開始の体験を完成させる）

### 5) Execution開始は明示的ボタンに集約（Start Development）
- Planning（タスクツリー確定）後に
  - 「Start Development」ボタンを1つだけ出す
- 押したら初めて以下を解禁：
  - ブランチ/PR/Worktree一括生成
  - Claude Code（エージェント）起動
  - ターミナルログ表示

---

### 6) “Notionリンクが活きる”を最低限実装
- リンクを一覧表示してすぐ開ける（必須）
- 可能なら：
  - GitHub Issue作成本文にリンク一覧を必ず含める（既に含まれるなら明示）
  - 将来のNotion API連携に備えて `notion_urls` を別カラム/別テーブルに保持

---

## Priority B（後回しOK：ただし方向性）
- `TreeDashboard.tsx` の肥大化を解消（panel単位で分割）
- Claude Codeエージェント（/api/ai/start）をUIから明示起動できるようにし、ログ表示
  - ただし “requirements/planning” では隠す

---

## まずやる作業（PR単位の実装順）
1) Requirements Panel を実装し、Plan.contentMd を表示/編集/保存できるようにする
2) Notion URL入力→リンク一覧表示（クリックで開く）
3) フェーズ制御を追加（requirements→planning→execution）
4) Requirements→Backlog投入（箇条書き→タスク生成）
5) Start Developmentボタンで初めて実装系UI（生成/Claude/ログ）を有効化

---

## 最終チェック（UX）
- プロジェクト選択直後にユーザーが「何をすればいいか」迷わない
- いきなり実装/ターミナル/Claudeに引っ張られない
- Notionリンクを貼ると “リンクとして扱われ”、開発時に参照できる
- 要件→タスク化→確定→実装開始の一本道が自然

以上を満たすように、既存コードを大胆に整理してよい。
