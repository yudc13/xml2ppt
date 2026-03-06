'use client'

import PptxGenJS from 'pptxgenjs'

import { parseSlideXml } from '@/lib/slide-xml/parser'
import type { SlideShapeModel } from '@/lib/slide-xml/types'
import {
	extractText,
	getBorderColor,
	getBorderWidth,
	getContentNode,
	getFillColor,
	getTextStyle,
	parseColor,
	parseTable,
	pxToInches,
	resolveImageData,
	toArray,
} from '@/features/deck-editor/lib/export/shared'
import type { XmlNode, XmlValue } from '@/lib/slide-xml/types'

const SLIDE_LAYOUT_WIDE = 'LAYOUT_WIDE'

function getShapeFill(shape: SlideShapeModel): { color: string; transparency: number } {
	const color = parseColor(getFillColor(shape))
	return {
		color: color.hex,
		transparency: Math.round((1 - color.alpha) * 100),
	}
}

function getShapeLine(
	shape: SlideShapeModel
): { color: string; pt: number; transparency: number } | undefined {
	const width = getBorderWidth(shape)
	if (width <= 0) {
		return undefined
	}

	const border = parseColor(getBorderColor(shape))
	return {
		color: border.hex,
		pt: Math.max(0.5, width * 0.75),
		transparency: Math.round((1 - border.alpha) * 100),
	}
}

async function appendShape(
	slide: PptxGenJS.Slide,
	shapeType: typeof PptxGenJS.prototype.ShapeType,
	shape: SlideShapeModel
) {
	const { attributes, rawNode } = shape
	const x = pxToInches(attributes.topLeftX)
	const y = pxToInches(attributes.topLeftY)
	const w = pxToInches(attributes.width)
	const h = pxToInches(attributes.height)
	const rotate = attributes.rotation
	const type = attributes.type

	if (type === 'text') {
		const textStyle = getTextStyle(shape)
		const color = parseColor(textStyle.color)
		const textRuns = buildTextRuns(shape, {
			color: color.hex,
			fontFace: textStyle.fontFamily,
			fontSize: textStyle.fontSize,
		})
		slide.addText(textRuns, {
			x,
			y,
			w,
			h,
			rotate,
			color: color.hex,
			fontSize: textStyle.fontSize,
			fontFace: textStyle.fontFamily,
			align: textStyle.align,
			valign: 'top',
			margin: 0,
		})
		return
	}

	if (type === 'table') {
		const rows = parseTable(shape)
		if (rows.length > 0) {
			slide.addTable(rows, {
				x,
				y,
				w,
				h,
				fontSize: 12,
				valign: 'mid',
				border: {
					type: 'solid',
					pt: 1,
					color: '888888',
				},
			})
		}
		return
	}

	if (type === 'image') {
		const src = rawNode['@_src']
		if (typeof src === 'string' && src.length > 0) {
			const data = await resolveImageData(src)
			if (data && !data.startsWith('data:image/svg+xml')) {
				slide.addImage({
					data,
					x,
					y,
					w,
					h,
					rotate,
				})
			}
		}
		return
	}

	if (type === 'line' || type === 'arrow') {
		const line = getShapeLine(shape) ?? { color: '1F2937', pt: 1, transparency: 0 }
		slide.addShape(shapeType.line, {
			x,
			y: y + h / 2,
			w,
			h: 0.001,
			rotate,
			line: {
				...line,
				endArrowType: type === 'arrow' ? 'triangle' : undefined,
			},
		})
		return
	}

	const fill = getShapeFill(shape)
	const line = getShapeLine(shape)
	const common = {
		x,
		y,
		w,
		h,
		rotate,
		fill,
		line,
	}

	if (type === 'ellipse') {
		slide.addShape(shapeType.ellipse, common)
		return
	}

	if (type === 'round-rect') {
		slide.addShape(shapeType.roundRect, common)
		return
	}

	slide.addShape(shapeType.rect, common)
}

function getListItems(value: XmlValue | undefined): XmlValue[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return []
	}

	return toArray((value as XmlNode).li as XmlValue | XmlValue[] | undefined)
}

function listItemToText(item: XmlValue): string {
	if (!item || typeof item !== 'object' || Array.isArray(item)) {
		return extractText(item).trim()
	}

	const node = item as XmlNode
	if (node.p) {
		return toArray(node.p as XmlValue | XmlValue[] | undefined)
			.map((paragraph) => extractText(paragraph).trim())
			.filter(Boolean)
			.join(' ')
	}

	return extractText(node).trim()
}

function buildTextRuns(
	shape: SlideShapeModel,
	baseStyle: { color: string; fontSize: number; fontFace: string }
): PptxGenJS.TextProps[] {
	const contentNode = getContentNode(shape)
	const runs: PptxGenJS.TextProps[] = []
	const baseOptions = {
		color: baseStyle.color,
		fontFace: baseStyle.fontFace,
		fontSize: baseStyle.fontSize,
	}

	const paragraphs = toArray(contentNode.p as XmlValue | XmlValue[] | undefined)
	for (const paragraph of paragraphs) {
		const text = extractText(paragraph).trim()
		if (!text) {
			continue
		}

		runs.push({
			text,
			options: {
				...baseOptions,
				breakLine: true,
			},
		})
	}

	const unorderedGroups = toArray(contentNode.ul as XmlValue | XmlValue[] | undefined)
	unorderedGroups.forEach((group, groupIndex) => {
		const items = getListItems(group)
		const lines = items.map((item) => listItemToText(item)).filter(Boolean)

		if (lines.length > 0) {
			runs.push({
				text: lines.join('\n'),
				options: {
					...baseOptions,
					bullet: true,
					breakLine: true,
				},
			})
		}

		if (groupIndex < unorderedGroups.length - 1) {
			runs.push({
				text: ' ',
				options: {
					...baseOptions,
					bullet: false,
					breakLine: true,
				},
			})
		}
	})

	const orderedGroups = toArray(contentNode.ol as XmlValue | XmlValue[] | undefined)
	orderedGroups.forEach((group, groupIndex) => {
		const items = getListItems(group)
		const lines = items.map((item) => listItemToText(item)).filter(Boolean)

		if (lines.length > 0) {
			runs.push({
				text: lines.join('\n'),
				options: {
					...baseOptions,
					bullet: { type: 'number' },
					breakLine: true,
				},
			})
		}

		if (groupIndex < orderedGroups.length - 1) {
			runs.push({
				text: ' ',
				options: {
					...baseOptions,
					bullet: false,
					breakLine: true,
				},
			})
		}
	})

	if (runs.length === 0) {
		const fallback = extractText(shape.rawNode.content).trim()
		runs.push({
			text: fallback || ' ',
			options: {
				...baseOptions,
			},
		})
	}

	const last = runs[runs.length - 1]
	if (last?.options) {
		last.options.breakLine = false
	}

	return runs
}

export async function exportSlidesToPptx(slideXmlList: string[], fileName: string) {
	const pptx = new PptxGenJS()
	pptx.layout = SLIDE_LAYOUT_WIDE
	pptx.author = 'PPT XML Editor'
	pptx.subject = 'Deck Export'
	pptx.title = fileName

	for (const xml of slideXmlList) {
		const model = parseSlideXml(xml)
		const slide = pptx.addSlide()
		const shapeType = pptx.ShapeType

		for (const shape of model.shapes) {
			try {
				await appendShape(slide, shapeType, shape)
			} catch (error) {
				console.warn('Skip unsupported shape on pptx export', {
					shapeId: shape.attributes.id,
					shapeType: shape.attributes.type,
					error,
				})
			}
		}
	}

	await pptx.writeFile({ fileName: `${fileName}.pptx` })
}
