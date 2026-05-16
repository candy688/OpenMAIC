const DEFAULT_MAX_PDF_SIZE_MB = 50;

const configuredMaxPdfSizeMb = Number.parseFloat(process.env.NEXT_PUBLIC_MAX_PDF_SIZE_MB ?? '');

export const MAX_PDF_SIZE_MB =
  Number.isFinite(configuredMaxPdfSizeMb) && configuredMaxPdfSizeMb > 0
    ? configuredMaxPdfSizeMb
    : DEFAULT_MAX_PDF_SIZE_MB;

export const MAX_PDF_SIZE_BYTES = Math.floor(MAX_PDF_SIZE_MB * 1024 * 1024);

const PAYLOAD_TOO_LARGE_MARKERS = [
  'FUNCTION_PAYLOAD_TOO_LARGE',
  'Request Entity Too Large',
  'Payload Too Large',
];

export function isPayloadTooLargeResponse(status: number, responseText: string): boolean {
  if (status === 413) return true;
  return PAYLOAD_TOO_LARGE_MARKERS.some((marker) => responseText.includes(marker));
}
