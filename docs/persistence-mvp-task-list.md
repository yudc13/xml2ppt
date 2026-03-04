# 数据持久化 MVP 任务清单（无认证版）

## 范围说明
- 本期不做用户认证、权限隔离、多租户。
- 目标是完成“单实例可持久化”的幻灯片编辑闭环：创建、编辑、切换、刷新后可恢复。
- 数据库存储使用 Neon(PostgreSQL)，前端保持 XML 编辑模型。

## 本期需求
1. 文稿与幻灯片持久化
- 支持新建文稿（deck）
- 支持新建幻灯片（append）
- 支持保存当前幻灯片 XML
- 支持加载文稿全部幻灯片并按顺序展示
2. 编辑一致性
- 切换幻灯片前自动保存当前页
- 新建幻灯片前自动保存当前页
- 手动保存按钮可持久化到数据库
3. 基础可靠性
- 保存失败有明确提示
- 保存接口幂等（同版本重复提交不破坏数据）
- 使用乐观锁（version）避免后写覆盖前写

## 非目标（延期）
- 用户注册/登录/权限控制
- 协同编辑
- 分享链接与访问控制
- 版本管理 UI（可后续补）

## 执行顺序
1. 先完成 Task 1-3（后端可用）
2. 再做 Task 4-6（前端接入）
3. 最后 Task 7-8（收口）

## Task 1. 数据库与连接
- 新增 Neon 连接配置（`.env.local`、`lib/db`）
- 选定 ORM（Drizzle）并初始化
- 建立迁移流程（migrate 命令）
- 验收：本地可连 Neon 并成功执行 migration

## Task 2. 数据模型落地
- 建 `deck` 表（id/title/created_at/updated_at）
- 建 `slide` 表（id/deck_id/position/xml_content/version/created_at/updated_at）
- 建唯一索引 `unique(deck_id, position)`
- 验收：可插入 deck 和多条 slide，position 唯一生效

## Task 3. 后端 API（MVP）
- `POST /api/decks`：新建文稿
- `GET /api/decks/:deckId/slides`：获取文稿幻灯片
- `POST /api/decks/:deckId/slides`：新建幻灯片（追加）
- `PATCH /api/slides/:slideId`：保存 XML（带 version 乐观锁）
- 验收：可跑通创建 -> 新建页 -> 保存 -> 读取流程

## Task 4. 前端数据接入
- 启动时从 API 拉取 slides，替换 `mock/slides` 初始化
- 侧边栏新建按钮调用 `POST /slides`
- 切换页/新建前触发自动保存 `PATCH /slides/:slideId`
- 手动保存按钮改为持久化到数据库
- 验收：刷新页面后内容不丢失，切换页不丢失

## Task 5. 保存策略与状态管理
- store/page 状态增加 `slideId/version/isDirty/isSaving/lastSavedAt`
- 保存成功后更新本地 version
- 冲突返回 `409` 时提示“内容已过期，请刷新后重试”
- 验收：冲突可识别，不会静默覆盖

## Task 6. 异常与回退
- API 错误统一返回结构 `{ ok, message, code }`
- 前端补全状态提示（保存中、成功、失败）
- 自动保存失败时保留本地编辑状态，不清空
- 验收：断网/500 时用户内容不丢失、错误可感知

## Task 7. 测试与校验
- API 最小覆盖：创建、读取、保存、版本冲突
- 前端关键流程手测：新建、编辑、切换、刷新
- 执行 `npm run lint`（可选 `npm run build`）
- 验收：lint 通过，关键用例通过

## Task 8. 文档与交付
- 新增 `docs/persistence-mvp.md`
- 记录环境变量、迁移命令、接口示例
- 记录已知限制（无认证、单租户）
- 验收：新同学可按文档快速跑起
