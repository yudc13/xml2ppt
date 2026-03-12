import type { ComponentType } from 'react'

import { ShapeStyleToolbar } from '../components/toolbars/shape-style-toolbar'
import { TableToolbar } from '../components/toolbars/table-toolbar'
import { TextFormatToolbar } from '../components/toolbars/text-format-toolbar'

export type ToolbarType = 'text' | 'table' | 'shape'

export interface ToolbarConfig {
	type: ToolbarType
	component: ComponentType
	priority: number
}

export const TOOLBAR_REGISTRY: ToolbarConfig[] = [
	{
		type: 'text',
		component: TextFormatToolbar,
		priority: 30,
	},
	{
		type: 'table',
		component: TableToolbar,
		priority: 20,
	},
	{
		type: 'shape',
		component: ShapeStyleToolbar,
		priority: 10,
	},
]
