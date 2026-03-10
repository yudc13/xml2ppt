# Implementation Plan: Ask AI Feature

## 1. Overview

The "Ask AI" feature allows users to generate or edit presentation slides using natural language prompts powered by Gemini 2.5 Flash.

---

## Part A: Batch Slide Generation (✅ Done)

### Workflow

1. **Trigger**: User clicks "Ask AI" button in the top toolbar.
2. **Input**: A dialog appears for the user to enter a prompt.
3. **Generation**: Backend calls Gemini → returns **Simplified DSL JSON** (title, layout, blocks).
4. **Preview**: User sees an "Outline Preview" in the dialog and can edit text.
5. **Insertion**: `AIAdapter` converts DSL → `SlideDocumentModel` → XML. New slides inserted after active slide.

### Simplified DSL JSON

```json
{
	"slides": [
		{
			"title": "Slide Title",
			"layoutType": "title-content | two-columns | big-list | title-only",
			"primaryColor": "#HEXCOLOR",
			"blocks": [{ "type": "text | list", "content": "...", "role": "main | left | right" }]
		}
	]
}
```

### Key Files

| File                                                       | Purpose                      |
| ---------------------------------------------------------- | ---------------------------- |
| `lib/ai/types.ts`                                          | DSL TypeScript types         |
| `lib/ai/adapter.ts`                                        | DSL → SlideDocumentModel     |
| `app/api/ai/generate/route.ts`                             | Backend API for batch gen    |
| `features/deck-editor/hooks/use-ai-api.ts`                 | React hooks for AI API calls |
| `features/deck-editor/components/ask-ai/ask-ai-dialog.tsx` | Dialog UI                    |

---

## Part B: Shape-Level AI Editing (🚧 In Progress)

### Overview

When a user selects any Shape (text, shape, table), the floating toolbar shows an ✨ AI button.
Clicking opens a **Popover** for entering instructions. AI modifies **content + style simultaneously**, result applied directly (no preview). Supports Ctrl+Z undo.

### Design Decisions

| Decision           | Conclusion                                               |
| ------------------ | -------------------------------------------------------- |
| Modification scope | Content + Style (fill color, border, etc.) together      |
| UI form            | **Popover** (lightweight, positioned near Shape toolbar) |
| Table editing      | Modify **entire table** content                          |
| Preview confirm    | **No preview**, direct apply, undo to revert             |

### Data Flow

```
User selects Shape → Floating toolbar shows ✨ button
  ↓ click
AiEditPopover opens (near toolbar)
  ↓ enter instruction, send
POST /api/ai/edit
  Input: { prompt, shapeContext }
    shapeContext = {
      shapeType: "text" | "rect" | "table" | "image"
      contentHtml: string         // current content
      fillColor?: string          // current fill
      borderColor?: string        // current border color
      borderWidth?: number        // current border width
      borderStyle?: string        // solid | dashed | dotted
    }
  ↓ AI returns
  Output: {
    contentHtml?: string          // updated content
    tableData?: { rows: { cells: string[] }[] }
    fillColor?: string            // updated fill
    borderColor?: string          // updated border color
    borderWidth?: number          // updated border width
    borderStyle?: string          // updated border style
  }
  ↓ apply to Store
updateShapeContent()       — content
updateShapeFillColor()     — fill
updateShapeBorder*()       — border
captureHistorySnapshot()   — history for undo
```

### Implementation Tasks

| #   | Task                         | File                                                           |
| --- | ---------------------------- | -------------------------------------------------------------- |
| 1   | Add AI edit types            | `lib/ai/types.ts`                                              |
| 2   | Refactor `/api/ai/edit`      | `app/api/ai/edit/route.ts`                                     |
| 3   | Create `AiEditPopover`       | `features/deck-editor/components/ask-ai/ai-edit-popover.tsx`   |
| 4   | Inject AI button to toolbars | `features/deck-editor/components/toolbars/toolbar-manager.tsx` |
| 5   | Wire Popover in SlideShape   | `features/deck-editor/components/slide-shape.tsx`              |

### AI Response JSON Schema

```jsonc
{
	// Content (optional — omit to keep current)
	"contentHtml": "<p><span style='...'>Updated text</span></p>",

	// Table content (only for table shapes)
	"tableData": {
		"rows": [{ "cells": ["Cell 1", "Cell 2"] }, { "cells": ["Cell 3", "Cell 4"] }],
	},

	// Style (optional — omit to keep current)
	"fillColor": "rgba(59, 130, 246, 0.1)",
	"borderColor": "rgba(59, 130, 246, 1)",
	"borderWidth": 2,
	"borderStyle": "solid",
}
```

### Popover UX Details

1. **Position**: Below the floating toolbar, near the Shape
2. **Input**: Single-line input + send button, Enter to submit
3. **Loading**: Button → Spinner, input disabled
4. **Success**: Stay open, clear input, user can send more instructions
5. **Failure**: Toast error message
6. **Close**: Click outside / Esc / deselect Shape

---

## Environment Setup

- Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local`
- Install `@google/generative-ai` via `bun add @google/generative-ai`
