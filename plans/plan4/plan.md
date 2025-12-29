# Plan 4: UI Claude起動 & Repo保持

## 目的

1. ローカルWeb UIから **Claude Code を起動・監視・停止** できるようにする
2. repo を一度 scan/選択したら **保持** して、毎回 localPath 入力・指定しなくて済むようにする

## 設計原則

- **Stateless First**: Git/PR情報など「事実」は今まで通り **毎回 scan で取得** する（DB に保存しない）
- **意図のみ DB 保存**: plans / project_rules / instructions_log / tree_specs / repo_pins は「意図/設定」なので DB 保存 OK
- 既存の Restart Prompt/heartbeat の思想を活かす

---

## 実装内容

### A. Repo Pins（保存されたリポジトリ/パス）

#### テーブル: `repo_pins`

```sql
CREATE TABLE repo_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id TEXT NOT NULL,        -- owner/name format
    local_path TEXT NOT NULL UNIQUE,
    label TEXT,                   -- optional display name
    last_used_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

#### API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/repo-pins` | 保存済み repo 一覧（lastUsedAt desc） |
| POST | `/api/repo-pins` | 新規追加（localPath から repoId 自動検出） |
| POST | `/api/repo-pins/use` | last_used_at 更新 |
| DELETE | `/api/repo-pins/:id` | 削除 |

#### フロント UX

- TreeDashboard に dropdown で保存済み repo を表示
- 「+ Add new repo...」で新規パス入力
- 選択したら即 scan 実行
- 画面リロードしても最後に使った repo を復元

---

### B. AI Agent 起動

#### API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/ai/start` | Claude を起動 |
| POST | `/api/ai/stop` | Claude を停止 |
| GET | `/api/ai/status` | 実行中エージェント一覧 |

#### `POST /api/ai/start`

Request:
```json
{
  "localPath": "/path/to/repo",
  "planId": 123,       // optional
  "branch": "feature/x" // optional
}
```

Response:
```json
{
  "status": "started",
  "pid": 12345,
  "repoId": "owner/repo",
  "startedAt": "2025-12-30T00:00:00Z",
  "localPath": "/path/to/repo"
}
```

#### 起動方式

1. `cd <localPath> && claude -p "<prompt>"` を spawn
2. prompt には以下を含む:
   - Branch Naming Convention（pattern + examples）
   - Current Plan（title + content）
   - Git Status（working directory の状態）

---

### C. Heartbeat

#### ファイルパス

```
<localPath>/.vibetree/heartbeat.json
```

#### フォーマット

```json
{
  "agent": "claude",
  "pid": 12345,
  "updatedAt": "2025-12-30T00:00:00+09:00"
}
```

#### 更新間隔

- 5 秒ごとに `updatedAt` を更新
- claude プロセス終了時に heartbeat ファイルを削除

#### Active 判定

- scan 時に heartbeat.json を読む
- `updatedAt` が 30 秒以内なら active とみなす

---

### D. WebSocket イベント

| Type | Data | 説明 |
|------|------|------|
| `agent.started` | `{ pid, repoId, localPath, startedAt }` | Claude 起動時 |
| `agent.finished` | `{ pid, exitCode, finishedAt }` | Claude 終了時 |
| `agent.stopped` | `{ pid, stoppedAt }` | 手動停止時 |

UI はこれを受けて:
- Running... 表示
- 終了時に自動 scan

---

### E. Instructions Log 連携

- `ai/start` 時: system_note を記録（「UI から Claude 開始」）
- `ai/finished` 時: system_note を記録（「Claude 終了 exit code X」）
- エラー時: stderr の要点を記録

---

## 失敗時の挙動

| 状況 | 挙動 |
|------|------|
| claude コマンドが無い | エラー: "Failed to start Claude process" |
| パスが存在しない | エラー: "Local path does not exist: ..." |
| GitHub repo ではない | エラー: "Could not detect GitHub repo at: ..." |
| 権限不足 | spawn エラーをキャッチして WS 通知 |

---

## セキュリティ考慮

- localPath は `expandTilde()` で正規化
- `existsSync()` でパス存在確認
- `getRepoId()` で GitHub repo であることを確認
- 任意コマンド実行ではなく `claude -p` 固定

---

## ファイル構成

```
src/
├── server/
│   ├── routes/
│   │   ├── ai.ts          # NEW: AI agent start/stop
│   │   └── repo-pins.ts   # NEW: Saved repos
│   └── utils.ts           # NEW: expandTilde, getRepoId
├── db/
│   └── schema.ts          # ADD: repoPins table
└── shared/
    ├── types.ts           # ADD: RepoPin, AgentStatus, WSMessageType
    └── validation.ts      # ADD: schemas

frontend/src/
├── pages/
│   └── TreeDashboard.tsx  # UPDATE: repo selector, Run Claude button
└── lib/
    └── api.ts             # ADD: repo-pins, ai APIs
```

---

## 完了条件

- [x] UI で repo/localPath を一度登録したら、次回以降は選ぶだけで scan できる
- [x] UI で「Run Claude」を押すと claude が起動し、active が付く
- [x] claude が終了したら active が消え、UI が自動 scan して結果が反映される
- [x] `plans/plan4` が追加され、上記設計が文章化されている
