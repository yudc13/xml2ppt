import { NextResponse } from "next/server";

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...data,
    },
    { status },
  );
}

export function apiError(message: string, code: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
      code,
    },
    { status },
  );
}
