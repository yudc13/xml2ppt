import { GoogleGenerativeAI } from '@google/generative-ai'
import { auth } from '@clerk/nextjs/server'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

const SYSTEM_PROMPT = `
You are an expert presentation assistant. Your goal is to help users generate high-quality slide outlines and content.

Guidelines:
1. Always respond in strictly valid JSON format.
2. The JSON should match this schema:
   {
     "slides": [
       {
         "title": "string",
         "layoutType": "title-content" | "two-columns" | "big-list" | "title-only",
         "primaryColor": "hex-color-code",
         "blocks": [
           { 
             "type": "text" | "list", 
             "content": "string" | ["string"], 
             "role": "main" | "left" | "right" 
           }
         ]
       }
     ]
   }
3. Content should be concise and professional.
4. "primaryColor" should be a harmonious color that fits the topic (e.g., blue for tech, green for nature).
5. "layoutType" should be chosen to best represent the content.
6. Support both single slide and multi-slide generation based on user prompt.
7. Language: Respond in the same language as the user's prompt (usually Chinese).
`

export async function POST(request: Request) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const { prompt } = await request.json()
		if (!prompt) {
			return apiError('Prompt is required', 'PROMPT_REQUIRED', 400)
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
					parts: [{ text: 'Understood. I will generate slides in the requested JSON format.' }],
				},
			],
		})

		const result = await chat.sendMessage(prompt)
		const response = await result.response
		const text = response.text()

		try {
			const data = JSON.parse(text)
			return apiOk(data)
		} catch (parseError) {
			console.error('Failed to parse AI response:', text)
			return apiError('AI generated invalid data format', 'AI_PARSE_ERROR', 500)
		}
	} catch (error) {
		console.error('AI Generation Error:', error)
		return apiError('Failed to generate slides', 'AI_GEN_FAILED', 500)
	}
}
