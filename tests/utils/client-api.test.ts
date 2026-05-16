import { describe, expect, it } from 'vitest';
import { isPayloadTooLargeResponse } from '@/lib/constants/upload';
import { readApiErrorMessage, readApiJson } from '@/lib/utils/client-api';

describe('isPayloadTooLargeResponse', () => {
  it('detects 413 responses', () => {
    expect(isPayloadTooLargeResponse(413, '')).toBe(true);
  });

  it('detects Vercel oversized payload markers', () => {
    expect(
      isPayloadTooLargeResponse(500, 'Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE'),
    ).toBe(true);
  });
});

describe('readApiErrorMessage', () => {
  it('returns custom payload-too-large message when the platform rejects the request', async () => {
    const response = new Response('Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE', {
      status: 413,
    });

    await expect(
      readApiErrorMessage(response, 'fallback', { payloadTooLargeMessage: 'PDF too large' }),
    ).resolves.toBe('PDF too large');
  });

  it('extracts JSON error messages when available', async () => {
    const response = new Response(JSON.stringify({ error: 'Parser failed' }), { status: 500 });

    await expect(readApiErrorMessage(response, 'fallback')).resolves.toBe('Parser failed');
  });
});

describe('readApiJson', () => {
  it('parses JSON bodies', async () => {
    const response = new Response(JSON.stringify({ success: true }), { status: 200 });

    await expect(readApiJson<{ success: boolean }>(response, 'fallback')).resolves.toEqual({
      success: true,
    });
  });

  it('throws the fallback message when the body is not valid JSON', async () => {
    const response = new Response('Request Entity Too Large', { status: 413 });

    await expect(readApiJson(response, 'fallback')).rejects.toThrow('fallback');
  });
});
