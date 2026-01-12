# E2E Testing Guide

このドキュメントでは、vibe-treeプロジェクトでE2Eテストを実行する際のシードデータの準備方法について説明します。

## シードデータの概要

E2Eテスト用のシードデータスクリプトは、実際のアプリケーション動作を模擬するための以下のテストデータを作成します：

### 作成されるデータ

1. **リポジトリピン** (`repo_pins`)
   - テスト用のリポジトリ情報

2. **プロジェクトルール** (`project_rules`)
   - ブランチ命名規則などのルール

3. **プランニングセッション** (`planning_sessions`)
   - タスクツリーのノードとエッジ

4. **プランとタスク** (`plans`, `plan_tasks`)
   - プラン「User Authentication」
   - 3つのタスク（todo, doing, done状態）

5. **チャットセッション** (`chat_sessions`)
   - ユーザーとアシスタントのチャット履歴

6. **外部リンク** (`external_links`)
   - NotionドキュメントとGitHub Issueへのリンク

7. **ブランチリンク** (`branch_links`)
   - PRのステータス、レビュー状況、チェック結果

8. **その他**
   - Worktreeアクティビティ
   - エージェントセッション
   - ターミナルセッション

## 使用方法

### 基本的な使い方

```bash
# シードデータを追加（既存データを保持）
bun run db:seed

# または
bun run scripts/seed-e2e.ts
```

### 既存データをクリアして再作成

```bash
# 既存データを削除してから新しいシードデータを作成
bun run db:seed:clean

# または
bun run scripts/seed-e2e.ts --clean
```

## E2Eテストフレームワークとの統合

### Playwright を使用する場合

将来的にPlaywrightを導入する場合、`playwright.config.ts`に以下のような設定を追加できます：

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  // グローバルセットアップ
  globalSetup: "./scripts/playwright-setup.ts",

  // その他の設定...
});
```

`scripts/playwright-setup.ts`:

```typescript
async function globalSetup() {
  // テスト実行前にシードデータを準備
  const { execSync } = await import("child_process");
  execSync("bun run db:seed:clean", { stdio: "inherit" });
}

export default globalSetup;
```

### Cypress を使用する場合

Cypressを使用する場合、`cypress/support/e2e.ts`に以下を追加：

```typescript
before(() => {
  // テストスイート開始前にシードデータを準備
  cy.exec("bun run db:seed:clean");
});
```

## データベースの確認

作成されたデータを確認するには、Drizzle Studioを使用できます：

```bash
bun run db:studio
```

ブラウザが開き、データベースの内容を確認・編集できます。

## シードデータのカスタマイズ

`scripts/seed-e2e.ts`を編集することで、テストに必要なデータを追加・変更できます。

### 新しいデータを追加する例

```typescript
// scripts/seed-e2e.ts の seedData() 関数内で

// 新しいプランを追加
await db.insert(schema.plans).values({
  repoId: "test-owner/test-repo",
  title: "新しいプラン",
  contentMd: "プランの内容...",
  status: "draft",
  createdAt: now,
  updatedAt: now,
});
```

## トラブルシューティング

### データベースがロックされている

```bash
# サーバーを停止してから実行
bun run db:seed:clean
```

### スクリプトがエラーで失敗する

```bash
# データベースを確認
bun run db:studio

# マイグレーションを実行
bun run db:push
```

## 参考情報

- データベーススキーマ: `src/db/schema.ts`
- Drizzle設定: `drizzle.config.ts`
- シードスクリプト: `scripts/seed-e2e.ts`

## 今後の拡張

- [ ] 環境変数でテスト用データベースパスを指定できるようにする
- [ ] シードデータのバリエーション追加（エラーケース、エッジケースなど）
- [ ] E2Eテストフレームワーク（Playwright/Cypress）の導入
- [ ] シードデータのスナップショットテスト
