# 首页 PPT 模板模块（MVP）需求与 Task List

## 1. 背景与目标
- 在首页新增系统预设 PPT 模板模块，降低用户创作门槛，缩短从进入首页到进入编辑器的路径。
- 本期聚焦「可用优先」：让用户可从模板一键创建文档，不做个性化推荐。

## 2. 本期业务结论（已确认）
- 模板权益：全部免费（后续可能扩展付费/VIP）
- 首页位置：首屏下方一个模板区块
- 导航：区块右上角提供“更多”，跳转模板列表页
- 创建流程：点击“使用模板”后直接创建新文档并跳转编辑器
- 数据存储：Neon（PostgreSQL）
- 语言：中文（`zh-CN`）
- 比例：统一 `16:9`
- 人群区分：不区分用户
- 审核/版权：本期无额外要求
- 成功指标：本期不设强制指标

## 3. 用户流程
1. 用户访问首页
2. 在「系统模板」区块浏览预设模板（8 个）
3. 点击模板“使用模板”
4. 系统基于模板快照创建文档
5. 跳转到新建文档编辑页
6. 用户可从“更多”进入 `/templates` 做场景筛选后再使用模板

## 4. 功能需求

### 4.1 首页模板区块
- 展示数量固定为 8
- 每个模板卡片展示：封面（无封面用占位视觉）、标题、场景标签、使用按钮
- 右上角“更多”跳转 `/templates`
- 无数据时展示空状态

### 4.2 模板列表页
- 路由：`/templates`
- 支持按场景标签筛选（默认“全部”）
- 展示模板总数
- 列表点击“使用模板”直接创建文档并跳转

### 4.3 创建文档逻辑
- 输入：`templateId`
- 从模板中读取完整编辑器数据快照（`template_data`）
- 创建 `deck`
- 根据快照创建多条 `slide`，并同步写入 `slide_revision`
- 新文档标题规则：`模板名 + 日期`

## 5. 数据模型约定（MVP）
- 表：`ppt_template`
- 字段：
  - `id`
  - `title`
  - `slug`
  - `cover_url`
  - `scene_tag`
  - `lang`（固定 `zh-CN`）
  - `ratio`（固定 `16:9`）
  - `is_free`（当前固定 `true`）
  - `status`（`active`/`inactive`）
  - `sort_order`
  - `template_data`（完整编辑器快照）
  - `created_at`
  - `updated_at`
- 索引：
  - `slug` 唯一索引
  - `(status, sort_order)` 组合索引
  - `scene_tag` 索引

## 6. API 约定（MVP）
- `GET /api/templates/home`
  - 返回首页模板（最多 8 条，按 `sort_order`）
- `GET /api/templates?scene=xxx&page=1&pageSize=24`
  - 返回模板列表、总数、可用场景列表
- `POST /api/documents/from-template`
  - 入参：`templateId`
  - 出参：新建 `deck`

## 7. 非目标（本期不做）
- 模板付费/VIP 权限控制
- 模板推荐算法与个性化排序
- 模板详情页
- 模板收藏、点赞、最近使用
- 多语言模板与多比例模板

## 8. 验收标准（Definition of Done）
- 首页展示 8 个系统模板，且“更多”可跳转模板列表页
- 模板列表可按场景筛选
- 从首页或列表页点击“使用模板”可成功创建文档并进入编辑器
- 新文档标题符合“模板名 + 日期”
- 模板数据来自 Neon，`template_data` 为完整快照
- 代码通过 `lint`（允许项目内历史 warning）

## 9. Task List

### Phase 0: 需求冻结
- [x] 明确 MVP 范围与非目标
- [x] 确认模板业务规则（免费、中文、16:9、不分用户）
- [x] 确认创建链路与标题规则

### Phase 1: 数据层
- [x] 新增 `ppt_template` 表结构与索引
- [x] 编写迁移脚本并落库
- [x] 初始化 8 条系统模板种子数据

### Phase 2: 仓储层
- [x] 新增首页模板查询能力
- [x] 新增模板列表查询与场景聚合能力
- [x] 新增“从模板创建文档”事务能力（deck + slides + revisions）

### Phase 3: API 层
- [x] 新增 `GET /api/templates/home`
- [x] 新增 `GET /api/templates`
- [x] 新增 `POST /api/documents/from-template`

### Phase 4: 首页接入
- [x] 首页新增「系统模板」区块
- [x] 展示 8 张模板卡片与“更多”入口
- [x] 接入“使用模板”创建并跳转编辑器

### Phase 5: 模板列表页
- [x] 新增 `/templates` 页面
- [x] 增加场景筛选
- [x] 接入模板创建动作

### Phase 6: 质量与回归
- [x] 执行数据库迁移
- [x] 执行 `lint` 检查
- [ ] 手测关键路径：首页模板创建、列表筛选创建、编辑器打开稳定性

## 10. 涉及文件（本期）
- 数据与迁移
  - `lib/db/schema.ts`
  - `lib/db/repository.ts`
  - `migrations/0006_ppt_templates.sql`
- API
  - `app/api/templates/home/route.ts`
  - `app/api/templates/route.ts`
  - `app/api/documents/from-template/route.ts`
- 页面与前端模块
  - `app/page.tsx`
  - `features/deck-list/components/deck-list-client.tsx`
  - `app/templates/page.tsx`
  - `features/template/components/template-list-client.tsx`
  - `features/template/hooks/use-template.ts`
  - `features/template/server/get-home-templates.ts`
  - `features/template/types.ts`

---
最后更新时间：2026-03-13
