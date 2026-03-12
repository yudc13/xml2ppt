'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useCreateShareLink, useListShareLinks, useRevokeShareLink } from '@/features/deck-editor/hooks/use-share-api'
import type { DeckShareLinkEntity, SharePermission } from '@/features/deck-editor/types'
import { toast } from 'sonner'

function computeExpiresAt(ttl: 'never' | '7d' | '30d'): string | undefined {
	if (ttl === 'never') {
		return undefined
	}

	const now = new Date()
	const days = ttl === '7d' ? 7 : 30
	now.setDate(now.getDate() + days)
	return now.toISOString()
}

function formatDate(value: string | null): string {
	if (!value) {
		return '永不过期'
	}

	return new Date(value).toLocaleString()
}

export function ShareDialog({
	open,
	onOpenChange,
	deckId,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	deckId: string
}) {
	const createShareLink = useCreateShareLink(deckId)
	const listShareLinks = useListShareLinks(deckId)
	const revokeShareLink = useRevokeShareLink()

	const [permission, setPermission] = useState<SharePermission>('viewer')
	const [ttl, setTtl] = useState<'never' | '7d' | '30d'>('7d')
	const [links, setLinks] = useState<DeckShareLinkEntity[]>([])
	const [latestUrl, setLatestUrl] = useState<string | null>(null)
	const wasOpenRef = useRef(false)

	useEffect(() => {
		if (open && !wasOpenRef.current) {
			void (async () => {
				try {
					const items = await listShareLinks.mutateAsync()
					setLinks(items)
				} catch (error) {
					console.error(error)
					toast.error('加载分享链接失败')
				}
			})()
		}

		wasOpenRef.current = open
	}, [listShareLinks, open])

	const loading = createShareLink.isPending || listShareLinks.isPending || revokeShareLink.isPending

	const sortedLinks = useMemo(
		() => [...links].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
		[links]
	)

	const handleCreate = async () => {
		try {
			const response = await createShareLink.mutateAsync({
				permission,
				expiresAt: computeExpiresAt(ttl),
			})
			setLatestUrl(response.shareUrl)
			setLinks((prev) => [response.link, ...prev])
			toast.success('分享链接已生成')
		} catch (error) {
			console.error(error)
			toast.error('生成分享链接失败')
		}
	}

	const handleCopy = async (value: string) => {
		const absolute = value.startsWith('http') ? value : `${window.location.origin}${value}`
		try {
			await navigator.clipboard.writeText(absolute)
			toast.success('链接已复制')
		} catch {
			toast.error('复制失败，请手动复制')
		}
	}

	const handleRevoke = async (linkId: string) => {
		try {
			await revokeShareLink.mutateAsync(linkId)
			setLinks((prev) => prev.map((item) => (item.id === linkId ? { ...item, revokedAt: new Date().toISOString() } : item)))
			toast.success('链接已撤销')
		} catch (error) {
			console.error(error)
			toast.error('撤销链接失败')
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[680px]'>
				<DialogHeader>
					<DialogTitle>分享文稿</DialogTitle>
					<DialogDescription>创建可访问当前文稿的分享链接。V1 需登录后访问。</DialogDescription>
				</DialogHeader>

				<div className='space-y-4'>
					<div className='grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end'>
						<label className='flex flex-col gap-1.5 text-xs text-slate-600'>
							权限
							<select
								value={permission}
								onChange={(event) => setPermission(event.target.value as SharePermission)}
								className='h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-200'
							>
								<option value='viewer'>查看</option>
								<option value='commenter'>评论</option>
								<option value='editor'>编辑</option>
							</select>
						</label>

						<label className='flex flex-col gap-1.5 text-xs text-slate-600'>
							有效期
							<select
								value={ttl}
								onChange={(event) => setTtl(event.target.value as 'never' | '7d' | '30d')}
								className='h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-sky-200'
							>
								<option value='7d'>7 天</option>
								<option value='30d'>30 天</option>
								<option value='never'>永不过期</option>
							</select>
						</label>

						<button
							type='button'
							onClick={handleCreate}
							disabled={loading}
							className='h-9 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
						>
							生成链接
						</button>
					</div>

					{latestUrl ? (
						<div className='rounded-lg border border-emerald-200 bg-emerald-50/70 p-3'>
							<div className='mb-1 text-xs font-medium text-emerald-700'>最新链接</div>
							<div className='flex items-center gap-2'>
								<input
									readOnly
									value={latestUrl.startsWith('http') ? latestUrl : `${typeof window !== 'undefined' ? window.location.origin : ''}${latestUrl}`}
									className='h-8 flex-1 rounded border border-emerald-200 bg-white px-2 text-xs text-slate-700'
								/>
								<button
									type='button'
									onClick={() => void handleCopy(latestUrl)}
									className='h-8 rounded border border-emerald-300 bg-white px-3 text-xs text-emerald-700 hover:bg-emerald-50'
								>
									复制
								</button>
							</div>
						</div>
					) : null}

					<div className='max-h-[280px] space-y-2 overflow-auto'>
						{sortedLinks.length === 0 ? (
							<div className='rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500'>
								暂无分享链接
							</div>
						) : (
							sortedLinks.map((link) => {
								const isRevoked = !!link.revokedAt
								return (
									<div key={link.id} className='rounded-lg border border-slate-200 bg-white p-3'>
										<div className='mb-2 flex items-center justify-between'>
											<div className='text-xs text-slate-600'>
												权限：<span className='font-medium text-slate-800'>{link.permission}</span>
												<span className='mx-2 text-slate-300'>|</span>
												过期：{formatDate(link.expiresAt)}
											</div>
											<div className='text-xs text-slate-500'>{isRevoked ? '已撤销' : '有效'}</div>
										</div>
										<div className='text-[11px] text-slate-400'>创建于 {new Date(link.createdAt).toLocaleString()}</div>
											<div className='mt-2 flex items-center justify-end gap-2'>
												<button
													type='button'
													disabled
													className='h-7 rounded border border-slate-200 px-2.5 text-xs text-slate-400'
													title='历史链接不返回明文 token，仅支持创建时复制'
												>
													仅新建时复制
												</button>
											<button
												type='button'
												onClick={() => void handleRevoke(link.id)}
												disabled={loading || isRevoked}
												className='h-7 rounded border border-rose-200 px-2.5 text-xs text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50'
											>
												撤销
											</button>
										</div>
									</div>
								)
							})
						)}
					</div>
				</div>

				<DialogFooter>
					<button
						type='button'
						onClick={() => onOpenChange(false)}
						className='h-9 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50'
					>
						关闭
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
