import { NextRequest } from 'next/server';
import { del, get } from '@vercel/blob';
import { parsePDF } from '@/lib/pdf/pdf-providers';
import { resolvePDFApiKey, resolvePDFBaseUrl } from '@/lib/server/provider-config';
import type { PDFProviderId } from '@/lib/pdf/types';
import type { ParsedPdfContent } from '@/lib/types/pdf';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { isAllowedPdfBlobUrl, PDF_BLOB_ACCESS } from '@/lib/constants/upload';

const log = createLogger('Parse PDF');

interface BlobPdfParseRequest {
  blobUrl?: string;
  fileName?: string;
  providerId?: PDFProviderId | null;
  apiKey?: string | null;
  baseUrl?: string | null;
}

export async function POST(req: NextRequest) {
  let pdfFileName: string | undefined;
  let resolvedProviderId: string | undefined;
  let uploadedBlobUrl: string | undefined;
  try {
    const contentType = req.headers.get('content-type') || '';
    let providerId: PDFProviderId | null = null;
    let apiKey: string | null = null;
    let baseUrl: string | null = null;
    let buffer: Buffer;
    let fileSize = 0;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const pdfFile = formData.get('pdf') as File | null;
      providerId = formData.get('providerId') as PDFProviderId | null;
      apiKey = formData.get('apiKey') as string | null;
      baseUrl = formData.get('baseUrl') as string | null;

      if (!pdfFile) {
        return apiError('MISSING_REQUIRED_FIELD', 400, 'No PDF file provided');
      }

      pdfFileName = pdfFile.name;
      fileSize = pdfFile.size;

      const arrayBuffer = await pdfFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = (await req.json()) as BlobPdfParseRequest;
      const blobUrl = body.blobUrl?.trim();

      if (!blobUrl) {
        return apiError('MISSING_REQUIRED_FIELD', 400, 'No PDF blob URL provided');
      }

      if (!isAllowedPdfBlobUrl(blobUrl)) {
        return apiError('INVALID_REQUEST', 400, 'Invalid PDF blob URL');
      }

      const blobResult = await get(blobUrl, { access: PDF_BLOB_ACCESS });
      if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
        return apiError('INVALID_REQUEST', 404, 'Uploaded PDF not found');
      }

      providerId = body.providerId ?? null;
      apiKey = body.apiKey ?? null;
      baseUrl = body.baseUrl ?? null;
      pdfFileName = body.fileName || 'document.pdf';
      uploadedBlobUrl = blobUrl;
      fileSize = blobResult.blob.size;

      const arrayBuffer = await new Response(blobResult.stream).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      log.error('Invalid Content-Type for PDF upload:', contentType);
      return apiError(
        'INVALID_REQUEST',
        400,
        `Invalid Content-Type: expected multipart/form-data or application/json, got "${contentType}"`,
      );
    }

    // providerId is required from the client — no server-side store to fall back to
    const effectiveProviderId = providerId || ('unpdf' as PDFProviderId);
    resolvedProviderId = effectiveProviderId;

    const clientBaseUrl = baseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = await validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const config = {
      providerId: effectiveProviderId,
      apiKey: clientBaseUrl
        ? apiKey || ''
        : resolvePDFApiKey(effectiveProviderId, apiKey || undefined),
      baseUrl: clientBaseUrl
        ? clientBaseUrl
        : resolvePDFBaseUrl(effectiveProviderId, baseUrl || undefined),
    };

    // Parse PDF using the provider system
    const result = await parsePDF(config, buffer);

    // Add file metadata
    const resultWithMetadata: ParsedPdfContent = {
      ...result,
      metadata: {
        ...result.metadata,
        pageCount: result.metadata?.pageCount ?? 0, // Ensure pageCount is always a number
        fileName: pdfFileName ?? 'document.pdf',
        fileSize,
      },
    };

    if (uploadedBlobUrl) {
      try {
        await del(uploadedBlobUrl);
      } catch (cleanupError) {
        log.error(`Failed to delete uploaded PDF blob "${uploadedBlobUrl}":`, cleanupError);
      }
    }

    return apiSuccess({ data: resultWithMetadata });
  } catch (error) {
    log.error(
      `PDF parsing failed [provider=${resolvedProviderId ?? 'unknown'}, file="${pdfFileName ?? 'unknown'}"]:`,
      error,
    );
    return apiError('PARSE_FAILED', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}
