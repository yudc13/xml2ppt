export type ApiErrorPayload = {
  ok?: boolean;
  message?: string;
  code?: string;
};

export class ApiRequestError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

  if (!response.ok || payload.ok === false) {
    throw new ApiRequestError(
      payload.message ?? `Request failed with status ${response.status}`,
      payload.code,
      response.status,
    );
  }

  return payload as T;
}
