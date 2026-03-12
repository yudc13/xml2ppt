import { redirect } from 'next/navigation'

import { getAuthenticatedUser } from '@/lib/auth/user'
import { resolveShareToken, upsertDeckMemberByShare } from '@/lib/db/repository'

type PageProps = {
	params: Promise<{ token: string }>
}

export default async function ShareEntryPage({ params }: PageProps) {
	const { token } = await params
	const share = await resolveShareToken(token)
	if (!share) {
		redirect('/?share=invalid')
	}

	const user = await getAuthenticatedUser()
	if (!user) {
		redirect(`/sign-in?redirect_url=/share/${encodeURIComponent(token)}`)
	}

	await upsertDeckMemberByShare(share.deckId, user.id, share.permission)
	redirect(`/decks/${share.deckId}`)
}
