# Vibe Tree 最終実装指示書（ステートレス版）

## 0. 全体方針（最重要）

- Vibe Tree はローカルWeb UIであり、開発の「司令塔 / 監督」である
- Claude Code は常駐プロセスではない
  - 毎回「最新の状態を要約したプロンプト」を入力として起動する
  - セッションはステートレス（状態は再構築）
- ステートの正は以下のみ
  - DB（意志・設計）
  - Git / GitHub（事実）
- UIはリッチにしすぎない
  - 基本は **1画面 Tree ダッシュボード**
  - 設定画面以外で画面遷移しない

---

## 1. 技術スタック（固定）

- Runtime: Bun
- Backend: Hono
- DB: SQLite
- ORM: Drizzle
- Frontend: React + TypeScript
- Git操作: git CLI
- GitHub操作: gh CLI + gh api
- 通信: REST + WebSocket

---

## 2. データ管理の原則

### DBに保存するもの（＝意志・設計）
- repos
- project_rules
  - ブランチ命名規則
  - 分割戦略（CRUD分割・画面分割など）
- plans
- tree_specs（設計ツリー）
- instructions_log（全指示・判断の生ログ）

### DBに保存しないもの（＝事実）
- ブランチ一覧
- コミット
- PR状態
- CI結果
- worktree状態

※ 事実はすべて scan 時に CLI で取得する

---

## 3. Plan Mode（計画フェーズ）

### 3.1 Plan の目的

- 実装開始前に「意図・分割・戦略」を固定する
- Plan は後から編集可能（Plan確定＝不変ではない）

### 3.2 Plan のテンプレート（必須）

Plan は最低限、以下の構造を持つこと：

- Goal（目的）
- Non-goals（やらないこと）
- Constraints（制約）
- Risks（懸念）
- Work Breakdown（分割案）
- Tree Strategy（ブランチツリー戦略）

---

## 4. 初期ツリー設計（複数パターン対応）

### Pattern A: 既存 GitHub Issue 起点

- 親Issueを情報源として渡す
- gh api を用いて以下を取得する
  - 親Issue本文・コメント
  - 子Issue / dependency（sub-issue）
- Issue構造をもとに以下を行う
  - 実装単位への分割
  - ブランチツリー設計（直列 / 並列 / 依存）
- Issue構造は「意図」であり、Git構造とは独立

### Pattern B: Notion ドキュメント起点

- Notionは Claude Code が MCP 経由で読む
- 見出し / TODO / セクションを実装単位に分割
- 必要に応じて GitHub Issue を新規作成
- Issue / ブランチ / PR の対応を設計

### Pattern C: 口頭説明 + コード読解起点

- 対象コードを読み、必要な変更点を列挙
- 実装順序を考慮してツリー構造を設計
- 必要に応じて Issue を作成

---

## 5. 分割戦略（学習対象）

- 原則：1 branch = 1 PR
- 分割しすぎ OK（PR 10本 / 20本でも可）
- CRUD / 画面 / 機能単位で細かく分ける
- 例外的にまとめる判断も可
  - 例外判断は instructions_log に必ず残す
  - 将来の分割判断の学習材料とする

---

## 6. 設計ツリー（tree_specs）

### 6.1 位置づけ

- tree_specs は「設計上の正」
- Git の merge-base 推定は参考情報にすぎない

### 6.2 tree_specs の役割

- ノード = ブランチ
- エッジ = 意図した親子 / 依存関係
- ノードには以下を紐付け可能とする
  - branch
  - issue
  - PR（想定）

---

## 7. scan（事実観測）

scan では以下を取得し、スナップショットを生成する：

### Git
- ブランチ一覧
- merge-base による親子推定
- ahead / behind
- dirty
- worktree 一覧

### GitHub Issue
- gh api により以下を取得
  - 親Issue
  - 子Issue / dependency

### GitHub PR
- gh pr view / list --json により取得
  - labels
  - assignees
  - reviewDecision
  - statusCheckRollup
  - additions / deletions / changedFiles
  - state / isDraft / url

---

## 8. Tree ダッシュボード（1画面）

### 中央：Tree
- ノード = branch
- ノードに以下のバッジを表示
  - Issue
  - PR状態
  - CI状態
  - Review状態
  - 変更量（files / + / -）
  - assignee
  - labels
  - worktree

### 右ペイン（同画面内）
- 選択ノード詳細
  - Issue詳細
  - PR詳細
  - Restart Prompt
  - cd コマンド
  - 指示ログ追加

---

## 9. 設計ツリーと Git 実態の乖離検知

以下の場合は警告を出す：

- tree_specs の親子関係と merge-base 推定がズレている
- 親ブランチが更新され、子が追従していない
- 本来親に入るべき変更が子に直接入っている兆候

---

## 10. ツリー操作と Git / PR 同期

### UI 操作時の挙動

- ユーザーが Tree 上で親子関係を変更した場合：
  - 対応する Git 操作案を生成する
    - git rebase <new-parent>
    - gh pr edit <PR> --base <new-parent>
  - 原則は「提案」
  - 設定により自動実行も可

### 注意
- rebase によるコンフリクト
- PRレビューの無効化
- CI再実行

これらは事前に警告として明示する

---

## 11. Claude Code 実行モデル（重要）

- Claude Code は常駐しない
- 各実行は以下を入力として起動する
  - Plan
  - tree_specs
  - 最新 scan 結果
  - instructions_log の要約
- 同一セッションのように振る舞わせるが、
  実体は「状態再構築型」である

---

## 12. instructions_log

- Web UI から出た指示・判断はすべて記録
- 例外判断・失敗も含めて残す
- 将来的な分割戦略・注意点の学習材料とする

---

## 13. 実装チェックポイント

CP0: 既存 v3 が動く  
CP1: tree_specs CRUD  
CP2: gh api による Issue 構造取得  
CP3: Tree 1画面 UI  
CP4: Pattern A/B/C による初期ツリー生成  
CP5: 乖離警告  
CP6: Tree操作 → Git / PR 操作提案

---

## 14. 受け入れ条件

- 設定以外は Tree 画面で完結
- 既存 Issue からツリー戦略を立てられる
- Plan / Tree は後から変更可能
- 設計と実態のズレが可視化される
- Claude Code は毎回最新状態から再開できる
