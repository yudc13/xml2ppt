"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, Trash2, CheckCheck, RotateCcw, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCreateComment, useDeleteComment, useResolveComment, useSlideComments, useUpdateComment } from "@/features/deck-editor/hooks/use-comments-api";
import type { CommentEntity } from "@/features/deck-editor/types";

type CommentFilter = "all" | "open" | "resolved";

export function CommentsPanel({
	open,
	onOpenChange,
	deckId,
	slideId,
	canComment,
	canManage,
	activeShapeId,
	onSelectShape,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	deckId: string;
	slideId?: string;
	canComment: boolean;
	canManage: boolean;
	activeShapeId?: string | null;
	onSelectShape?: (shapeId: string | null) => void;
}) {
	const commentsQuery = useSlideComments(deckId, slideId);
	const createComment = useCreateComment(deckId);
	const resolveComment = useResolveComment(deckId);
	const deleteComment = useDeleteComment(deckId);
	const updateComment = useUpdateComment(deckId);

	const [filter, setFilter] = useState<CommentFilter>("open");
	const [draft, setDraft] = useState("");
	const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
	const [replyDraft, setReplyDraft] = useState("");
	const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
	const [editingDraft, setEditingDraft] = useState("");

	const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
	const roots = useMemo(() => comments.filter((item) => !item.parentId), [comments]);
	const repliesByParent = useMemo(() => {
		const map = new Map<string, CommentEntity[]>();
		for (const item of comments) {
			if (!item.parentId) {
				continue;
			}
			const siblings = map.get(item.parentId) ?? [];
			siblings.push(item);
			map.set(item.parentId, siblings);
		}
		return map;
	}, [comments]);

	const visibleRoots = useMemo(() => {
		return roots.filter((item) => {
			if (activeShapeId && item.shapeId !== activeShapeId) {
				return false;
			}
			if (filter === "all") {
				return true;
			}
			return item.status === filter;
		});
	}, [activeShapeId, filter, roots]);

	const handleCreateRoot = async () => {
		if (!slideId || !draft.trim()) {
			return;
		}
		try {
			await createComment.mutateAsync({
				slideId,
				shapeId: activeShapeId ?? undefined,
				content: draft.trim(),
			});
			setDraft("");
		} catch (error) {
			console.error(error);
			toast.error("创建评论失败");
		}
	};

	const handleReply = async () => {
		if (!slideId || !replyTargetId || !replyDraft.trim()) {
			return;
		}
		try {
			await createComment.mutateAsync({
				slideId,
				parentId: replyTargetId,
				content: replyDraft.trim(),
			});
			setReplyDraft("");
			setReplyTargetId(null);
		} catch (error) {
			console.error(error);
			toast.error("回复失败");
		}
	};

	const handleResolveToggle = async (comment: CommentEntity) => {
		try {
			await resolveComment.mutateAsync({
				commentId: comment.id,
				resolved: comment.status !== "resolved",
				slideId: comment.slideId,
			});
		} catch (error) {
			console.error(error);
			toast.error("更新评论状态失败");
		}
	};

	const handleDelete = async (comment: CommentEntity) => {
		try {
			await deleteComment.mutateAsync({
				commentId: comment.id,
				slideId: comment.slideId,
			});
		} catch (error) {
			console.error(error);
			toast.error("删除评论失败");
		}
	};

	const startEditing = (comment: CommentEntity) => {
		setEditingCommentId(comment.id);
		setEditingDraft(comment.content);
	};

	const cancelEditing = () => {
		setEditingCommentId(null);
		setEditingDraft("");
	};

	const handleUpdate = async (comment: CommentEntity) => {
		if (!editingDraft.trim()) {
			return;
		}
		try {
			await updateComment.mutateAsync({
				commentId: comment.id,
				content: editingDraft.trim(),
				slideId: comment.slideId,
			});
			cancelEditing();
		} catch (error) {
			console.error(error);
			toast.error("编辑评论失败");
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-[420px] p-0 sm:max-w-[420px]">
				<SheetHeader className="border-b border-slate-200 bg-white p-4">
					<SheetTitle>评论备注</SheetTitle>
					<SheetDescription>当前页评论讨论与批注。</SheetDescription>
				</SheetHeader>

				<div className="border-b border-slate-200 p-4">
					<div className="mb-3 flex flex-wrap gap-2">
						{(["open", "resolved", "all"] as const).map((item) => (
							<button
								key={item}
								type="button"
								onClick={() => setFilter(item)}
								className={`rounded-lg border px-2.5 py-1 text-xs ${
									filter === item
										? "border-sky-300 bg-sky-50 text-sky-700"
										: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
								}`}
							>
								{item === "open" ? "待处理" : item === "resolved" ? "已解决" : "全部"}
							</button>
						))}
					</div>

					{activeShapeId ? (
						<div className="mb-3 flex items-center gap-2 rounded-xl bg-sky-50 px-2.5 py-2">
							<div className="min-w-0 flex-1">
								<div className="mb-1 text-[11px] font-medium tracking-[0.02em] text-sky-700/90">已按形状筛选</div>
								<div className="truncate font-mono text-[11px] text-sky-800/90">
									{activeShapeId}
								</div>
							</div>
							<button
								type="button"
								className="shrink-0 whitespace-nowrap rounded-md border border-sky-200/70 bg-white/80 px-2.5 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-white"
								onClick={() => onSelectShape?.(null)}
							>
								清除筛选
							</button>
						</div>
					) : null}

					{canComment ? (
						<div className="space-y-2">
							<Textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder={activeShapeId ? "给当前形状添加评论..." : "添加页面评论..."}
								className="min-h-20 resize-none text-sm"
							/>
							<div className="flex justify-end">
								<button
									type="button"
									onClick={() => void handleCreateRoot()}
									disabled={!draft.trim() || createComment.isPending || !slideId}
									className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<MessageSquarePlus className="h-3.5 w-3.5" />
									发表评论
								</button>
							</div>
						</div>
					) : (
						<div className="text-xs text-slate-500">你当前只有查看权限，无法发表评论。</div>
					)}
				</div>

				<ScrollArea className="h-[calc(100vh-290px)]">
					<div className="space-y-3 p-4">
						{commentsQuery.isLoading ? <div className="text-sm text-slate-500">评论加载中...</div> : null}
						{!commentsQuery.isLoading && visibleRoots.length === 0 ? (
							<div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
								暂无评论
							</div>
						) : null}

						{visibleRoots.map((root) => {
							const replies = repliesByParent.get(root.id) ?? [];
							return (
								<div key={root.id} className="rounded-xl border border-slate-200 bg-white p-3">
									<div className="mb-2 flex items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<Badge variant={root.status === "resolved" ? "outline" : "secondary"}>
												{root.status === "resolved" ? "已解决" : "待处理"}
											</Badge>
											{root.shapeId ? (
												<button
													type="button"
													onClick={() => onSelectShape?.(root.shapeId)}
													className="inline-flex items-center gap-1 text-xs text-slate-500 underline underline-offset-2"
												>
													<MessageCircle className="h-3.5 w-3.5" />
													定位到形状
												</button>
											) : null}
										</div>
										<div className="text-[11px] text-slate-400">{new Date(root.createdAt).toLocaleString()}</div>
									</div>

									{editingCommentId === root.id ? (
										<div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
											<Textarea
												value={editingDraft}
												onChange={(event) => setEditingDraft(event.target.value)}
												className="min-h-16 resize-none bg-white text-sm"
											/>
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={cancelEditing}
													className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
												>
													取消
												</button>
												<button
													type="button"
													onClick={() => void handleUpdate(root)}
													disabled={!editingDraft.trim() || updateComment.isPending}
													className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
												>
													保存
												</button>
											</div>
										</div>
									) : (
										<p className="mb-2 whitespace-pre-wrap text-sm text-slate-700">{root.content}</p>
									)}

									<div className="mb-2 flex items-center gap-2">
										{canComment ? (
											<button
												type="button"
												onClick={() => setReplyTargetId((current) => (current === root.id ? null : root.id))}
												className="text-xs text-slate-600 underline underline-offset-2"
											>
												回复
											</button>
										) : null}
										{canComment ? (
											<button
												type="button"
												onClick={() => void handleResolveToggle(root)}
												className="inline-flex items-center gap-1 text-xs text-slate-600 underline underline-offset-2"
											>
												{root.status === "resolved" ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
												{root.status === "resolved" ? "取消解决" : "标记解决"}
											</button>
										) : null}
										{canComment ? (
											<button
												type="button"
												onClick={() => startEditing(root)}
												className="inline-flex items-center gap-1 text-xs text-slate-600 underline underline-offset-2"
											>
												<Pencil className="h-3.5 w-3.5" />
												编辑
											</button>
										) : null}
										{canManage ? (
											<button
												type="button"
												onClick={() => void handleDelete(root)}
												className="inline-flex items-center gap-1 text-xs text-rose-600 underline underline-offset-2"
											>
												<Trash2 className="h-3.5 w-3.5" />
												删除
											</button>
										) : null}
									</div>

									{replyTargetId === root.id ? (
										<div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
											<Textarea
												value={replyDraft}
												onChange={(event) => setReplyDraft(event.target.value)}
												placeholder="回复这条评论..."
												className="min-h-16 resize-none bg-white text-sm"
											/>
											<div className="flex justify-end gap-2">
												<button
													type="button"
													onClick={() => {
														setReplyTargetId(null);
														setReplyDraft("");
													}}
													className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
												>
													取消
												</button>
												<button
													type="button"
													onClick={() => void handleReply()}
													disabled={!replyDraft.trim() || createComment.isPending}
													className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
												>
													发送回复
												</button>
											</div>
										</div>
									) : null}

									{replies.length > 0 ? (
										<div className="space-y-2 border-l-2 border-slate-100 pl-3">
											{replies.map((reply) => (
												<div key={reply.id} className="rounded-lg bg-slate-50 p-2">
													<div className="mb-1 text-[11px] text-slate-400">{new Date(reply.createdAt).toLocaleString()}</div>
													{editingCommentId === reply.id ? (
														<div className="space-y-2">
															<Textarea
																value={editingDraft}
																onChange={(event) => setEditingDraft(event.target.value)}
																className="min-h-16 resize-none bg-white text-sm"
															/>
															<div className="flex justify-end gap-2">
																<button
																	type="button"
																	onClick={cancelEditing}
																	className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
																>
																	取消
																</button>
																<button
																	type="button"
																	onClick={() => void handleUpdate(reply)}
																	disabled={!editingDraft.trim() || updateComment.isPending}
																	className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
																>
																	保存
																</button>
															</div>
														</div>
													) : (
														<>
															<p className="mb-1 whitespace-pre-wrap text-sm text-slate-700">{reply.content}</p>
															<div className="flex items-center gap-2">
																{canComment ? (
																	<button
																		type="button"
																		onClick={() => startEditing(reply)}
																		className="inline-flex items-center gap-1 text-xs text-slate-600 underline underline-offset-2"
																	>
																		<Pencil className="h-3.5 w-3.5" />
																		编辑
																	</button>
																) : null}
																{canManage ? (
																	<button
																		type="button"
																		onClick={() => void handleDelete(reply)}
																		className="inline-flex items-center gap-1 text-xs text-rose-600 underline underline-offset-2"
																	>
																		<Trash2 className="h-3.5 w-3.5" />
																		删除
																	</button>
																) : null}
															</div>
														</>
													)}
												</div>
											))}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
