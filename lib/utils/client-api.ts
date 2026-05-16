import { isPayloadTooLargeResponse } from '@/lib/constants/upload';

type ErrorPayload = {
  error?: string;
  message?: string;
  detail?: unknown;
};

function extractErrorMessage(payload: ErrorPayload): string | null {
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail;
  return null;
}

export async function readApiJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text().catch(() => '');
  if (!text) throw new Error(fallbackMessage);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export async function readApiErrorMessage(
  response: Response,
  fallbackMessage: string,
  options?: { payloadTooLargeMessage?: string },
): Promise<string> {
  const text = await response.text().catch(() => response.statusText);

  if (isPayloadTooLargeResponse(response.status, text)) {
    return options?.payloadTooLargeMessage || fallbackMessage;
  }

  if (!text) {
    return response.statusText || fallbackMessage;
  }

  try {
    const payload = JSON.parse(text) as ErrorPayload;
    return extractErrorMessage(payload) || fallbackMessage;
  } catch {
    return text;
  }
}
