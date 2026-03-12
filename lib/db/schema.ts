import {
	type AnyPgColumn,
	bigint,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

export const decks = pgTable(
	'deck',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		title: text('title').notNull(),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		userIdIdx: index('idx_deck_user_id').on(table.userId),
		updatedAtIdx: index('idx_deck_updated_at').on(table.updatedAt),
	})
)

export const slides = pgTable(
	'slide',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => decks.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		xmlContent: text('xml_content').notNull(),
		version: integer('version').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		deckPositionUnique: uniqueIndex('slide_deck_position_unique').on(table.deckId, table.position),
		deckPositionIdx: index('idx_slide_deck_position').on(table.deckId, table.position),
	})
)

export const slideRevisions = pgTable(
	'slide_revision',
	{
		id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
		slideId: uuid('slide_id')
			.notNull()
			.references(() => slides.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		xmlContent: text('xml_content').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		createdBy: text('created_by'),
		reason: text('reason'),
	},
	(table) => ({
		slideVersionUnique: uniqueIndex('slide_revision_slide_version_unique').on(
			table.slideId,
			table.version
		),
		slideVersionIdx: index('idx_slide_revision_slide_version').on(table.slideId, table.version),
	})
)

export const users = pgTable(
	'users',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		clerkUserId: text('clerk_user_id').notNull(),
		email: text('email'),
		name: text('name'),
		avatarUrl: text('avatar_url'),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		clerkUserIdUnique: uniqueIndex('users_clerk_user_id_unique').on(table.clerkUserId),
		updatedAtIdx: index('idx_users_updated_at').on(table.updatedAt),
	})
)

export const deckMembers = pgTable(
	'deck_member',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => decks.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		deckUserUnique: uniqueIndex('deck_member_deck_user_unique').on(table.deckId, table.userId),
		deckRoleIdx: index('idx_deck_member_deck_role').on(table.deckId, table.role),
		userIdx: index('idx_deck_member_user_id').on(table.userId),
	})
)

export const deckShareLinks = pgTable(
	'deck_share_link',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => decks.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		permission: text('permission').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		tokenHashUnique: uniqueIndex('deck_share_link_token_hash_unique').on(table.tokenHash),
		deckIdIdx: index('idx_deck_share_link_deck_id').on(table.deckId),
		expiresAtIdx: index('idx_deck_share_link_expires_at').on(table.expiresAt),
	})
)

export const comments = pgTable(
	'comment',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => decks.id, { onDelete: 'cascade' }),
		slideId: uuid('slide_id')
			.notNull()
			.references(() => slides.id, { onDelete: 'cascade' }),
		shapeId: text('shape_id'),
		parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		status: text('status').notNull().default('open'),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		deckSlideCreatedAtIdx: index('idx_comment_deck_slide_created_at').on(
			table.deckId,
			table.slideId,
			table.createdAt
		),
		parentIdIdx: index('idx_comment_parent_id').on(table.parentId),
		shapeIdIdx: index('idx_comment_shape_id').on(table.shapeId),
	})
)

export type Deck = typeof decks.$inferSelect
export type NewDeck = typeof decks.$inferInsert
export type Slide = typeof slides.$inferSelect
export type NewSlide = typeof slides.$inferInsert
export type SlideRevision = typeof slideRevisions.$inferSelect
export type NewSlideRevision = typeof slideRevisions.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type DeckMember = typeof deckMembers.$inferSelect
export type NewDeckMember = typeof deckMembers.$inferInsert
export type DeckShareLink = typeof deckShareLinks.$inferSelect
export type NewDeckShareLink = typeof deckShareLinks.$inferInsert
export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert
