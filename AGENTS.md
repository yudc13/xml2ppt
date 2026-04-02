# AGENTS.md

本文件用于约束在本仓库内工作的 AI/自动化代理行为。

## 项目基线
- Framework: Next.js `16.1.6`（App Router）
- Runtime: React `19.2.3`
- Language: TypeScript
- Styling: Tailwind CSS `v4`
- Lint: ESLint `v9` + `eslint-config-next@16`

## 目录约定
- `app/`: 路由、Layout、Loading、Error 页面（保持整洁，只放路由相关文件）。
- `components/ui/`: 原子级 UI 组件 (如 Button, Input, Card)。不需要改动
- `components/`: 自定义公共组件（如 Modal, Form, Table）。
- `features/`: 按功能模块划分的复杂组件、Hooks、Actions。
- `lib/`: 工具函数、数据库客户端 (Prisma/Drizzle)、第三方 SDK。
- `types/`: 全局共享的 TS 类型定义。
- `hooks/`: 通用的自定义 Hooks。
- `public/`: 静态资源

## 开发命令
- 安装依赖：`bun install`（优先）或 `npm install`
- 启动开发：`bun run dev` 或 `npm run dev`
- 代码检查：`bun run lint` 或 `npm run lint`
- 生产构建：`bun run build` 或 `npm run build`
- 生产启动：`bun run start` 或 `npm run start`

## 代码规范（Next.js 16）
- 优先使用 App Router 与 Server Components；仅在需要交互时添加 `"use client"`。
- 数据获取默认在服务端执行；避免在客户端重复请求同一数据。
- 新增页面/布局时，遵循 `app/**/page.tsx` 与 `app/**/layout.tsx` 约定。
- 仅在必要时引入第三方依赖；优先复用 `lib/` 与现有组件。
- TypeScript 保持严格类型，不使用 `any`（除非有明确理由并附注释）。
- 样式优先 Tailwind utility classes，避免无必要的全局样式污染。
- 变更应最小化且聚焦，不顺手重构无关代码。

## 变更流程
1. 先阅读相关文件与上下文，确认影响范围。
2. 实施最小可行修改，保持现有行为兼容。
3. 本地至少执行 `lint`；可运行时再执行 `build` 验证。
4. 输出变更摘要：改了什么、为什么、影响哪些文件。

## 禁止事项
- 未经明确要求，不修改无关文件。
- 未经确认，不做破坏性操作（如删除大量文件、重置 git 历史）。
- 不在代码中硬编码密钥、Token、私有地址。

## 审查规范（Review guidelines）
- 优先关注代码正确性、回归风险以及测试缺失问题。
- 不要报告纯粹的样式问题，除非它们会影响代码的可维护性。
- 对于 React 代码，重点关注：
  - hooks 依赖是否正确
  - 是否存在 stale closure（闭包陈旧问题）
  - 是否存在不必要的重复渲染（rerender）
- 对于异步流程，检查：
  - 是否正确处理取消（cancellation）
  - 是否有重试机制（retry）
  - loading / error 状态是否完整
- 对于共享状态，尽量保证订阅范围最小化，避免触发大范围重渲染。
- 对于公共 API 或数据结构（schema）的变更，需验证：
  - 向后兼容性
  - 是否提供迁移说明（migration notes）
- 禁止在日志中输出敏感信息（如密钥、token、用户隐私数据等）。
- 如果对某个问题的判断不确定，请明确说明不确定性，而不是臆测问题。

## 提交前检查清单
- 是否遵循 Next.js 16 + App Router 约定？
- 是否避免了不必要的客户端组件与客户端数据请求？
- 是否通过 `lint`（以及可选 `build`）？
- 是否更新了必要文档（若行为变化）？
