const INLINE_PDF_UPLOAD_MAX_MB = 4;
const DEFAULT_DIRECT_UPLOAD_MAX_PDF_SIZE_MB = 100;

export const PDF_UPLOAD_PATH_PREFIX = 'pdf-uploads';

const configuredMaxPdfSizeMb = Number.parseFloat(process.env.NEXT_PUBLIC_MAX_PDF_SIZE_MB ?? '');

export const DIRECT_PDF_UPLOAD_ENABLED =
  process.env.NEXT_PUBLIC_DIRECT_PDF_UPLOAD_ENABLED === 'true';

export const PDF_BLOB_ACCESS =
  process.env.NEXT_PUBLIC_PDF_BLOB_ACCESS === 'public' ? 'public' : 'private';

export const INLINE_PDF_UPLOAD_MAX_BYTES = Math.floor(INLINE_PDF_UPLOAD_MAX_MB * 1024 * 1024);

export const MAX_PDF_SIZE_MB =
  Number.isFinite(configuredMaxPdfSizeMb) && configuredMaxPdfSizeMb > 0
    ? configuredMaxPdfSizeMb
    : DIRECT_PDF_UPLOAD_ENABLED
      ? DEFAULT_DIRECT_UPLOAD_MAX_PDF_SIZE_MB
      : INLINE_PDF_UPLOAD_MAX_MB;

export const MAX_PDF_SIZE_BYTES = Math.floor(MAX_PDF_SIZE_MB * 1024 * 1024);

export function shouldUseDirectPdfUpload(fileSize: number): boolean {
  return DIRECT_PDF_UPLOAD_ENABLED && fileSize > INLINE_PDF_UPLOAD_MAX_BYTES;
}

function sanitizePdfFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const withoutExtension = trimmed.toLowerCase().endsWith('.pdf') ? trimmed.slice(0, -4) : trimmed;
  const normalized = withoutExtension
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);

  return `${normalized || 'document'}.pdf`;
}

export function buildPdfUploadPath(sessionId: string, fileName: string): string {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]+/g, '');
  return `${PDF_UPLOAD_PATH_PREFIX}/${safeSessionId}/${sanitizePdfFileName(fileName)}`;
}

export function isAllowedPdfUploadPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/^\/+/, '');
  if (!normalizedPath.startsWith(`${PDF_UPLOAD_PATH_PREFIX}/`)) return false;
  if (normalizedPath.includes('..')) return false;
  return normalizedPath.toLowerCase().endsWith('.pdf');
}

export function isAllowedPdfBlobUrl(blobUrl: string): boolean {
  try {
    const url = new URL(blobUrl);
    return (
      url.protocol === 'https:' &&
      /\.blob\.vercel-storage\.com$/i.test(url.hostname) &&
      isAllowedPdfUploadPath(decodeURIComponent(url.pathname).replace(/^\/+/, ''))
    );
  } catch {
    return false;
  }
}

const PAYLOAD_TOO_LARGE_MARKERS = [
  'FUNCTION_PAYLOAD_TOO_LARGE',
  'Request Entity Too Large',
  'Payload Too Large',
];

export function isPayloadTooLargeResponse(status: number, responseText: string): boolean {
  if (status === 413) return true;
  return PAYLOAD_TOO_LARGE_MARKERS.some((marker) => responseText.includes(marker));
}
