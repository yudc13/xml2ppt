import { NextResponse } from "next/server";

export async function GET() {
  throw new Error(`Sentry backend test error at ${new Date().toISOString()}`);
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
