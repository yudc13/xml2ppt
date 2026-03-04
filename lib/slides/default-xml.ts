const DEFAULT_SLIDE_XML =
  '<slide id="{SLIDE_ID}"><style><fill><fillColor color="rgba(252, 252, 252, 1)"/></fill></style><data><shape id="{SHAPE_ID}" type="rect" width="960" height="540" topLeftX="0" topLeftY="0" rotation="0"><fill><fillColor color="rgba(252, 252, 252, 1)"/></fill></shape></data><note id="{NOTE_ID}"><content><p></p></content></note></slide>';

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlankSlideXml(): string {
  return DEFAULT_SLIDE_XML
    .replace("{SLIDE_ID}", createId("slide"))
    .replace("{SHAPE_ID}", createId("shape-bg"))
    .replace("{NOTE_ID}", createId("note"));
}
