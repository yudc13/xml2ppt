export type XmlPrimitive = string | number | boolean | null

export type XmlValue = XmlPrimitive | XmlNode | XmlValue[]

export type XmlNode = {
  [key: string]: XmlValue
}

export type ShapeType = "rect" | "text" | "round-rect" | (string & {})

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
