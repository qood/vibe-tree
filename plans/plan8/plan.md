# 指示書: ターミナル(PTY)経由でClaude CodeにWeb UIからアクセスできるようにする（vibe-tree路線）

## ゴール
- Web UI上で、worktreeごとの「ターミナルセッション」を開ける
- そのターミナルで `claude` を起動し、以降はそのセッションを継続利用できる
- 出力はリアルタイムにUIへ流し、入力もUIから送れる
- セッションはDBで管理し、再接続できる（サーバ再起動時の扱いはMVPでは割り切り可）

---

## 優先度S（MVPで絶対やる）

### 1) PTYセッション管理（サーバ側）
- `pty` を使って疑似端末プロセスを生成し、worktree単位で保持する
  - Node/Bun環境なら `node-pty` が定番（Bunで難しければ Node サーバに分離してもOK）
- セッションは `worktree_path` をキーに一意にする
- DBテーブル（既存が近いなら流用OK）:
  - `terminal_sessions`
    - id (uuid)
    - repo_id
    - worktree_path
    - pid
    - status: running / stopped
    - created_at / updated_at / last_used_at

#### API（HTTP）
- `POST /api/term/sessions`  (upsert)
  - body: { repoId, worktreePath }
  - 既存セッションがあれば返す
- `POST /api/term/sessions/:id/start`
  - PTY生成（shell起動）して pid 保存、status=running
- `POST /api/term/sessions/:id/stop`
  - PTY kill、status=stopped

#### 通信（WebSocket）
- `WS /ws/term?sessionId=...`
  - サーバ → クライアント: data(chunk)
  - クライアント → サーバ: input(text) / resize(cols, rows)

### 2) Web UI（ターミナル表示）
- xterm.js などでターミナルを表示
- WS接続して
  - 受信chunkをターミナルに書く
  - キー入力をサーバへ送る
  - リサイズも送る

### 3) Claude Code起動ボタン（UI）
- worktree選択時の「Claude Codeを起動」ボタンを追加
- 押したら「そのPTYセッション」に対して `claude` コマンドを流す（2択）

#### 方式A（簡単）
- UIから「入力」として `claude` + オプションをターミナルに送る
  - 例: `claude` / `claude --help` / `claude -p "..."` など

#### 方式B（より制御）
- `POST /api/term/sessions/:id/run`
  - body: { command: "claude", args: [...] }
- サーバがPTYへ書き込む or PTY内で実行（MVPはAでいい）

---

## 優先度A（できると「開発に使える」）

### 4) worktreeとセッションの結びつきをUIで明確化
- ノード（タスク）選択 → 対応worktree → そのworktreeのターミナルタブが開く
- ターミナルの上部に必ず表示:
  - worktree_path
  - branch名
  - セッション状態（running/stopped）

### 5) ログ保存（必要最低限）
- ターミナル出力を全部DB保存すると重いのでMVPはこうする：
  - `terminal_logs` に「一定サイズのリングバッファ」だけ保存
  - もしくは「最後のN KB」だけ保存
- 目的は「再接続時に直近ログが見える」こと

---

## 優先度B（後回しでOK）

### 6) サーバ再起動耐性
- PTYは再起動で消えるので、MVPでは
  - 再起動後はstatusをstoppedにして「再開」ボタンを出す
- 将来:
  - tmux/screen を裏で使って永続化（ただしユーザーはtmux嫌いなので、内部実装としてだけ使うなら可）
  - もしくは別デーモンにセッションを持たせる

### 7) セキュリティ/制限（最低限）
- 起動できるコマンドを allowlist（claude/git/npm/bundle程度）
- worktree外に `cd` できないようにしたいなら、shell起動時に cwd 固定 + コマンド検査（MVPは緩くても可）

---

## Done（受け入れ条件）
- UIでworktreeを選ぶ→「Terminal」タブでPTYが開く
- そこで `claude` が起動でき、会話/実行ログが流れる
- セッションを閉じても再度開けば同じPTYに再接続できる（サーバ再起動はMVPでは例外）
- developしかないrepoでもbase branch選択が破綻しない（別問題として残っていたら同時に直す）
