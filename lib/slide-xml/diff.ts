import { parseSlideXml } from '@/lib/slide-xml/parser'
import type { SlideShapeModel, XmlNode, XmlValue } from '@/lib/slide-xml/types'

export type SlideDiffChangeType = 'added' | 'removed' | 'moved_resized' | 'text_changed'

export type SlideDiffChange = {
	type: SlideDiffChangeType
	shapeId: string
	shapeType: string
	summary: string
}

export type SlideDiffSummary = {
	totalChanges: number
	added: number
	removed: number
	movedResized: number
	textChanged: number
}

export type SlideDiffResult = {
	fromVersion: number
	toVersion: number
	summary: SlideDiffSummary
	changes: SlideDiffChange[]
}

function toText(value: XmlValue): string {
	if (typeof value === 'string') {
		return value
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}

	if (Array.isArray(value)) {
		return value.map((item) => toText(item)).join('')
	}

	if (!value || typeof value !== 'object') {
		return ''
	}

	return Object.values(value).map((item) => toText(item as XmlValue)).join('')
}

function normalizeText(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

function extractShapeText(shape: SlideShapeModel): string {
	const content = shape.rawNode.content
	if (!content || typeof content !== 'object' || Array.isArray(content)) {
		return ''
	}

	return normalizeText(toText(content as XmlNode))
}

function hasGeometryChange(fromShape: SlideShapeModel, toShape: SlideShapeModel): boolean {
	const from = fromShape.attributes
	const to = toShape.attributes

	return (
		from.topLeftX !== to.topLeftX ||
		from.topLeftY !== to.topLeftY ||
		from.width !== to.width ||
		from.height !== to.height ||
		from.rotation !== to.rotation
	)
}

function toShapeMap(shapes: SlideShapeModel[]): Map<string, SlideShapeModel> {
	return new Map(shapes.map((shape) => [shape.attributes.id, shape] as const))
}

export function buildSlideDiff(input: {
	fromXml: string
	toXml: string
	fromVersion: number
	toVersion: number
}): SlideDiffResult {
	const fromModel = parseSlideXml(input.fromXml)
	const toModel = parseSlideXml(input.toXml)
	const fromMap = toShapeMap(fromModel.shapes)
	const toMap = toShapeMap(toModel.shapes)
	const changes: SlideDiffChange[] = []

	for (const [shapeId, toShape] of toMap) {
		if (fromMap.has(shapeId)) {
			continue
		}

		changes.push({
			type: 'added',
			shapeId,
			shapeType: toShape.attributes.type,
			summary: '新增元素',
		})
	}

	for (const [shapeId, fromShape] of fromMap) {
		if (toMap.has(shapeId)) {
			continue
		}

		changes.push({
			type: 'removed',
			shapeId,
			shapeType: fromShape.attributes.type,
			summary: '删除元素',
		})
	}

	for (const [shapeId, fromShape] of fromMap) {
		const toShape = toMap.get(shapeId)
		if (!toShape) {
			continue
		}

		if (hasGeometryChange(fromShape, toShape)) {
			changes.push({
				type: 'moved_resized',
				shapeId,
				shapeType: toShape.attributes.type,
				summary: '位置/尺寸/旋转发生变化',
			})
		}

		if (extractShapeText(fromShape) !== extractShapeText(toShape)) {
			changes.push({
				type: 'text_changed',
				shapeId,
				shapeType: toShape.attributes.type,
				summary: '文本内容发生变化',
			})
		}
	}

	const summary: SlideDiffSummary = {
		totalChanges: changes.length,
		added: 0,
		removed: 0,
		movedResized: 0,
		textChanged: 0,
	}

	for (const change of changes) {
		if (change.type === 'added') {
			summary.added += 1
		} else if (change.type === 'removed') {
			summary.removed += 1
		} else if (change.type === 'moved_resized') {
			summary.movedResized += 1
		} else if (change.type === 'text_changed') {
			summary.textChanged += 1
		}
	}

	return {
		fromVersion: input.fromVersion,
		toVersion: input.toVersion,
		summary,
		changes,
	}
}
