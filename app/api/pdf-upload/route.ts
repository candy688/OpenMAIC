import { type HandleUploadBody, handleUpload } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  DIRECT_PDF_UPLOAD_ENABLED,
  isAllowedPdfUploadPath,
  MAX_PDF_SIZE_BYTES,
} from '@/lib/constants/upload';
import { apiError } from '@/lib/server/api-response';

const log = createLogger('PDF Upload');
const CLIENT_TOKEN_TTL_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!DIRECT_PDF_UPLOAD_ENABLED) {
    return apiError('INVALID_REQUEST', 503, 'Direct PDF uploads are not enabled');
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return apiError('INTERNAL_ERROR', 503, 'Blob storage is not configured');
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid upload payload');
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedPdfUploadPath(pathname)) {
          throw new Error('Invalid PDF upload path');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_PDF_SIZE_BYTES,
          validUntil: Date.now() + CLIENT_TOKEN_TTL_MS,
          addRandomSuffix: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF upload failed';
    log.error('Failed to handle PDF upload request:', error);
    return apiError(
      message === 'Invalid PDF upload path' ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
      message === 'Invalid PDF upload path' ? 400 : 500,
      message,
    );
  }
}
