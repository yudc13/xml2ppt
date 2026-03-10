import { GoogleGenerativeAI } from '@google/generative-ai'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import type { AiShapeEditRequest } from '@/lib/ai/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

const SYSTEM_PROMPT = `
You are an expert presentation design assistant. You help users modify individual shapes/elements on slides.

You will receive the current shape's context (type, content, styles) and the user's instruction.
Apply the user's changes to BOTH content AND style as needed.

Respond in strictly valid JSON matching this schema:
{
  "contentHtml": "string | null",
  "tableData": { "rows": [{ "cells": ["string"] }] } | null,
  "fillColor": "rgba(r, g, b, a) string | null",
  "borderColor": "rgba(r, g, b, a) string | null",
  "borderWidth": "number | null",
  "borderStyle": "solid | dashed | dotted | null"
}

Rules:
1. Only include fields that should be CHANGED. Omit fields that stay the same.
2. "contentHtml" should be valid HTML suitable for a contenteditable div. Use <p>, <span>, <strong>, <em>, <ul>, <ol>, <li> tags.
   - Use inline styles for font-size (e.g., style="font-size: calc(var(--slide-unit) * var(--slide-font-scale, 1) * 20)") and color (e.g., style="color: rgba(r,g,b,a)").
3. For table shapes (shapeType contains "table"), use "tableData" instead of "contentHtml" to return updated cell values as plain text.
4. Colors must be in rgba() format: rgba(r, g, b, a).
5. Language: Respond content in the same language as the user's instruction.
6. Keep the modification minimal and precise — only change what the user asked for.
`

export async function POST(request: Request) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const body = (await request.json()) as AiShapeEditRequest
		const { prompt, shapeContext } = body

		if (!prompt) {
			return apiError('Prompt is required', 'PROMPT_REQUIRED', 400)
		}
		if (!shapeContext) {
			return apiError('Shape context is required', 'CONTEXT_REQUIRED', 400)
		}

		const model = genAI.getGenerativeModel({
			model: 'gemini-2.5-flash',
			generationConfig: {
				responseMimeType: 'application/json',
			},
		})

		const chat = model.startChat({
			history: [
				{
					role: 'user',
					parts: [{ text: SYSTEM_PROMPT }],
				},
				{
					role: 'model',
					parts: [
						{
							text: 'Understood. I will modify the shape based on instructions and return a JSON with only the changed fields.',
						},
					],
				},
			],
		})

		const inputMessage = `
Current Shape Context:
- Type: ${shapeContext.shapeType}
- Content HTML: ${shapeContext.contentHtml}
- Fill Color: ${shapeContext.fillColor ?? 'none'}
- Border Color: ${shapeContext.borderColor ?? 'none'}
- Border Width: ${shapeContext.borderWidth ?? 'none'}
- Border Style: ${shapeContext.borderStyle ?? 'none'}

User Instruction: ${prompt}
`

		const result = await chat.sendMessage(inputMessage)
		const response = await result.response
		const text = response.text()

		try {
			const data = JSON.parse(text)
			return apiOk(data)
		} catch (parseError) {
			console.error('Failed to parse AI edit response:', text)
			return apiError('AI generated invalid data format', 'AI_PARSE_ERROR', 500)
		}
	} catch (error) {
		console.error('AI Edit Error:', error)
		return apiError('Failed to edit shape', 'AI_EDIT_FAILED', 500)
	}
}
