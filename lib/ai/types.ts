export type AiLayoutType = 'title-content' | 'two-columns' | 'big-list' | 'title-only'

export type AiBlockRole = 'main' | 'left' | 'right' | 'title'

export type AiContentBlock = {
	type: 'text' | 'list'
	content: string | string[]
	role: AiBlockRole
}

export type AiSlideDSL = {
	title: string
	layoutType: AiLayoutType
	primaryColor: string
	blocks: AiContentBlock[]
}

export type AiGenerationResponse = {
	slides: AiSlideDSL[]
}

// ── Shape-level AI Editing ──

export type AiShapeContext = {
	shapeType: string
	contentHtml: string
	fillColor?: string
	borderColor?: string
	borderWidth?: number
	borderStyle?: string
}

export type AiShapeEditRequest = {
	prompt: string
	shapeContext: AiShapeContext
}

export type AiShapeEditResponse = {
	contentHtml?: string
	tableData?: { rows: { cells: string[] }[] }
	fillColor?: string
	borderColor?: string
	borderWidth?: number
	borderStyle?: string
}
