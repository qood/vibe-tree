# Plan5: Vibe Tree を「このUIで開発完結」させる（Claude Code対話UI + オーケストレーション + Repo保持）

## 0. ゴール（このPlanの到達点）
- ユーザーは **毎回 localPath を入力しない**
  - 最後に使った repo/localPath が自動復元され、ワンクリックで scan できる
- ユーザーは **Web UI上で Claude Code と会話しながら開発**できる
  - Claude の入出力（テキスト）が UI 上にストリーミング表示される
  - UI から指示を送れる（Enterで送信）
  - Claude セッションを UI から開始/停止/再接続できる
- 既存方針は維持する
  - Git/PR の「事実」は毎回 scan で取得（DBに保存しない）
  - DBには「意図」「設定」「ログ」だけ保存（plan / rules / pins / session meta / instructions_log）

---

## 1. 現状課題（Plan5で潰す）
1) ClaudeをUIから走らせても「会話」ができない（致命的）
2) Claudeのstdout/stderrがUIに出ない（何も起きてないように見える）
3) repo/localPath を毎回入れる必要がある（UX死んでる）
4) “再開プロンプト”があるのに、UIがClaudeセッションを持てないので活かしきれない

---

## 2. 方針（アーキテクチャの芯）
### 2.1 セッションの扱い
- 「Claude Codeの対話」は **サーバ側でPTY（擬似ターミナル）** を立てて実現する
  - サーバ: PTY上で `claude` を対話起動
  - UI: WSでターミナル出力を受け取り、入力を送る
- セッションは「長期メモリ」ではなく「接続情報」
  - 落ちても再接続できる（UI側のタブを閉じても）
  - ただし、永続化するのは「どのrepo/worktreeに紐づくか」「pid」「startedAt」等の最小情報のみ

### 2.2 statelessの維持
- Git/PR状態の真実はscan
- AIセッションは「開発を進める手段」であり、状態の真実はscan結果に寄せる
- Claudeの会話ログをDBに全保存は必須ではない（必要なら最後のN件だけ or 重要イベントのみ）

---

## 3. 実装スコープ（フェーズ分割）
Plan5は最短で価値を出すために 2フェーズで実装する。

### Phase 1: “見える化”と“保持”（会話UIは簡易でもOK）
- repo/localPath保持（必須）
- ClaudeをUIから起動して **stdout/stderrをUIにストリーミング**（まずログが見える）
- セッション開始/停止をUIからできる
- heartbeat更新で active 表示を成立させる
- 終了時に自動scan

### Phase 2: “対話”の完成（PTY + 入力送信 + 再接続）
- PTY経由の対話（UIから入力 → Claudeに送る）
- UIのチャット/ターミナルコンポーネントを整備
- セッション再接続（既存のpid/sessionIdで復帰）
- 再開プロンプトは「初回起動時に自動投入」または「ボタンで投入」

---

## 4. 仕様（具体）
### 4.1 Repo/localPath保持（Pins）
- 新テーブル `repo_pins`
  - id, repo_id, local_path, label(optional), last_used_at, created_at, updated_at
- API
  - GET  `/api/repo-pins`            : pins一覧（last_used_at desc）
  - POST `/api/repo-pins`            : upsert（repo_id + local_path）
  - POST `/api/repo-pins/use`        : 指定pinをlast_used更新 & “現在選択”扱い
  - DELETE `/api/repo-pins/:id`      : 削除
- UI
  - TreeDashboard上部に「pin選択プルダウン」
  - 最後に使ったpinを自動選択
  - “新規追加”でlocalPath入力→保存→即scan

### 4.2 Claudeセッション（Agent Session）
- 新テーブル（最小でOK） `agent_sessions`
  - id (uuid), repo_id, worktree_path, branch(optional), status(running/stopped/exited),
    pid, started_at, last_seen_at, ended_at(optional), exit_code(optional)
- 原則、1 repo に 0〜1 running を許す（MVP）
- heartbeatファイル `.vibetree/heartbeat.json`
  - agent: "claude"
  - pid
  - updatedAt (ISO8601)
- active判定は既存scanの “更新が30秒以内” を踏襲

---

## 5. Backend実装（詳細）
### 5.1 追加ルート
- `src/server/routes/repoPins.ts`（新規）
- `src/server/routes/agent.ts`（新規）
- `src/server/index.ts` でマウント

### 5.2 Agent: Phase 1（非対話 / ログストリーミング）
- POST `/api/agent/start`
  - body: { repoId, worktreePath(or localPath), planId? }
  - 処理:
    1) 現在のplan/rules/scan要約を基に “初期投入プロンプト” を生成
       - 既存 restart prompt生成処理を共通化して再利用する
    2) `cd worktreePath && claude -p "<prompt>"` を spawn
    3) stdout/stderr を読み、WSで `agent.output` イベントとしてUIへ送る
    4) heartbeat updater を同時起動（5秒ごと更新）
    5) agent_sessions に running を記録
    6) `instructions_log` に system_note（started）を記録
- POST `/api/agent/stop`
  - running session の pid を kill
  - heartbeat updater を停止
  - agent_sessions を stopped
  - `instructions_log` に system_note（stopped）
- Claudeプロセスexit時
  - heartbeat停止
  - agent_sessions を exited/exit_code更新
  - `instructions_log` に system_note（finished）
  - WS: `agent.finished`
  - 可能ならサーバ側で “scan” をトリガーして `scan.updated` を飛ばす（UIの自動更新）

### 5.3 Agent: Phase 2（PTY対話 / 再接続）
- 依存追加（Node側でPTYを扱える仕組み）
  - 例: `node-pty`（Bunで扱えるか要検証。無理なら Nodeランタイムをbackendに寄せるか、PTY部分だけ別プロセス）
- POST `/api/agent/start-interactive`
  - body: { repoId, worktreePath, planId? }
  - `node-pty` で `claude` を対話起動
  - 生成した sessionId を返す
  - WSで `agent.session.started` を通知
- WS: `agent.session.attach`
  - UIが sessionId を指定して attach
  - サーバはそのPTY出力を流し続ける
- WS: `agent.session.input`
  - UIが入力文字列（or キーイベント）を送信
  - サーバがPTYへwrite
- 再接続
  - agent_sessions に sessionId/pid があるので、UIが再attachできる

---

## 6. Frontend実装（詳細）
### 6.1 Repo pins UI
- TreeDashboardに pin選択UIを追加
- 初期ロード時に `/api/repo-pins` を呼び、last_used を選択
- 選択→scan をワンクリックで実行

### 6.2 Agentログビュー（Phase 1）
- TreeDashboardに “Agent Console” パネルを追加
  - 受け取った `agent.output` を時系列で表示（prependでもappendでも）
  - started/finished/stopped をUIで表示
  - “Run Claude” “Stop Claude” ボタン
- finished時に自動scan

### 6.3 対話UI（Phase 2）
- 2案:
  1) ターミナルUI（xterm.js等）を埋め込む（Claude Codeはターミナル前提なので相性良い）
  2) チャットUI（入力欄 + ストリーム表示）に寄せる（ただしClaude Codeの表示がターミナル前提なら崩れる可能性）
- まずは 1) を推奨
- session attach / input をWSでつなぐ

---

## 7. セキュリティ・安全性（必須）
- worktreePath/localPath は “任意コマンド実行”に近いので制限する
  - repo_pins に登録済みのパスのみ許可（MVP）
  - `realpath` で解決し、許可ディレクトリ配下のみ許可（例: `~/src` 以下）
- `claude` コマンドの存在チェック
- 失敗時メッセージをUIへ明確に返す（コマンド無し/ログイン必要/権限不足 等）
- 出力のログに機密を残しすぎない（必要ならマスク）

---

## 8. Done Criteria（受け入れ条件）
- [ ] repo/localPath を一度登録したら、次回以降は選ぶだけでscanできる
- [ ] UIから “Run Claude” でClaudeが起動し、UIに出力が流れる
- [ ] heartbeatが更新され、ツリー上に active が付く
- [ ] Claude終了で active が消え、UIが自動scanしてブランチ/PR差分が反映される
- [ ] Phase 2完了後: UI上でClaudeに入力でき、Claudeの返答がリアルタイムに見える（会話成立）
- [ ] `instructions_log` に started/stopped/finished が残る

---

## 9. 実装順（最短）
1) repo_pins（保持）を入れる（まずUXを成立）
2) agent start（ワンショット）+ stdout/stderrストリーム + heartbeat
3) agent stop + finished時自動scan
4) PTY方式の検証 → interactive start/attach/input 実装
5) xterm.js（or簡易ターミナル）で対話UIを完成

---

## 10. 補足：このPlanが解決すること
- 「このアプリ何もできない」→ まず "ログが見える" ので動いてる/止まってるが分かる
- 「Claudeと会話できない」→ Phase 2で解消（PTY対話）
- 「毎回path指定」→ pinsで解消
- 「stateless方針が崩れる」→ 事実はscan、DBは意図/設定/ログのみで維持

---

## 11. Implementation Notes

### Phase 1 完了（2024-12）

#### 実装済み機能
1. **repo_pins**（plan4で実装済み）
   - テーブル追加、CRUD API、TreeDashboard UIに統合

2. **agent_sessions テーブル**
   - `src/db/schema.ts` に追加
   - フィールド: id(uuid), repo_id, worktree_path, branch, status, pid, started_at, last_seen_at, ended_at, exit_code

3. **stdout/stderr ストリーミング**
   - `src/server/routes/ai.ts` を更新
   - セッションIDベースの管理に変更
   - stdout/stderr を WS `agent.output` イベントでブロードキャスト
   - セッション状態を DB に保存・更新

4. **Agent Console UI**
   - `frontend/src/pages/TreeDashboard.tsx` に追加
   - ダークテーマのターミナル風パネル
   - stdout（白）/ stderr（赤）の色分け表示
   - 自動スクロール
   - Show/Hide/Clear ボタン

5. **WebSocket イベント**
   - `agent.output`: リアルタイム出力ストリーミング
   - `agent.started`, `agent.finished`, `agent.stopped`: ライフサイクルイベント

#### API エンドポイント
- `POST /api/ai/start`: セッション開始（sessionId, pid, repoId等を返す）
- `POST /api/ai/stop`: セッション停止
- `GET /api/ai/status`: 実行中セッション一覧
- `GET /api/ai/sessions`: 全セッション履歴（repoIdでフィルタ可）

#### Done Criteria 達成状況
- [x] repo/localPath を一度登録したら、次回以降は選ぶだけでscanできる
- [x] UIから "Run Claude" でClaudeが起動し、UIに出力が流れる
- [x] heartbeatが更新され、ツリー上に active が付く
- [x] Claude終了で active が消え、UIが自動scanしてブランチ/PR差分が反映される
- [ ] Phase 2完了後: UI上でClaudeに入力でき、Claudeの返答がリアルタイムに見える（会話成立）
- [x] `instructions_log` に started/stopped/finished が残る

### Phase 2（未実装）
- PTY対話（node-pty等）
- xterm.js ターミナルUI
- セッション再接続機能
