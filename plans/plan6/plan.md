# Plan6: 「PTY/Xtermなし」でClaude対話をUIに統合する（APIブリッジ + 会話DB保存 + worktree単位セッション + ツリー設計UI）

## 0. このPlanで解決すること（あなたの要望をそのまま）
- ターミナルUI（xterm/PTY）は不要。**Web UIは普通のチャットUI**でOK
- Claude Codeとのやり取りは **APIブリッジ**で実現し、会話は **DBに保存**する
- 「セッションIDを毎回指定すればClaude側が自動でコンテキスト保持」みたいな幻想は捨てる  
  → **アプリ側でコンテキストを組み立てて渡す**（= 会話履歴/状態/差分をこちらが管理）
- セッションは repoで1個じゃなくて、**worktree（ディレクトリ）単位**で持つ
- 「ツリーを立てるUI」が分からない問題を解消するために、**設計ツリー作成フロー/UIを明示**する

---

## 1. 前提整理（超重要）
### 1.1 Claude Codeは“魔法のセッション維持API”ではない
- 「sessionIdを渡せば向こうが勝手に文脈保持」は基本できない（少なくとも現状のこのアプリ構成では）
- なので、会話の文脈維持は **アプリ側**でやる
  - DBに会話ログを保存
  - 次の指示を送るとき、必要な分だけ会話履歴/状態/差分をまとめて **毎回 prompt に再注入**する

### 1.2 stateless思想は維持
- Git/PR/Worktreeの“事実”は毎回scan（DBにブランチ状態を保存しない）
- DBに保存して良いのは:
  - 意図（plan / tree_specs）
  - 設定（repo_pins）
  - 会話ログ（chat_sessions / chat_messages）
  - 実行ログ（agent_runs）
  - “最後に渡した要約”などの圧縮情報（chat_summaries）

---

## 2. 全体像（データモデル）
### 2.1 Repo pins（毎回path指定しない）
- `repo_pins`
  - id, repo_id, local_path, label, last_used_at, created_at, updated_at

### 2.2 Worktree単位の「対話セッション」
- `chat_sessions`
  - id (uuid)
  - repo_id
  - worktree_path（=ディレクトリ。最重要）
  - branch_name（任意: scanから補完してもいい）
  - plan_id（任意）
  - status: active / archived
  - last_used_at
  - created_at, updated_at

- `chat_messages`
  - id
  - session_id
  - role: user / assistant / system
  - content (markdown)
  - created_at

### 2.3 会話圧縮（リフレッシュ/後で使わなくなったら軽量化）
- `chat_summaries`
  - id
  - session_id
  - summary_markdown（会話の要点、決定事項、未完タスク、注意点）
  - covered_until_message_id（ここまでを要約に含めた）
  - created_at

> 方針:
> - UI表示は chat_messages を使う
> - Claudeに渡す文脈は「直近N件 + 最新summary + 現在のscan要約 + plan要点」で構成する
> - 古いメッセージは archive/purge（後述）

### 2.4 実行ログ（Claude Codeを呼び出した記録）
- `agent_runs`
  - id
  - session_id
  - repo_id
  - worktree_path
  - input_prompt_digest（ハッシュでもOK）
  - started_at, finished_at
  - status: success / failed
  - stdout_snippet / stderr_snippet（必要最低限）
  - created_at

---

## 3. Claudeとの“APIブリッジ”方式（ターミナル操作なし）
### 3.1 基本コンセプト
- UIは「チャット送信」→ backend が **1回の“実行”としてClaude Codeを起動** → 返答をDB保存 → UIに返す
- 実行形態は2択（実装容易順）
  A) `claude -p "<prompt>"` のワンショット実行（推奨MVP）
  B) ClaudeのSDK/HTTP APIが使えるならそれに切替（将来）

※ここではAでいく（今のリポジトリの思想とCLI依存に揃う）

### 3.2 重要: こちらが「毎回promptを組む」
Claudeへのpromptは毎回この構造で生成する:

1) System: プロジェクトの固定ルール  
   - Branch naming rule（project_rules）
   - 「事実はscanで確認し、DBにGit状態を保存しない」等の方針
   - 作業対象 worktree_path / branch

2) Context: 現在の“事実”  
   - scanの要点（warnings / 現在ブランチ/PR/dirty/behindなど）
   - 必要なら差分（直近scanと前回scanの差分）※任意

3) Plan: planの要点  
   - planタイトル + goal（最低限）
   - （あれば）tree_specs要点

4) Memory: 会話履歴（圧縮）
   - 最新 summary_markdown（あれば）
   - 直近の chat_messages（例: 直近20件）

5) User: 今回のユーザー入力

→ これをまとめて `claude -p` に渡す  
→ Claudeの出力を “assistantメッセージ” としてDBに保存

---

## 4. API設計（backend）
### 4.1 Pins
- GET  `/api/repo-pins`
- POST `/api/repo-pins`（upsert）
- POST `/api/repo-pins/use`
- DELETE `/api/repo-pins/:id`

### 4.2 セッション（worktree単位）
- GET  `/api/chat/sessions?repoId=...`
- POST `/api/chat/sessions`
  - body: { repoId, worktreePath, planId? }
  - 既存があればそれを返す（repoId+worktreePathで一意）
- POST `/api/chat/sessions/archive`
  - body: { sessionId }
- GET  `/api/chat/messages?sessionId=...`
- POST `/api/chat/messages`
  - body: { sessionId, role, content }

### 4.3 送信（Claude実行）
- POST `/api/chat/send`
  - body: { sessionId, userMessage }
  - 処理:
    1) userMessage を chat_messages に保存（role=user）
    2) scanを実行（事実を最新化）
    3) promptを組み立てる（summary + 直近ログ + rules + scan要約 + plan要点 + userMessage）
    4) `claude -p "<prompt>"` を実行
    5) 出力を chat_messages に保存（role=assistant）
    6) agent_runs を保存（成功/失敗、stdout/snippet）
    7) 返却: { assistantMessage, updatedScan? }

※ UIはこの返却を受けて会話を表示し、必要なら scan結果も同時更新する

### 4.4 要約（リフレッシュ/軽量化）
- POST `/api/chat/summarize`
  - body: { sessionId }
  - 処理:
    - chat_messages の covered_until_message_id以降〜現在までを要約し summary_markdown を生成
    - 生成には Claude を使ってもいいし、単純なルールでも良い
    - 生成したら chat_summaries に保存
- POST `/api/chat/purge`
  - body: { sessionId, keepLastN: number }
  - 方針:
    - summaryがある前提で、古いchat_messagesを削除（もしくはarchivedフラグ）
    - UI表示も keepLastN だけにする（必要なら“もっと見る”で読み込む）

---

## 5. Frontend設計（UI/UX）
### 5.1 画面構成（最低限）
- 左: repo/localPath選択（pins）
- 左下 or サイド: worktree一覧（scan結果からworktreeを列挙）
- 中央: ツリー（既存）
- 右: 「設計ツリー」/「会話」タブ切替

### 5.2 “worktreeを選ぶと、そのworktreeのセッションが開く”
- worktreeクリック → `POST /api/chat/sessions`（repoId+worktreePath）
- `GET /api/chat/messages` を読み込み、チャット表示
- 入力欄から送信 → `/api/chat/send` → 返答表示

### 5.3 会話のリフレッシュ
- UIに「要約」ボタン
  - `/api/chat/summarize`
- UIに「軽量化」ボタン（または自動）
  - 例: 200メッセージ超えたら自動で要約→keepLastN=50でpurge

---

## 6. ツリーを立てるUI（設計ツリー作成フローを“分かる”ようにする）
### 6.1 まず“設計ツリー作成ウィザード”を追加
TreeDashboardに「設計ツリーを作る」導線を用意する（これが今無い/分からない問題）

#### Step 1: Planを選ぶ/作る
- planがなければ作成（テンプレ付与）
- planがあるならそれを選択

#### Step 2: 設計ツリーの作り方を選ぶ（3択）
A) 手動（MVP）
- UIで node を追加（タイトル/slug）
- 親を選ぶ（親子関係を作る）
- 保存 → `POST /api/tree-spec`

B) GitHub Issueから（次）
- issue番号やURLを入力
- 子issueを列挙して nodes/edgesを生成

C) 会話から生成（将来）
- 今までのchat/session summaryをもとに Claude が tree_specs を提案
- UIが承認して保存

### 6.2 MVPはA（手動）でいい
- “ツリーになってない”のは tree_specs が空だから
- なのでまず UIで tree_specs を作れるようにする（最短）
- 保存したら scan で「設計」バッジが付く & divergence warningが機能する

---

## 7. 実装順（あなたの不満を最短で潰す順）
1) repo_pins（path保持） + UI導線（毎回入力を終わらせる）
2) chat_sessions/chat_messages（worktree単位セッション） + chat UI表示
3) `/api/chat/send`（claude -p）で **UIから会話成立**（PTYなしで達成）
4) summarize/purge（会話をDB保存しつつリフレッシュ）
5) 設計ツリー作成ウィザード（手動MVP）→ tree_specs が作れる状態にする
6) （必要なら）Issue import / 会話からtree提案

---

## 8. Done Criteria（受け入れ条件）
- [ ] worktreeをクリックすると、そのworktreeのチャット履歴が出る
- [ ] UIから送信すると、Claudeの返答がUIに出る（PTYなしで成立）
- [ ] 会話がDBに保存され、リロードしても残る
- [ ] 会話が肥大化したら要約→古いログ削除で軽量化できる
- [ ] 設計ツリー作成ウィザードから nodes/edges を作って保存できる
- [ ] 保存後、ツリーに「設計」バッジが付き、divergence警告が機能する
- [ ] repo/localPathはpinsで保持され、毎回入力しない

---

## 9. 注意点（割り切り）
- Claude CodeをCLIワンショットで呼ぶ以上、「向こうが保持するセッション」は期待しない
  - 代わりにこちらが summary + 直近会話 + scan要約を再注入して “擬似的に継続会話” を作る
- 完全なリアルタイム双方向（逐次入力/逐次出力）はやらない（＝あなたの要望どおり）
  - ただし streaming でトークンをUIに流す拡張は後で可能（WSでchunk送信）

---

## 10. Implementation Notes

### 実装完了（2024-12）

#### 新規テーブル
1. **chat_sessions** - worktree単位のチャットセッション
   - id(uuid), repo_id, worktree_path, branch_name, plan_id, status, last_used_at, created_at, updated_at

2. **chat_messages** - 会話メッセージ
   - id, session_id, role(user/assistant/system), content, created_at

3. **chat_summaries** - 会話要約（軽量化用）
   - id, session_id, summary_markdown, covered_until_message_id, created_at

4. **agent_runs** - Claude実行ログ
   - id, session_id, repo_id, worktree_path, input_prompt_digest, started_at, finished_at, status, stdout_snippet, stderr_snippet

#### 新規API
- `GET /api/chat/sessions?repoId=...` - セッション一覧
- `POST /api/chat/sessions` - セッション作成/取得
- `POST /api/chat/sessions/archive` - セッションアーカイブ
- `GET /api/chat/messages?sessionId=...` - メッセージ一覧
- `POST /api/chat/send` - メッセージ送信（Claude実行）
- `POST /api/chat/summarize` - 会話要約
- `POST /api/chat/purge` - 古いメッセージ削除

#### フロントエンド
- TreeDashboardにChat UI追加
  - worktreeノードに「Chat」ボタン
  - フローティングチャットパネル（紫テーマ）
  - メッセージ送信・表示
  - WebSocketでリアルタイム更新
- 設計ツリー作成ウィザード追加
  - 「Edit Design Tree」ボタン
  - ノード追加/削除
  - 親子関係設定
  - 保存時に自動rescan

#### Done Criteria 達成状況
- [x] worktreeをクリックすると、そのworktreeのチャット履歴が出る
- [x] UIから送信すると、Claudeの返答がUIに出る（PTYなしで成立）
- [x] 会話がDBに保存され、リロードしても残る
- [x] 会話が肥大化したら要約→古いログ削除で軽量化できる
- [x] 設計ツリー作成ウィザードから nodes/edges を作って保存できる
- [x] 保存後、ツリーに「設計」バッジが付き、divergence警告が機能する
- [x] repo/localPathはpinsで保持され、毎回入力しない

