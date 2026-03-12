# 分享链接 + 评论 实施方案（V1）

## 1. 范围与约束（V1）
- 分享链接采用“登录后访问”模式：打开链接后要求 Clerk 登录，再授予该用户对 deck 的访问权限。
- V1 不做匿名访问、不做实时协作评论、不做 @ 提醒。
- 权限级别：`viewer`（只读）/`commenter`（评论）/`editor`（可编辑）。
- 权限复用现有后端鉴权：页面与 API 均走统一 deck 权限判断，禁止仅靠前端按钮禁用。

## 2. 按文件拆解的开发清单

### Phase 0: 数据层
- [x] [`migrations/0005_share_comments.sql`](/Users/yudachao/Projects/ydc/ppt/migrations/0005_share_comments.sql)：新增 `deck_member`、`deck_share_link`、`comment` 表与索引
- [x] [`lib/db/schema.ts`](/Users/yudachao/Projects/ydc/ppt/lib/db/schema.ts)：新增表定义与 TS 类型导出

### Phase 1: 权限与仓储层
- [x] [`lib/auth/deck-access.ts`](/Users/yudachao/Projects/ydc/ppt/lib/auth/deck-access.ts)：新增统一权限解析函数 `resolveDeckAccess`
- [x] [`lib/db/repository.ts`](/Users/yudachao/Projects/ydc/ppt/lib/db/repository.ts)：补充分享链接与评论 CRUD 仓储函数

### Phase 2: 分享链接路由
- [x] [`app/share/[token]/page.tsx`](/Users/yudachao/Projects/ydc/ppt/app/share/[token]/page.tsx)：校验 token、登录后加入 `deck_members` 并重定向到编辑页
- [x] [`app/api/decks/[deckId]/share-links/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/decks/[deckId]/share-links/route.ts)：创建/查询分享链接
- [x] [`app/api/share-links/[linkId]/revoke/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/share-links/[linkId]/revoke/route.ts)：撤销链接
- [x] [`middleware.ts`](/Users/yudachao/Projects/ydc/ppt/middleware.ts)：放行 `/share(.*)`（公开入口页）

### Phase 3: 评论路由
- [x] [`app/api/decks/[deckId]/comments/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/decks/[deckId]/comments/route.ts)：评论列表/创建
- [x] [`app/api/comments/[commentId]/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/comments/[commentId]/route.ts)：评论编辑/删除
- [x] [`app/api/comments/[commentId]/resolve/route.ts`](/Users/yudachao/Projects/ydc/ppt/app/api/comments/[commentId]/resolve/route.ts)：评论解决/取消解决

### Phase 4: 前端接入
- [x] [`features/deck-editor/hooks/use-share-api.ts`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/hooks/use-share-api.ts)：分享链接 API hooks
- [x] [`features/deck-editor/hooks/use-comments-api.ts`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/hooks/use-comments-api.ts)：评论 API hooks
- [x] [`features/deck-editor/components/header.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/header.tsx)：新增“分享”入口
- [x] [`features/deck-editor/components/share-dialog.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/share-dialog.tsx)：分享弹窗
- [ ] [`features/deck-editor/components/comments-panel.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/comments-panel.tsx)：评论侧栏
- [ ] [`features/deck-editor/components/slide-viewport.tsx`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/components/slide-viewport.tsx)：Shape 评论锚点渲染与跳转

### Phase 5: 类型与文档
- [x] [`features/deck-editor/types.ts`](/Users/yudachao/Projects/ydc/ppt/features/deck-editor/types.ts)：新增分享/评论实体类型
- [ ] [`README.md`](/Users/yudachao/Projects/ydc/ppt/README.md)：补充分享与评论 API 说明、权限说明

## 3. SQL 草案（PostgreSQL / Drizzle migration）

```sql
-- 0005_share_comments.sql

-- 1) Deck 成员（显式权限）
CREATE TABLE IF NOT EXISTS deck_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deck_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_members_deck_role ON deck_members(deck_id, role);
CREATE INDEX IF NOT EXISTS idx_deck_members_user_id ON deck_members(user_id);

-- 2) 分享链接（仅存 hash，不存明文 token）
CREATE TABLE IF NOT EXISTS deck_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  permission text NOT NULL CHECK (permission IN ('viewer', 'commenter', 'editor')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deck_share_links_deck_id ON deck_share_links(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_share_links_expires_at ON deck_share_links(expires_at);

-- 3) 评论（线程 + 锚点）
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  slide_id uuid NOT NULL REFERENCES slide(id) ON DELETE CASCADE,
  shape_id text,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_deck_slide_created_at
  ON comments(deck_id, slide_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_shape_id ON comments(shape_id);
```

## 4. 权限判定草案（服务端统一）

建议新增 `resolveDeckAccess(deckId, userId)`，返回：

```ts
type DeckPermission = "viewer" | "commenter" | "editor" | "owner";
type DeckAccess = {
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  role: DeckPermission | null;
  source: "owner" | "member" | "none";
};
```

规则：
1. `deck.userId === userId` => `owner`
2. 命中 `deck_members` => 按 role 赋权
3. 未命中 => 无权

说明：V1 通过 `/share/[token]` 把登录用户写入 `deck_members`，后续访问无需在每个请求重复带 token。

## 5. 第一批 API 骨架（路由与请求响应）

### 5.1 分享链接：`POST/GET /api/decks/[deckId]/share-links`

```ts
// app/api/decks/[deckId]/share-links/route.ts
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { resolveDeckAccess } from "@/lib/auth/deck-access";
import { createDeckShareLink, listDeckShareLinks } from "@/lib/db/repository";

const createSchema = z.object({
  permission: z.enum(["viewer", "commenter", "editor"]),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(_: Request, context: { params: Promise<{ deckId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { deckId } = await context.params;
  const access = await resolveDeckAccess(deckId, user.id);
  if (!access.canEdit) return apiError("Forbidden", "FORBIDDEN", 403);

  const links = await listDeckShareLinks(deckId);
  return apiOk({ links });
}

export async function POST(request: Request, context: { params: Promise<{ deckId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { deckId } = await context.params;
  const access = await resolveDeckAccess(deckId, user.id);
  if (!access.canEdit) return apiError("Forbidden", "FORBIDDEN", 403);

  const payload = createSchema.safeParse(await request.json());
  if (!payload.success) return apiError("Invalid payload", "INVALID_PAYLOAD", 400);

  const created = await createDeckShareLink(deckId, user.id, payload.data);
  return apiOk({ link: created.link, shareUrl: created.shareUrl }, 201);
}
```

### 5.2 撤销链接：`PATCH /api/share-links/[linkId]/revoke`

```ts
// app/api/share-links/[linkId]/revoke/route.ts
import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { revokeDeckShareLink, canManageShareLink } from "@/lib/db/repository";

export async function PATCH(_: Request, context: { params: Promise<{ linkId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { linkId } = await context.params;
  const manageable = await canManageShareLink(linkId, user.id);
  if (!manageable) return apiError("Forbidden", "FORBIDDEN", 403);

  await revokeDeckShareLink(linkId);
  return apiOk({ ok: true });
}
```

### 5.3 分享入口页：`GET /share/[token]`

```tsx
// app/share/[token]/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { resolveShareToken, upsertDeckMemberByShare } from "@/lib/db/repository";

export default async function ShareEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await resolveShareToken(token);
  if (!share) redirect("/?share=invalid");

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    redirect(`/sign-in?redirect_url=/share/${encodeURIComponent(token)}`);
  }

  // 需要先把 clerk user 同步到本地 users，再 upsert member
  await upsertDeckMemberByShare(share.deckId, clerkUserId!, share.permission);
  redirect(`/decks/${share.deckId}`);
}
```

### 5.4 评论列表/创建：`GET/POST /api/decks/[deckId]/comments`

```ts
// app/api/decks/[deckId]/comments/route.ts
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { resolveDeckAccess } from "@/lib/auth/deck-access";
import { createComment, listCommentsBySlide } from "@/lib/db/repository";

const createSchema = z.object({
  slideId: z.uuid(),
  shapeId: z.string().optional(),
  parentId: z.uuid().optional(),
  content: z.string().min(1).max(2000),
});

export async function GET(request: Request, context: { params: Promise<{ deckId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { deckId } = await context.params;
  const access = await resolveDeckAccess(deckId, user.id);
  if (!access.canView) return apiError("Forbidden", "FORBIDDEN", 403);

  const url = new URL(request.url);
  const slideId = url.searchParams.get("slideId");
  if (!slideId) return apiError("slideId is required", "INVALID_QUERY", 400);

  const comments = await listCommentsBySlide(deckId, slideId);
  return apiOk({ comments });
}

export async function POST(request: Request, context: { params: Promise<{ deckId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { deckId } = await context.params;
  const access = await resolveDeckAccess(deckId, user.id);
  if (!access.canComment) return apiError("Forbidden", "FORBIDDEN", 403);

  const payload = createSchema.safeParse(await request.json());
  if (!payload.success) return apiError("Invalid payload", "INVALID_PAYLOAD", 400);

  const comment = await createComment(deckId, user.id, payload.data);
  return apiOk({ comment }, 201);
}
```

### 5.5 评论更新/删除：`PATCH/DELETE /api/comments/[commentId]`

```ts
// app/api/comments/[commentId]/route.ts
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { updateComment, softDeleteComment, verifyCommentPermission } from "@/lib/db/repository";

const patchSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  status: z.enum(["open", "resolved"]).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { commentId } = await context.params;
  const allowed = await verifyCommentPermission(commentId, user.id, "edit");
  if (!allowed) return apiError("Forbidden", "FORBIDDEN", 403);

  const payload = patchSchema.safeParse(await request.json());
  if (!payload.success) return apiError("Invalid payload", "INVALID_PAYLOAD", 400);

  const comment = await updateComment(commentId, payload.data);
  return apiOk({ comment });
}

export async function DELETE(_: Request, context: { params: Promise<{ commentId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { commentId } = await context.params;
  const allowed = await verifyCommentPermission(commentId, user.id, "delete");
  if (!allowed) return apiError("Forbidden", "FORBIDDEN", 403);

  await softDeleteComment(commentId);
  return apiOk({ ok: true });
}
```

## 6. 验收标准（V1）
- [ ] 可创建分享链接，并能按权限跳转进入对应 deck
- [ ] 链接可撤销、可过期，失效后无法进入
- [ ] `viewer` 无法编辑，`commenter` 可评论不可编辑，`editor` 可编辑
- [ ] 支持按 slide/shape 维度创建评论与回复
- [ ] 评论支持解决/取消解决、软删除
- [ ] 相关 API 均通过统一权限校验
- [ ] 执行 `npm run lint` 通过（0 error）
