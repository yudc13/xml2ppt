import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserByClerkId, upsertUserByClerk } from '@/lib/db/repository'
import type { User } from '@/lib/db/schema'

/**
 * 获取当前已认证的本地用户。
 * 如果本地数据库不存在该用户，则从 Clerk 同步。
 */
export async function getAuthenticatedUser(): Promise<User | null> {
	const { userId: clerkUserId } = await auth()
	if (!clerkUserId) return null

	// 1. 尝试直接获取
	const existingUser = await getUserByClerkId(clerkUserId)
	if (existingUser && !existingUser.deletedAt) {
		return existingUser
	}

	// 2. 如果不存在或已删除，则同步
	console.log(`[JIT Sync] User ${clerkUserId} not found in local DB, starting sync from Clerk...`)
	const clerkUser = await currentUser()

	if (!clerkUser) {
		console.warn(`[JIT Sync] currentUser() returned null for ${clerkUserId}. Sync deferred.`)
		return null
	}

	// 更加健壮的邮箱提取：优先取主邮箱
	const primaryEmail =
		clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
		clerkUser.emailAddresses[0]?.emailAddress ??
		null

	// 更加健壮的姓名提取
	const fullName =
		[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
		clerkUser.username ||
		(primaryEmail ? primaryEmail.split('@')[0] : 'User')

	console.log(`[JIT Sync] Syncing user: ${fullName} (${primaryEmail})`)

	try {
		const syncedUser = await upsertUserByClerk({
			clerkUserId: clerkUser.id,
			email: primaryEmail,
			name: fullName,
			avatarUrl: clerkUser.imageUrl ?? null,
		})
		console.log(`[JIT Sync] Successfully synced user ${syncedUser.id}`)
		return syncedUser
	} catch (error) {
		console.error(`[JIT Sync] Failed to upsert user:`, error)
		return null
	}
}
