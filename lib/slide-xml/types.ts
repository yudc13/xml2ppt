export type XmlPrimitive = string | number | boolean | null

export type XmlValue = XmlPrimitive | XmlNode | XmlValue[]

export type XmlNode = {
  [key: string]: XmlValue
}

export type TextPresetType =
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "body-small"

export type ShapeType =
  | "rect"
  | "text"
  | "round-rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "table"
  | (string & {})

export type ShapeStyle = {
  borderRadius?: string
}

export type ShapeAttributes = {
  id: string
  type: ShapeType
  width: number
  height: number
  topLeftX: number
  topLeftY: number
  rotation: number
}

export type TableCellModel = {
  id: string
  text: string
}

export type TableRowModel = {
  id: string
  cells: TableCellModel[]
}

export type TableModel = {
  rows: TableRowModel[]
}

export type SlideShapeModel = {
  attributes: ShapeAttributes
  style: ShapeStyle
  rawNode: XmlNode
}

export type SlideDocumentModel = {
  slideId: string
  rawSlideNode: XmlNode
  shapes: SlideShapeModel[]
}
