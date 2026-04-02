# PPT XML Editor

一个基于 Next.js 16 的 Web 演示文稿编辑器。项目围绕“Slide XML 可视化编辑”展开：把幻灯片 XML 解析成可交互画布，在浏览器中完成编辑后再序列化回 XML，并结合 PostgreSQL 完成持久化、版本管理、评论协作与分享。

## 项目亮点

- XML round-trip 编辑链路：`XML -> 可编辑模型 -> HTML 画布 -> XML`
- 幻灯片编辑能力：拖拽、缩放、旋转、文本编辑、图形/表格插入、图层调整
- 文稿工作台：最近文稿、模板入口、个人中心
- 模板建稿：从系统模板快速生成新文稿
- 历史版本：版本列表、版本预览、回滚、差异查看
- 协作能力：分享链接、评论、评论汇总
- 导出能力：支持导出 PDF 与 PPTX
- AI 辅助：支持生成内容与局部编辑
- 鉴权与可观测性：Clerk 登录、Webhook 同步、Sentry 集成

## 技术栈

- Framework: Next.js `16.1.6`（App Router）
- Runtime: React `19.2.3`
- Language: TypeScript
- Styling: Tailwind CSS `v4`
- State: Zustand + TanStack Query
- Database: PostgreSQL + Drizzle ORM
- Auth: Clerk
- XML: fast-xml-parser
- AI: Google Generative AI
- Export: `pptxgenjs` + `jspdf`
- Package Manager: Bun（优先）

## 功能概览

### 1. 编辑器主链路

1. `parseSlideXml(xml)` 解析 XML，输出标准化的幻灯片模型
2. `features/slide-editor/store` 将模型映射到编辑态
3. 画布中完成文本、形状、表格和布局交互
4. `serializeSlideDocument(model)` 将编辑结果序列化回 XML
5. 调用 API 保存至数据库，并写入版本记录

### 2. 主要页面

- `/`：工作台首页，展示最近文稿与模板入口
- `/decks/[deckId]`：演示文稿编辑器
- `/templates`：模板中心
- `/me`：个人中心
- `/share/[token]`：通过分享链接进入文稿

### 3. 主要 API

- `GET /api/decks`：文稿列表
- `POST /api/decks`：新建文稿
- `GET /api/decks/:deckId`：文稿详情
- `PATCH /api/decks/:deckId`：更新文稿标题
- `GET /api/decks/:deckId/slides`：幻灯片列表
- `POST /api/decks/:deckId/slides`：新增幻灯片
- `PATCH /api/slides/:slideId`：保存幻灯片
- `GET /api/slides/:slideId/revisions`：版本列表
- `GET /api/slides/:slideId/revisions/:version`：版本详情
- `POST /api/slides/:slideId/rollback`：版本回滚
- `GET /api/decks/:deckId/comments`：评论列表或汇总
- `POST /api/decks/:deckId/comments`：创建评论
- `POST /api/decks/:deckId/share-links`：创建分享链接
- `GET /api/decks/:deckId/share-links`：获取分享链接
- `POST /api/ai/generate`：AI 生成
- `POST /api/ai/edit`：AI 编辑
- `POST /api/webhooks/clerk`：同步 Clerk 用户事件

统一错误响应结构：

```json
{
  "ok": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

## 目录结构

```txt
app/                  路由、Layout、页面、Route Handlers
components/           公共组件
components/ui/        原子级 UI 组件
features/             按业务拆分的模块
hooks/                通用 Hooks
lib/                  底层能力、数据库、鉴权、XML、AI
public/               静态资源
scripts/              本地脚本与冒烟脚本
types/                全局共享类型
docs/                 设计文档、任务拆解与实现计划
```

当前代码分层约定：

- `app/**` 只放路由与首屏数据组织
- `features/**` 负责业务组件、hooks、server 逻辑
- `components/ui/**` 保持无业务语义
- `lib/**` 负责数据库、工具函数、解析/序列化等基础设施

## 快速开始

### 1. 安装依赖

```bash
bun install
```

也可以使用：

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`：

```bash
cp .env.example .env.local
```

最小可用配置：

```bash
DATABASE_URL=postgres://<user>:<password>@<host>/<database>?sslmode=require
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
```

按需启用的可选配置：

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
SHARE_LINK_SECRET=replace_with_a_random_secret
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=https://<public_key>@o<org_id>.ingest.us.sentry.io/<project_id>
SENTRY_DSN=https://<public_key>@o<org_id>.ingest.us.sentry.io/<project_id>
SENTRY_ORG=your_org
SENTRY_PROJECT=your_project
SENTRY_AUTH_TOKEN=for_ci_only
```

说明：

- `GOOGLE_GENERATIVE_AI_API_KEY` 用于 AI 生成与 AI 编辑接口
- `NEXT_PUBLIC_APP_URL` 用于生成可分享链接
- `APP_BASE_URL` 用于执行 `api:smoke`
- `SHARE_LINK_SECRET` 未配置时会回退到 `CLERK_SECRET_KEY`

### 3. 配置 Clerk

在 Clerk Dashboard 中：

- 启用 `Google` 和 `GitHub` 登录方式
- 配置 webhook 指向 `POST /api/webhooks/clerk`
- 本地开发时确保 Clerk 应用域名与本地回调配置一致

### 4. 执行数据库迁移

```bash
bun run db:migrate
```

### 5. 启动开发环境

```bash
bun run dev
```

默认访问地址：

- [http://localhost:3000](http://localhost:3000)

## 常用命令

```bash
bun run dev        # 启动开发环境
bun run lint       # ESLint 检查
bun run build      # 生产构建
bun run start      # 启动生产服务
bun run db:migrate # 执行数据库迁移
bun run db:studio  # 打开 Drizzle Studio
bun run api:smoke  # API 冒烟测试（需 dev server 已启动）
```

## 数据模型

- `users`：本地用户信息，与 Clerk 用户同步
- `decks`：演示文稿
- `slides`：演示文稿下的幻灯片
- `slide_revisions`：幻灯片历史版本
- `deck_share_link`：分享链接
- `deck_member`：协作成员与权限
- `comment`：评论与评论回复
- `templates`：模板数据

可以重点关注：

- 幻灯片版本：`unique(slide_id, version)`
- 幻灯片顺序：`unique(deck_id, position)`
- 分享能力：基于 token hash 与访问权限
- 评论能力：支持按 deck / slide / shape 维度组织

## 开发建议

- 优先使用 Server Components，只有交互场景才添加 `"use client"`
- 数据获取尽量放在服务端，避免客户端重复请求
- 尽量复用 `features/`、`lib/` 和现有 UI 组件
- 变更保持最小范围，不顺手重构无关内容

## PR 自测建议

如果你准备测试完整 PR 流程，这个 README 变更可以配合下面的检查点一起验证：

1. 文档预览是否正常，Markdown 标题、代码块、列表是否渲染正确
2. README 描述是否和当前仓库能力一致，尤其是分享、评论、AI、导出
3. 按 README 执行本地启动流程时，是否能成功完成安装、迁移、启动
4. Reviewer 是否能快速理解项目做什么、怎么跑、应该从哪里开始看代码
5. PR 描述里可以把这次提交归类为 `docs`，验证 review、merge、通知等流程

## 已知限制

- 暂未支持多人实时协同编辑
- 版本 diff 仍以当前实现为准，复杂场景仍需要继续补强
- AI 能力依赖外部模型服务，不配置密钥时相关接口不可用
- 本地调试分享、登录、Webhook 时需要正确配置外部服务

## 后续方向

- 增加更完整的 XML round-trip 回归测试
- 增加编辑器 E2E 测试
- 持续完善版本 diff 展示
- 完善权限隔离与协作模型
- 优化大文稿下的性能表现

## 参考文档

- [docs/persistence-mvp.md](docs/persistence-mvp.md)
- [docs/implementation-plan.md](docs/implementation-plan.md)
- [docs/next16-rsc-feature-architecture.md](docs/next16-rsc-feature-architecture.md)
- [docs/share-comments-implementation-plan.md](docs/share-comments-implementation-plan.md)
- [docs/ask-ai-plan.md](docs/ask-ai-plan.md)
