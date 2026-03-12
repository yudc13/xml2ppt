import { createHash, randomBytes } from 'node:crypto'

import { and, asc, desc, eq, gt, isNull, max, or, sql } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
	comments,
	deckMembers,
	decks,
	deckShareLinks,
	slideRevisions,
	slides,
	users,
	type Comment,
	type Deck,
	type DeckMember,
	type DeckShareLink,
	type Slide,
	type SlideRevision,
	type User,
} from '@/lib/db/schema'
import { createBlankSlideXml } from '@/lib/slides/default-xml'

export type DeckAccessRole = 'owner' | 'editor' | 'commenter' | 'viewer'
export type SharePermission = 'viewer' | 'commenter' | 'editor'

const ROLE_WEIGHT: Record<DeckAccessRole, number> = {
	viewer: 1,
	commenter: 2,
	editor: 3,
	owner: 4,
}

function hashShareToken(token: string): string {
	const secret = process.env.SHARE_LINK_SECRET ?? process.env.CLERK_SECRET_KEY ?? 'share-link-fallback'
	return createHash('sha256').update(`${secret}:${token}`).digest('hex')
}

function pickStrongerRole(current: DeckAccessRole, incoming: DeckAccessRole): DeckAccessRole {
	return ROLE_WEIGHT[current] >= ROLE_WEIGHT[incoming] ? current : incoming
}

function permissionToRole(permission: SharePermission): Exclude<DeckAccessRole, 'owner'> {
	if (permission === 'editor') {
		return 'editor'
	}
	if (permission === 'commenter') {
		return 'commenter'
	}
	return 'viewer'
}

export async function getDeckAccessRole(deckId: string, userId: string): Promise<DeckAccessRole | null> {
	const db = getDb()

	const [ownerDeck] = await db
		.select({ id: decks.id })
		.from(decks)
		.where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
		.limit(1)
	if (ownerDeck) {
		return 'owner'
	}

	const [member] = await db
		.select({ role: deckMembers.role })
		.from(deckMembers)
		.where(and(eq(deckMembers.deckId, deckId), eq(deckMembers.userId, userId)))
		.limit(1)

	if (!member) {
		return null
	}

	if (member.role === 'editor' || member.role === 'commenter' || member.role === 'viewer') {
		return member.role
	}

	return null
}

export async function getSlideDeckInfo(slideId: string): Promise<{ deckId: string } | null> {
	const db = getDb()
	const [result] = await db
		.select({ deckId: slides.deckId })
		.from(slides)
		.where(eq(slides.id, slideId))
		.limit(1)

	return result ?? null
}

export async function getSlideAccessRole(
	slideId: string,
	userId: string
): Promise<{ role: DeckAccessRole; deckId: string } | null> {
	const slideInfo = await getSlideDeckInfo(slideId)
	if (!slideInfo) {
		return null
	}

	const role = await getDeckAccessRole(slideInfo.deckId, userId)
	if (!role) {
		return null
	}

	return {
		role,
		deckId: slideInfo.deckId,
	}
}

export async function verifySlideOwnership(slideId: string, userId: string): Promise<boolean> {
	const access = await getSlideAccessRole(slideId, userId)
	return access?.role === 'owner'
}

export async function createDeck(title: string, userId: string): Promise<Deck> {
	const db = getDb()
	const [created] = await db.insert(decks).values({ title, userId }).returning()
	return created
}

export async function listDecks(userId: string): Promise<Deck[]> {
	const db = getDb()

	const ownedDecks = await db.select().from(decks).where(eq(decks.userId, userId))
	const sharedDecks = await db
		.select({ deck: decks })
		.from(deckMembers)
		.innerJoin(decks, eq(deckMembers.deckId, decks.id))
		.where(eq(deckMembers.userId, userId))

	const deckMap = new Map<string, Deck>()
	for (const deck of ownedDecks) {
		deckMap.set(deck.id, deck)
	}
	for (const row of sharedDecks) {
		if (!deckMap.has(row.deck.id)) {
			deckMap.set(row.deck.id, row.deck)
		}
	}

	return [...deckMap.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

export async function getDeckById(deckId: string, userId?: string): Promise<Deck | null> {
	const db = getDb()
	const conditions = [eq(decks.id, deckId)]
	if (userId) {
		conditions.push(eq(decks.userId, userId))
	}
	const [deck] = await db
		.select()
		.from(decks)
		.where(and(...conditions))
		.limit(1)
	return deck ?? null
}

export async function updateDeckTitle(
	deckId: string,
	title: string,
	userId: string
): Promise<Deck | null> {
	const db = getDb()
	const [updated] = await db
		.update(decks)
		.set({
			title,
			updatedAt: sql`now()`,
		})
		.where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
		.returning()

	return updated ?? null
}

export async function getSlidesByDeckId(deckId: string): Promise<Slide[]> {
	const db = getDb()
	return db.select().from(slides).where(eq(slides.deckId, deckId)).orderBy(asc(slides.position))
}

export async function createSlide(
	deckId: string,
	xmlContent?: string,
	actorId?: string | null,
	position?: number
): Promise<Slide | null> {
	const db = getDb()
	return db.transaction(async (tx) => {
		const [deck] = await tx
			.select({ id: decks.id })
			.from(decks)
			.where(eq(decks.id, deckId))
			.limit(1)
		if (!deck) {
			return null
		}

		let insertPosition: number
		if (typeof position === 'number') {
			insertPosition = position
			await tx
				.update(slides)
				.set({ position: sql`-(${slides.position} + 1)` })
				.where(and(eq(slides.deckId, deckId), sql`${slides.position} >= ${insertPosition}`))
		} else {
			const [positionResult] = await tx
				.select({ maxPosition: max(slides.position) })
				.from(slides)
				.where(eq(slides.deckId, deckId))
			insertPosition = (positionResult.maxPosition ?? 0) + 1
		}

		const slideXmlContent = xmlContent ?? createBlankSlideXml()
		const [created] = await tx
			.insert(slides)
			.values({
				deckId,
				position: insertPosition,
				xmlContent: slideXmlContent,
			})
			.returning()

		await tx.insert(slideRevisions).values({
			slideId: created.id,
			version: created.version,
			xmlContent: slideXmlContent,
			createdBy: actorId ?? 'system',
			reason: 'create',
		})

		if (typeof position === 'number') {
			await tx
				.update(slides)
				.set({ position: sql`abs(${slides.position})` })
				.where(and(eq(slides.deckId, deckId), sql`${slides.position} < 0`))
		}

		return created
	})
}

export async function deleteSlide(slideId: string): Promise<boolean> {
	const db = getDb()
	return db.transaction(async (tx) => {
		const [slide] = await tx.select().from(slides).where(eq(slides.id, slideId)).limit(1)
		if (!slide) {
			return false
		}

		await tx.delete(slideRevisions).where(eq(slideRevisions.slideId, slideId))

		const [deleted] = await tx.delete(slides).where(eq(slides.id, slideId)).returning()
		if (!deleted) {
			return false
		}

		await tx
			.update(slides)
			.set({ position: sql`-(${slides.position} - 1)` })
			.where(and(eq(slides.deckId, slide.deckId), sql`${slides.position} > ${slide.position}`))

		await tx
			.update(slides)
			.set({ position: sql`abs(${slides.position})` })
			.where(and(eq(slides.deckId, slide.deckId), sql`${slides.position} < 0`))

		return true
	})
}

export async function updateSlideContent(params: {
	slideId: string
	version: number
	xmlContent: string
	reason?: 'manual_save' | 'autosave' | 'rollback'
	actorId?: string | null
}): Promise<
	{ status: 'updated'; slide: Slide } | { status: 'conflict' } | { status: 'not_found' }
> {
	const db = getDb()
	const updated = await db.transaction(async (tx) => {
		const [nextSlide] = await tx
			.update(slides)
			.set({
				xmlContent: params.xmlContent,
				version: sql`${slides.version} + 1`,
				updatedAt: sql`now()`,
			})
			.where(and(eq(slides.id, params.slideId), eq(slides.version, params.version)))
			.returning()

		if (!nextSlide) {
			return null
		}

		await tx.insert(slideRevisions).values({
			slideId: nextSlide.id,
			version: nextSlide.version,
			xmlContent: params.xmlContent,
			createdBy: params.actorId ?? 'system',
			reason: params.reason ?? 'manual_save',
		})

		return nextSlide
	})

	if (updated) {
		return { status: 'updated', slide: updated }
	}

	const [existing] = await db
		.select({ id: slides.id })
		.from(slides)
		.where(eq(slides.id, params.slideId))
		.limit(1)
	if (!existing) {
		return { status: 'not_found' }
	}

	return { status: 'conflict' }
}

export async function listSlideRevisions(slideId: string, limit = 50): Promise<SlideRevision[]> {
	const db = getDb()
	const safeLimit = Math.max(1, Math.min(200, limit))
	return db
		.select()
		.from(slideRevisions)
		.where(eq(slideRevisions.slideId, slideId))
		.orderBy(desc(slideRevisions.version))
		.limit(safeLimit)
}

export async function getSlideRevision(
	slideId: string,
	version: number
): Promise<SlideRevision | null> {
	const db = getDb()
	const [revision] = await db
		.select()
		.from(slideRevisions)
		.where(and(eq(slideRevisions.slideId, slideId), eq(slideRevisions.version, version)))
		.limit(1)

	return revision ?? null
}

export async function rollbackSlideToRevision(params: {
	slideId: string
	targetVersion: number
	currentVersion: number
	actorId?: string | null
}): Promise<
	{ status: 'updated'; slide: Slide } | { status: 'conflict' } | { status: 'not_found' }
> {
	const db = getDb()

	const rolledBack = await db.transaction(async (tx) => {
		const [targetRevision] = await tx
			.select()
			.from(slideRevisions)
			.where(
				and(
					eq(slideRevisions.slideId, params.slideId),
					eq(slideRevisions.version, params.targetVersion)
				)
			)
			.limit(1)

		if (!targetRevision) {
			return null
		}

		const [nextSlide] = await tx
			.update(slides)
			.set({
				xmlContent: targetRevision.xmlContent,
				version: sql`${slides.version} + 1`,
				updatedAt: sql`now()`,
			})
			.where(and(eq(slides.id, params.slideId), eq(slides.version, params.currentVersion)))
			.returning()

		if (!nextSlide) {
			return undefined
		}

		await tx.insert(slideRevisions).values({
			slideId: nextSlide.id,
			version: nextSlide.version,
			xmlContent: targetRevision.xmlContent,
			createdBy: params.actorId ?? 'system',
			reason: 'rollback',
		})

		return nextSlide
	})

	if (rolledBack === undefined) {
		return { status: 'conflict' }
	}

	if (rolledBack === null) {
		return { status: 'not_found' }
	}

	return { status: 'updated', slide: rolledBack }
}

export async function createDeckShareLink(
	deckId: string,
	createdBy: string,
	input: { permission: SharePermission; expiresAt?: string }
): Promise<{ link: DeckShareLink; shareUrl: string }> {
	const db = getDb()
	const token = randomBytes(32).toString('base64url')
	const tokenHash = hashShareToken(token)

	const [created] = await db
		.insert(deckShareLinks)
		.values({
			deckId,
			tokenHash,
			permission: input.permission,
			expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
			createdBy,
		})
		.returning()

	const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
	const shareUrl = baseUrl ? `${baseUrl}/share/${token}` : `/share/${token}`

	return { link: created, shareUrl }
}

export async function listDeckShareLinks(deckId: string): Promise<DeckShareLink[]> {
	const db = getDb()
	return db
		.select()
		.from(deckShareLinks)
		.where(eq(deckShareLinks.deckId, deckId))
		.orderBy(desc(deckShareLinks.createdAt))
}

export async function canManageShareLink(linkId: string, userId: string): Promise<boolean> {
	const db = getDb()
	const [link] = await db
		.select({ deckId: deckShareLinks.deckId })
		.from(deckShareLinks)
		.where(eq(deckShareLinks.id, linkId))
		.limit(1)

	if (!link) {
		return false
	}

	const role = await getDeckAccessRole(link.deckId, userId)
	return role === 'owner' || role === 'editor'
}

export async function revokeDeckShareLink(linkId: string): Promise<boolean> {
	const db = getDb()
	const [updated] = await db
		.update(deckShareLinks)
		.set({ revokedAt: sql`now()` })
		.where(and(eq(deckShareLinks.id, linkId), isNull(deckShareLinks.revokedAt)))
		.returning({ id: deckShareLinks.id })

	return !!updated
}

export async function resolveShareToken(
	token: string
): Promise<{ deckId: string; permission: SharePermission } | null> {
	const db = getDb()
	const tokenHash = hashShareToken(token)

	const [link] = await db
		.select({
			deckId: deckShareLinks.deckId,
			permission: deckShareLinks.permission,
		})
		.from(deckShareLinks)
		.where(
			and(
				eq(deckShareLinks.tokenHash, tokenHash),
				isNull(deckShareLinks.revokedAt),
				or(isNull(deckShareLinks.expiresAt), gt(deckShareLinks.expiresAt, sql`now()`))
			)
		)
		.limit(1)

	if (!link) {
		return null
	}

	if (
		link.permission !== 'viewer' &&
		link.permission !== 'commenter' &&
		link.permission !== 'editor'
	) {
		return null
	}

	return {
		deckId: link.deckId,
		permission: link.permission,
	}
}

export async function upsertDeckMemberByShare(
	deckId: string,
	userId: string,
	permission: SharePermission
): Promise<DeckMember | null> {
	const db = getDb()

	const [ownerDeck] = await db
		.select({ id: decks.id })
		.from(decks)
		.where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
		.limit(1)
	if (ownerDeck) {
		return null
	}

	const incomingRole = permissionToRole(permission)
	const [existing] = await db
		.select()
		.from(deckMembers)
		.where(and(eq(deckMembers.deckId, deckId), eq(deckMembers.userId, userId)))
		.limit(1)

	const nextRole = existing
		? pickStrongerRole(existing.role as DeckAccessRole, incomingRole)
		: incomingRole

	const [member] = await db
		.insert(deckMembers)
		.values({
			deckId,
			userId,
			role: nextRole,
		})
		.onConflictDoUpdate({
			target: [deckMembers.deckId, deckMembers.userId],
			set: {
				role: nextRole,
				updatedAt: sql`now()`,
			},
		})
		.returning()

	return member
}

export async function listCommentsBySlide(deckId: string, slideId: string): Promise<Comment[]> {
	const db = getDb()
	return db
		.select()
		.from(comments)
		.where(
			and(eq(comments.deckId, deckId), eq(comments.slideId, slideId), isNull(comments.deletedAt))
		)
		.orderBy(asc(comments.createdAt))
}

export async function createComment(
	deckId: string,
	authorId: string,
	input: { slideId: string; shapeId?: string; parentId?: string; content: string }
): Promise<Comment | null> {
	const db = getDb()

	const [slide] = await db
		.select({ id: slides.id })
		.from(slides)
		.where(and(eq(slides.id, input.slideId), eq(slides.deckId, deckId)))
		.limit(1)
	if (!slide) {
		return null
	}

	if (input.parentId) {
		const [parent] = await db
			.select({ id: comments.id })
			.from(comments)
			.where(and(eq(comments.id, input.parentId), eq(comments.deckId, deckId), isNull(comments.deletedAt)))
			.limit(1)
		if (!parent) {
			return null
		}
	}

	const [created] = await db
		.insert(comments)
		.values({
			deckId,
			slideId: input.slideId,
			shapeId: input.shapeId ?? null,
			parentId: input.parentId ?? null,
			content: input.content,
			authorId,
		})
		.returning()

	return created
}

export async function updateComment(
	commentId: string,
	input: { content?: string; status?: 'open' | 'resolved' }
): Promise<Comment | null> {
	const db = getDb()
	const [updated] = await db
		.update(comments)
		.set({
			...(input.content ? { content: input.content } : {}),
			...(input.status ? { status: input.status } : {}),
			updatedAt: sql`now()`,
		})
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.returning()

	return updated ?? null
}

export async function softDeleteComment(commentId: string): Promise<boolean> {
	const db = getDb()
	const [updated] = await db
		.update(comments)
		.set({
			deletedAt: sql`now()`,
			updatedAt: sql`now()`,
		})
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.returning({ id: comments.id })

	return !!updated
}

export async function verifyCommentPermission(
	commentId: string,
	userId: string,
	action: 'edit' | 'delete' | 'resolve'
): Promise<boolean> {
	const db = getDb()
	const [target] = await db
		.select({
			authorId: comments.authorId,
			deckId: comments.deckId,
		})
		.from(comments)
		.where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
		.limit(1)

	if (!target) {
		return false
	}

	if (target.authorId === userId) {
		return true
	}

	const role = await getDeckAccessRole(target.deckId, userId)
	if (!role) {
		return false
	}

	if (action === 'resolve') {
		return role === 'owner' || role === 'editor' || role === 'commenter'
	}

	return role === 'owner' || role === 'editor'
}

export async function upsertUserByClerk(params: {
	clerkUserId: string
	email?: string | null
	name?: string | null
	avatarUrl?: string | null
}): Promise<User> {
	const db = getDb()

	const [user] = await db
		.insert(users)
		.values({
			clerkUserId: params.clerkUserId,
			email: params.email ?? null,
			name: params.name ?? null,
			avatarUrl: params.avatarUrl ?? null,
			deletedAt: null,
		})
		.onConflictDoUpdate({
			target: users.clerkUserId,
			set: {
				email: sql`COALESCE(${users.email}, ${params.email})`,
				name: sql`COALESCE(${users.name}, ${params.name})`,
				avatarUrl: sql`COALESCE(${users.avatarUrl}, ${params.avatarUrl})`,
				deletedAt: null,
				updatedAt: sql`now()`,
			},
		})
		.returning()

	return user
}

export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
	const db = getDb()
	const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1)
	return user ?? null
}

export async function markUserDeletedByClerkId(clerkUserId: string): Promise<User | null> {
	const db = getDb()
	const [user] = await db
		.update(users)
		.set({
			deletedAt: sql`now()`,
			updatedAt: sql`now()`,
		})
		.where(eq(users.clerkUserId, clerkUserId))
		.returning()

	return user ?? null
}
