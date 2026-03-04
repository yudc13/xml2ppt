# PPT XML Editor

一个基于 Next.js 16 的 Web PPT 编辑器：将 Slide XML 解析为可交互 HTML 画布，编辑后再序列化回 XML，并支持 PostgreSQL 持久化与版本回滚。

## 核心能力
- XML -> HTML：将 shape/img 等节点解析为可编辑模型并渲染到 16:9 画布。
- HTML -> XML：编辑后保留结构语义并序列化回 XML。
- 幻灯片编辑：拖拽、缩放、旋转、文本编辑、图形/表格插入、层级调整。
- 持久化：Deck/Slide 存储、自动保存、手动保存、乐观锁版本控制。
- 历史版本：版本列表、预览指定版本、回滚到指定版本。

## 技术栈
- Framework: Next.js `16.1.6`（App Router）
- Runtime: React `19.2.3`
- Language: TypeScript
- Styling: Tailwind CSS `v4`
- State: Zustand + TanStack Query
- XML: fast-xml-parser
- DB: PostgreSQL + Drizzle ORM
- Package Manager: bun（优先）

## 架构与数据流

### 路由与模块分层
- `app/**`：仅路由入口（Server Components），负责参数解析与首屏数据组装。
- `features/**`：业务模块（components/hooks/server/types）。
- `components/ui/**`：原子 UI 组件（无业务语义）。
- `lib/**`：底层能力（db、xml、utils）。

详细规范见：
- [`docs/next16-rsc-feature-architecture.md`](docs/next16-rsc-feature-architecture.md)

### XML 编辑链路
1. `parseSlideXml(xml)`：解析 XML，规范化数值/颜色，输出 `SlideDocumentModel`。
2. `features/slide-editor/store`：将模型转为可编辑形态（zIndex、编辑态、历史栈）。
3. 画布编辑：基于 shape 模型进行拖拽/缩放/文本等交互。
4. `serializeSlideDocument(model)`：将编辑结果序列化回 XML。
5. 调用 API 持久化到 `slide.xml_content`，并写入 `slide_revision`。

## 快速开始

### 1. 安装依赖
```bash
bun install
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env.local`，设置：

```bash
DATABASE_URL=postgres://<user>:<password>@<host>/<database>?sslmode=require
```

### 3. 执行数据库迁移
```bash
bun run db:migrate
```

### 4. 启动开发
```bash
bun run dev
```

默认访问：`http://localhost:3000`

## 常用命令
```bash
bun run dev        # 开发环境
bun run lint       # ESLint 检查
bun run build      # 生产构建
bun run start      # 生产启动
bun run db:migrate # 执行迁移
bun run db:studio  # 打开 Drizzle Studio
bun run api:smoke  # API 冒烟测试（需 dev server 运行中）
```

## API 概览
- `GET /api/decks`：文稿列表
- `POST /api/decks`：新建文稿
- `GET /api/decks/:deckId`：文稿详情
- `PATCH /api/decks/:deckId`：更新文稿标题
- `GET /api/decks/:deckId/slides`：幻灯片列表
- `POST /api/decks/:deckId/slides`：新增幻灯片
- `PATCH /api/slides/:slideId`：保存幻灯片（乐观锁）
- `GET /api/slides/:slideId/revisions`：历史版本列表
- `GET /api/slides/:slideId/revisions/:version`：历史版本详情
- `POST /api/slides/:slideId/rollback`：回滚到指定版本

错误响应统一结构：
```json
{
  "ok": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

## 数据库模型
- `deck(id, title, created_at, updated_at)`
- `slide(id, deck_id, position, xml_content, version, created_at, updated_at)`
- `slide_revision(id, slide_id, version, xml_content, created_at, created_by, reason)`
- 约束：`unique(deck_id, position)`、`unique(slide_id, version)`

## 项目目录（核心）
```txt
app/
  page.tsx
  decks/[deckId]/page.tsx
  api/**

features/
  deck-list/
  deck-editor/
  slide-editor/
  shared/

components/
  ui/

lib/
  db/
  slide-xml/
```

## 已知限制
- 当前无用户认证与权限隔离（单实例场景）。
- 暂未支持多人协同编辑。
- 暂未提供版本 diff，仅支持快照预览与回滚。

## Task List
- [x] 完成 XML -> HTML 解析链路（`parseSlideXml`）。
- [x] 完成 HTML 编辑态 -> XML 序列化链路（`serializeSlideDocument`）。
- [x] 完成基础编辑能力：拖拽、缩放、旋转、文本编辑。
- [x] 完成图形与表格插入（矩形/圆/线/箭头/表格）。
- [x] 完成持久化能力：deck/slide CRUD 与自动保存。
- [x] 完成乐观锁版本控制（`version` 冲突检测）。
- [x] 完成历史版本列表、版本预览与回滚。
- [x] 完成架构分层改造：`app/**` 服务端路由层 + `features/**` 客户端业务层。
- [x] 完成客户端 API hooks 收敛（TanStack Query）。

## Todo List
- [ ] 增加 XML round-trip 回归测试（复杂富文本、表格、多图层场景）。
- [ ] 增加编辑器 E2E 测试（创建文稿、编辑、保存、回滚主流程）。
- [ ] 支持版本 diff 展示（结构差异 + 文本差异）。
- [ ] 增加用户认证与文稿权限隔离（多租户/多用户）。
- [ ] 增加协同编辑能力（冲突合并策略 + 在线状态同步）。
- [ ] 增加导入/导出能力（批量 XML 导入、PPTX 方向评估）。
- [ ] 补充性能优化：大文稿分段渲染、虚拟化缩略图、操作节流。
- [ ] 完善可观测性：保存耗时、失败率、冲突率指标。
- [ ] 提供插件化 shape 扩展机制（新形状渲染与序列化扩展点）。

## 参考文档
- [`docs/persistence-mvp.md`](docs/persistence-mvp.md)
- [`docs/implementation-plan.md`](docs/implementation-plan.md)
- [`docs/next16-rsc-feature-architecture.md`](docs/next16-rsc-feature-architecture.md)
