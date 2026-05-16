'use client';

import type { PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { buildPdfUploadPath, PDF_BLOB_ACCESS } from '@/lib/constants/upload';

type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

export async function uploadPdfToBlob(
  file: File,
  sessionId: string,
  onUploadProgress?: (progress: UploadProgress) => void,
): Promise<PutBlobResult> {
  return upload(buildPdfUploadPath(sessionId, file.name), file, {
    access: PDF_BLOB_ACCESS,
    contentType: file.type || 'application/pdf',
    handleUploadUrl: '/api/pdf-upload',
    multipart: true,
    onUploadProgress,
  });
}
