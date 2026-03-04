# 用户认证（Clerk）Task List

## 1. 目标与范围
本期目标：基于 `@clerk/nextjs` 完成 Next.js App Router 项目的认证闭环，并接入本地数据库用户同步。

包含：
- 登录、注册、登出
- 全站路由保护（除登录/注册页）
- API 路由保护（除 Clerk Webhook）
- 自定义登录/注册 UI（美观）
- Clerk 用户通过 Webhook 同步到本地数据库（Drizzle）

不包含：
- RBAC/角色权限
- 域名邮箱限制
- 多环境配置清单

## 2. 关键约束
- 公开页面仅：`/sign-in`、`/sign-up`
- 其余页面默认受保护
- `app/api/**` 默认受保护，仅放行 Clerk Webhook 路由
- 登录方式仅开启：`Google`、`GitHub`
- 登录成功默认跳转：`/`
- 未登录访问受保护资源后，登录完成返回原目标页

## 3. 实施任务清单

### Phase 0: 现状梳理与配置准备
- [x] 确认 `@clerk/nextjs` 版本与 Next.js 16 兼容
- [x] 补充并校验环境变量：`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`、`CLERK_SECRET_KEY`、`CLERK_WEBHOOK_SECRET`
- [ ] 确认 OAuth Provider（Google/GitHub）在 Clerk Dashboard 已启用

### Phase 1: Clerk 基础接入
- [x] 在根布局接入 `ClerkProvider`
- [x] 新增 `middleware.ts`，通过 `clerkMiddleware` 实现路由分组保护
- [x] 配置 matcher：覆盖页面路由与 `app/api/**`，排除静态资源与公开路由

### Phase 2: 认证页面（自定义 UI）
- [x] 新增 `/sign-in` 页面，接入 Clerk 登录组件能力并使用自定义样式
- [x] 新增 `/sign-up` 页面，接入 Clerk 注册组件能力并使用自定义样式
- [x] 登录/注册页实现统一视觉语言（排版、配色、响应式）
- [x] 顶部或用户入口区接入 `UserButton`（含登出）

### Phase 3: 跳转与访问行为
- [x] 设置默认登录后跳转到 `/`
- [x] 未登录访问受保护页时保留 return URL，登录后回跳原目标页
- [ ] 校验 direct access、刷新、深链三类场景跳转行为

### Phase 4: 数据库与用户模型（Drizzle）
- [x] 新建本地 `users` 表（最小字段：`id`、`clerk_user_id`、`email`、`name`、`avatar_url`、`created_at`、`updated_at`）
- [x] 为 `clerk_user_id` 建唯一索引
- [ ] 生成并执行 Drizzle migration（已生成 `migrations/0003_users.sql`，待执行）

### Phase 5: Webhook 用户同步
- [x] 新增公开 webhook 路由（建议：`/api/webhooks/clerk`）
- [x] 校验 Clerk webhook 签名（`CLERK_WEBHOOK_SECRET`）
- [x] 处理事件：`user.created`、`user.updated`、`user.deleted`
- [x] 同步策略：upsert 用户信息；删除事件执行软删或硬删（按当前项目策略）
- [x] 增加幂等处理与错误日志，避免重复事件导致脏数据

### Phase 6: API 保护策略落地
- [x] 为 `app/api/**` 默认启用鉴权校验
- [x] 对 webhook 路由做显式放行
- [ ] 验证未授权请求返回预期状态码（401/redirect）

### Phase 7: 质量检查与验收
- [ ] 执行 `bun run lint`（或 `npm run lint`）并通过
- [ ] 关键流程手测：
- [ ] 未登录访问受保护页 -> 跳转登录 -> 登录后回原页
- [ ] 正常登录 -> 跳转 `/`
- [ ] 登出后访问受保护页 -> 重新鉴权
- [ ] Clerk 用户创建/更新/删除后，本地 `users` 表同步正确

## 4. 验收标准（Definition of Done）
- [ ] `/sign-in` 与 `/sign-up` 为公开路由，其余页面受保护
- [ ] `app/api/**` 默认受保护，webhook 例外
- [ ] 仅可通过 Google/GitHub 登录
- [ ] 登录后默认到 `/`，且支持回跳原目标页
- [ ] 登录/注册 UI 为自定义且移动端可用
- [ ] `users` 表存在并可通过 webhook 实时同步
- [ ] Lint 通过且核心流程手测通过

## 5. 文件级执行清单（建议）
- [ ] [`app/layout.tsx`](/Users/yudachao/Projects/ydc/ppt/app/layout.tsx)：接入 `ClerkProvider`
- [ ] [`middleware.ts`](/Users/yudachao/Projects/ydc/ppt/middleware.ts)：`clerkMiddleware` 路由保护与 matcher
- [ ] [`app/sign-in/page.tsx`](/Users/yudachao/Projects/ydc/ppt/app/sign-in/page.tsx)：自定义登录页
- [ ] [`app/sign-up/page.tsx`](/Users/yudachao/Projects/ydc/ppt/app/sign-up/page.tsx)：自定义注册页
- [ ] [`app/api/webhooks/clerk/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/webhooks/clerk/route.ts)：Webhook 校验与同步逻辑
- [ ] [`lib/db/schema.ts`](/Users/yudachao/Projects/ydc/ppt/lib/db/schema.ts)：新增 `users` 表定义
- [ ] [`migrations/*`](/Users/yudachao/Projects/ydc/ppt/migrations)：新增 users 表迁移
- [ ] [`.env.example`](/Users/yudachao/Projects/ydc/ppt/.env.example)：补充 Clerk 环境变量示例
- [ ] [`README.md`](/Users/yudachao/Projects/ydc/ppt/README.md)：补充认证与 webhook 本地开发说明
