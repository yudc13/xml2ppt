# Next.js 16 RSC + Features 架构规范

## 目标
- `app/**` 仅保留路由层职责，默认使用 Server Components。
- 客户端交互模块统一下沉到 `features/**`。
- 客户端 API 调用统一通过 hooks（`@tanstack/react-query`）收敛。
- 目录命名与业务模块、路由语义保持一致。

## 分层规则

### 1. 路由层（`app/**`）
- 只放 `page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`、`not-found.tsx`。
- 不在 `app/**` 写业务状态逻辑，不新增 `"use client"`。
- 允许引入 `features/**` 的 Client Component 作为交互边界。

### 2. 功能层（`features/**`）
- 每个业务域按目录组织：`components`、`hooks`、`server`、`types`。
- `components`：业务组件（可 Server/Client）。
- `hooks`：客户端 API 调用、缓存与 mutation。
- `server`：服务端查询与组装逻辑（供 `app/**` 调用）。
- `types`：该业务域共享类型。

### 3. 通用层
- `components/ui/**`：原子 UI 组件，不承载业务语义。
- `components/**`：仅保留跨域复用、无业务语义的通用组件。
- `lib/**`：数据库、SDK、底层工具函数。

## 数据流约定
- 首屏/SEO 关键数据：在 `app/**` 通过 `features/*/server` 获取。
- 客户端交互数据：在 `features/*/hooks` 中用 React Query 调用 API。
- 写操作后通过本地状态更新或查询失效机制保持一致性。

## 当前落地（2026-03-04）
- 列表页：
  - `app/page.tsx` 改为服务端入口。
  - 客户端交互迁移到 `features/deck-list/components/deck-list-client.tsx`。
  - API 调用迁移到 `features/deck-list/hooks/use-deck-list.ts`。
- 编辑页：
  - `app/decks/[deckId]/page.tsx` 改为服务端入口。
  - 客户端编辑器迁移到 `features/deck-editor/components/deck-editor-client.tsx`。
  - 编辑器相关客户端组件迁移到 `features/deck-editor/components/*`。
  - API 调用迁移到 `features/deck-editor/hooks/use-deck-editor-api.ts`。
- 全局：
  - 新增 `QueryProvider` 并接入 `app/layout.tsx`。

## 迁移准则（后续新增路由）
1. 先建 `features/<domain>/server`，完成服务端首屏数据。
2. 再建 `features/<domain>/hooks`，封装客户端 API 调用。
3. 最后在 `app/**/page.tsx` 仅做参数解析与组件组装。

## 不做项
- 当前阶段不强制引入 tRPC，先统一为 React Query + Route Handlers。
- 如后续引入 tRPC，保持 hooks API 不变，仅替换 hooks 内部实现。
