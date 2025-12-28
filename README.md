# Vibe Tree

Git ブランチ/PR/Worktree の状態を可視化・管理するローカルWebアプリ。

## セットアップ

```bash
# 依存関係インストール
bun install && cd frontend && bun install && cd ..

# データベース初期化 (初回のみ)
bun run db:push
```

> DBリセットしたい場合: `rm -rf data/ && bun run db:push`

## 起動

```bash
bun run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## テスト

```bash
bun run test:all
```

## 技術スタック

- **Backend**: Bun, Hono, Drizzle ORM, SQLite, WebSocket
- **Frontend**: React, TypeScript, Vite
