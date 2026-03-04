# Persistence MVP 说明（无认证版）

## 概览
本期已完成 Neon/PostgreSQL 持久化 MVP，范围为单实例（无用户认证、无权限隔离）。

已支持：
- 新建文稿（deck）
- 新建幻灯片（append）
- 保存幻灯片 XML（乐观锁 version）
- 加载文稿全部幻灯片
- 切换页/新建前自动保存
- 手动保存
- 历史版本列表、版本预览、回滚

## 环境变量
复制 `.env.example` 到 `.env.local`，并填写：

```bash
DATABASE_URL=postgres://<user>:<password>@<host>/<database>?sslmode=require
```

## 初始化步骤
1. 安装依赖：

```bash
bun install
```

2. 执行 migration：

```bash
bun run db:migrate
```

3. 启动开发：

```bash
bun run dev
```

4. 执行 API 冒烟测试（需开发服务已启动）：

```bash
bun run api:smoke
```

## API 列表
1. `POST /api/decks`
- 入参：`{ title?: string }`
- 出参：`{ ok: true, deck }`

2. `GET /api/decks/:deckId/slides`
- 出参：`{ ok: true, slides }`

3. `POST /api/decks/:deckId/slides`
- 入参：`{ xmlContent?: string }`
- 出参：`{ ok: true, slide }`

4. `PATCH /api/slides/:slideId`
- 入参：`{ version: number, xmlContent: string, reason?: "manual_save" | "autosave" }`
- 成功：`{ ok: true, slide }`
- 冲突：`409` + `{ ok: false, code: "SLIDE_VERSION_CONFLICT" }`

5. `GET /api/slides/:slideId/revisions`
- 入参：`?limit=100`（可选）
- 出参：`{ ok: true, revisions }`

6. `GET /api/slides/:slideId/revisions/:version`
- 出参：`{ ok: true, revision }`

7. `POST /api/slides/:slideId/rollback`
- 入参：`{ targetVersion: number, currentVersion: number }`
- 成功：`{ ok: true, slide }`
- 冲突：`409` + `{ ok: false, code: "SLIDE_VERSION_CONFLICT" }`

## 错误响应约定
所有失败响应结构统一为：

```json
{
  "ok": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

## 数据表
- `deck(id, title, created_at, updated_at)`
- `slide(id, deck_id, position, xml_content, version, created_at, updated_at)`
- `slide_revision(id, slide_id, version, xml_content, created_at, created_by, reason)`
- 约束：`unique(deck_id, position)`
- 约束：`unique(slide_id, version)`

## 已知限制
- 无用户系统，数据按“单实例”使用场景组织
- 未实现协同编辑
- 未实现版本差异（diff）展示，仅支持快照预览
