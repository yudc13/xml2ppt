import { createId } from '@/lib/utils'
import type { SlideShapeModel, ShapeAttributes, ShapeStyle, XmlNode } from '@/lib/slide-xml/types'
import type { AiSlideDSL, AiContentBlock } from './types'

const SLIDE_WIDTH = 960
const SLIDE_HEIGHT = 540
const PADDING = 40
const TITLE_HEIGHT = 80

function createTextShape(
	id: string,
	content: string | string[],
	x: number,
	y: number,
	width: number,
	height: number,
	fontSize: number,
	color: string,
	isBold = false
): SlideShapeModel {
	const textContent = Array.isArray(content) ? content.join('\n') : content

	const spanNode: XmlNode = {
		'#text': textContent,
		'@_fontSize': fontSize,
		'@_color': color,
	}

	const rawNode: XmlNode = {
		'@_id': id,
		'@_type': 'text',
		'@_width': width,
		'@_height': height,
		'@_topLeftX': x,
		'@_topLeftY': y,
		'@_rotation': 0,
		content: {
			'@_verticalAlign': 'top',
			p: {
				...(isBold ? { strong: { span: spanNode } } : { span: spanNode }),
			},
		},
	}

	return {
		attributes: {
			id,
			type: 'text',
			width,
			height,
			topLeftX: x,
			topLeftY: y,
			rotation: 0,
		},
		style: {},
		rawNode,
	}
}

export function convertAiSlideToModels(slideDsl: AiSlideDSL): SlideShapeModel[] {
	const shapes: SlideShapeModel[] = []
	const { title, layoutType, primaryColor, blocks } = slideDsl

	// 1. Add Title
	shapes.push(
		createTextShape(
			createId('ai-title'),
			title,
			PADDING,
			PADDING,
			SLIDE_WIDTH - PADDING * 2,
			TITLE_HEIGHT,
			36,
			primaryColor,
			true
		)
	)

	const contentY = PADDING + TITLE_HEIGHT + 20
	const contentHeight = SLIDE_HEIGHT - contentY - PADDING

	// 2. Add Content based on layout
	if (layoutType === 'title-content' || layoutType === 'title-only') {
		const mainBlock = blocks.find((b) => b.role === 'main')
		if (mainBlock) {
			shapes.push(
				createTextShape(
					createId('ai-content'),
					mainBlock.content,
					PADDING,
					contentY,
					SLIDE_WIDTH - PADDING * 2,
					contentHeight,
					20,
					'rgba(31, 35, 41, 1)'
				)
			)
		}
	} else if (layoutType === 'two-columns') {
		const leftBlock = blocks.find((b) => b.role === 'left' || b.role === 'main')
		const rightBlock = blocks.find((b) => b.role === 'right')
		const columnWidth = (SLIDE_WIDTH - PADDING * 3) / 2

		if (leftBlock) {
			shapes.push(
				createTextShape(
					createId('ai-content-left'),
					leftBlock.content,
					PADDING,
					contentY,
					columnWidth,
					contentHeight,
					18,
					'rgba(31, 35, 41, 1)'
				)
			)
		}
		if (rightBlock) {
			shapes.push(
				createTextShape(
					createId('ai-content-right'),
					rightBlock.content,
					PADDING + columnWidth + PADDING,
					contentY,
					columnWidth,
					contentHeight,
					18,
					'rgba(31, 35, 41, 1)'
				)
			)
		}
	} else if (layoutType === 'big-list') {
		const mainBlock = blocks.find((b) => b.role === 'main')
		if (mainBlock) {
			shapes.push(
				createTextShape(
					createId('ai-content-list'),
					mainBlock.content,
					PADDING,
					contentY,
					SLIDE_WIDTH - PADDING * 2,
					contentHeight,
					22,
					'rgba(31, 35, 41, 1)'
				)
			)
		}
	}

	return shapes
}
