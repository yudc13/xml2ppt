# PPT 评论备注功能实施方案

## 1. 目标
- 为每页幻灯片提供评论线程（根评论 + 回复）。
- 支持 Shape 锚点评论（评论可绑定具体图形）。
- 权限与现有分享权限体系一致：`viewer` 只读，`commenter` 可评论，`editor/owner` 可管理。

## 2. 当前基础能力
- 数据模型已具备：`comment`、`deck_member`、`deck_share_link`。
- 后端接口已具备：评论列表、创建、编辑、删除、解决。
- 统一权限校验已具备：`resolveDeckAccess`。

## 3. 分步实现
1. 评论数据层接入（React Query）
- 将评论列表改为 `useQuery`，按 `deckId + slideId` 作为 query key。
- 创建/解决/删除后触发失效刷新，支持轮询（10~15 秒）保持多人查看时的最新性。

2. 评论面板（右侧 Sheet）
- 新增 `features/deck-editor/components/comments-panel.tsx`。
- 面板支持：列表、状态筛选（open/resolved）、新建、回复、解决/取消、删除。
- UI 入口在顶部栏，支持随时打开/关闭。

3. 编辑器联动
- 在 `deck-editor-client.tsx` 中维护评论上下文：当前 `slideId`、当前 `shapeId` 过滤条件。
- 选中形状后，可一键“添加评论”并自动带上 `shapeId`。
- 评论面板点击某条评论时，可反向定位并选中对应 shape。

4. Shape 锚点渲染
- 在 `slide-viewport.tsx` 中基于当前 slide 评论渲染锚点角标（数量）。
- 点击锚点打开评论面板并过滤到该 `shapeId`。

5. 验证与交付
- 执行 `bun run lint`（必要）。
- 更新 README（可选）说明评论权限与使用方式。

## 4. 交互规则
- `viewer`
- 可查看评论，不可新建/回复/删除/解决。
- `commenter`
- 可新建、回复、解决；不可删除他人评论。
- `editor/owner`
- 可新建、回复、解决、删除（按后端权限规则）。

## 5. 验收标准
- 切换幻灯片后评论列表自动切换。
- 绑定 shape 的评论能在画布显示锚点且可点击定位。
- 非绑定 shape 的评论仍可在面板中正常显示。
- 权限受控：无权限用户前端不可操作，后端接口返回 403。
- 代码检查通过：`bun run lint`。

## 6. 当前进度（已完成）
- 评论面板已接入：支持筛选、创建、回复、解决/取消、删除。
- 评论编辑已接入：支持根评论与回复评论的内容编辑（`PATCH /api/comments/[commentId]`）。
- 画布 shape 评论锚点已接入：支持评论数角标与点击联动。
- 侧栏缩略图评论数已接入：通过 `GET /api/decks/[deckId]/comments?summary=1` 获取按 slide 聚合计数。
