import { NextResponse } from "next/server";

type SaveSlidePayload = {
  slideIndex?: unknown;
  xml?: unknown;
};

const savedSlides = new Map<number, string>();

export async function POST(request: Request) {
  let payload: SaveSlidePayload;

  try {
    payload = (await request.json()) as SaveSlidePayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid JSON payload",
      },
      { status: 400 },
    );
  }

  const slideIndex = Number(payload.slideIndex);
  const xml = payload.xml;

  if (!Number.isInteger(slideIndex) || slideIndex < 0 || typeof xml !== "string" || xml.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Expected payload: { slideIndex: number, xml: string }",
      },
      { status: 400 },
    );
  }

  savedSlides.set(slideIndex, xml);

  return NextResponse.json({
    ok: true,
    slideIndex,
    xmlLength: xml.length,
    savedAt: new Date().toISOString(),
  });
}
