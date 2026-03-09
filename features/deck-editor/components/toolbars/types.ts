import { AlignCenter, AlignLeft, AlignRight, List, ListOrdered } from 'lucide-react'

export const FONT_OPTIONS = ['Montserrat', 'Open Sans', 'Noto Sans SC'] as const

export const COLOR_OPTIONS = [
	'rgba(17, 50, 100, 1)',
	'rgba(13, 116, 206, 1)',
	'rgba(239, 95, 0, 1)',
	'rgba(31, 35, 41, 1)',
	'rgba(100, 100, 100, 1)',
] as const

export const THEME_COLOR_OPTIONS = [
	'rgba(13, 116, 206, 1)',
	'rgba(16, 185, 129, 1)',
	'rgba(245, 158, 11, 1)',
	'rgba(239, 68, 68, 1)',
	'rgba(99, 102, 241, 1)',
	'rgba(31, 35, 41, 1)',
] as const

export const ALIGN_OPTIONS = [
	{ label: '左对齐', value: 'left', icon: AlignLeft },
	{ label: '居中对齐', value: 'center', icon: AlignCenter },
	{ label: '右对齐', value: 'right', icon: AlignRight },
] as const

export const LIST_OPTIONS = [
	{ label: '无列表', value: 'none', icon: List },
	{ label: '有序列表', value: 'ordered', icon: ListOrdered },
	{ label: '无序列表', value: 'unordered', icon: List },
] as const

export const SHAPE_FILL_OPTIONS = [
	'rgba(255, 255, 255, 1)',
	'rgba(234, 88, 12, 1)',
	'rgba(37, 99, 235, 1)',
	'rgba(13, 148, 136, 1)',
	'rgba(148, 163, 184, 1)',
	'rgba(31, 41, 55, 1)',
] as const

export const SHAPE_BORDER_OPTIONS = [
	'rgba(17, 24, 39, 1)',
	'rgba(71, 85, 105, 1)',
	'rgba(234, 88, 12, 1)',
	'rgba(37, 99, 235, 1)',
	'rgba(34, 197, 94, 1)',
	'rgba(168, 85, 247, 1)',
] as const

export const BORDER_STYLE_OPTIONS = [
	{ label: '实线', value: 'solid' },
	{ label: '虚线', value: 'dashed' },
	{ label: '点线', value: 'dotted' },
] as const

export type TextStyleState = {
	fontFamily: string
	fontSize: number
	color: string
	textAlign: 'left' | 'center' | 'right'
	listType: 'none' | 'ordered' | 'unordered'
}
