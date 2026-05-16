import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('upload constants', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_DIRECT_PDF_UPLOAD_ENABLED;
    delete process.env.NEXT_PUBLIC_MAX_PDF_SIZE_MB;
    delete process.env.NEXT_PUBLIC_PDF_BLOB_ACCESS;
  });

  it('defaults to a safe inline limit when direct upload is disabled', async () => {
    const upload = await import('@/lib/constants/upload');

    expect(upload.DIRECT_PDF_UPLOAD_ENABLED).toBe(false);
    expect(upload.MAX_PDF_SIZE_MB).toBe(4);
    expect(upload.shouldUseDirectPdfUpload(5 * 1024 * 1024)).toBe(false);
  });

  it('uses the configured large-file limit when direct upload is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_DIRECT_PDF_UPLOAD_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_MAX_PDF_SIZE_MB', '120');

    const upload = await import('@/lib/constants/upload');

    expect(upload.DIRECT_PDF_UPLOAD_ENABLED).toBe(true);
    expect(upload.MAX_PDF_SIZE_MB).toBe(120);
    expect(upload.shouldUseDirectPdfUpload(5 * 1024 * 1024)).toBe(true);
    expect(upload.shouldUseDirectPdfUpload(1024 * 1024)).toBe(false);
  });

  it('builds and validates safe PDF blob paths', async () => {
    const upload = await import('@/lib/constants/upload');
    const pathname = upload.buildPdfUploadPath('session_123', 'My Big Lecture Notes.pdf');

    expect(pathname).toBe('pdf-uploads/session_123/My-Big-Lecture-Notes.pdf');
    expect(upload.isAllowedPdfUploadPath(pathname)).toBe(true);
    expect(upload.isAllowedPdfUploadPath('../secret.pdf')).toBe(false);
    expect(
      upload.isAllowedPdfBlobUrl(
        `https://store-id.public.blob.vercel-storage.com/${pathname}?download=1`,
      ),
    ).toBe(true);
    expect(upload.isAllowedPdfBlobUrl('https://example.com/pdf-uploads/session_123/file.pdf')).toBe(
      false,
    );
  });
});
