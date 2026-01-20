/**
 * File upload related type definitions
 */

// File category for organization
export type FileCategory = 'requirements' | 'reference' | 'export';

// Storage provider types
export type StorageProvider = 'database' | 's3';

// Upload metadata for requests
export interface UploadMetadata {
  projectId: string;
  category: FileCategory;
  description?: string;
}

// File record returned from API
export interface FileRecord {
  id: string;
  filename: string;
  original_filename?: string;
  content_type: string;
  file_size: number;
  storage_provider: StorageProvider;
  download_url: string;
  thumbnail_url?: string;
  project_id?: string;
  uploaded_by?: {
    id: string;
    full_name: string;
  };
  created_at: string;
}

// File with local preview data (before upload)
export interface FileWithPreview extends File {
  preview?: string;
  uploadProgress?: number;
  uploadedRecord?: FileRecord;
  error?: string;
}

// Upload progress callback type
export type UploadProgressCallback = (progress: number) => void;

// Accepted file types configuration
export interface AcceptedFileTypes {
  images: string[];
  documents: string[];
  maxImageSize: number;
  maxDocumentSize: number;
  maxFiles: number;
}

// Default accepted file types
export const DEFAULT_ACCEPTED_FILES: AcceptedFileTypes = {
  images: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md'],
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxDocumentSize: 25 * 1024 * 1024, // 25MB
  maxFiles: 10,
};

// File validation result
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'FILE_TOO_LARGE' | 'FILE_TYPE_NOT_ALLOWED' | 'TOO_MANY_FILES';
}

// Validate file against constraints
export function validateFile(
  file: File,
  acceptedTypes: AcceptedFileTypes = DEFAULT_ACCEPTED_FILES,
  currentFileCount: number = 0
): FileValidationResult {
  // Check file count
  if (currentFileCount >= acceptedTypes.maxFiles) {
    return {
      valid: false,
      error: `Maximum of ${acceptedTypes.maxFiles} files allowed`,
      errorCode: 'TOO_MANY_FILES',
    };
  }

  // Get file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const isImage = acceptedTypes.images.includes(extension);
  const isDocument = acceptedTypes.documents.includes(extension);

  // Check file type
  if (!isImage && !isDocument) {
    return {
      valid: false,
      error: `File type "${extension}" is not supported`,
      errorCode: 'FILE_TYPE_NOT_ALLOWED',
    };
  }

  // Check file size
  const maxSize = isImage ? acceptedTypes.maxImageSize : acceptedTypes.maxDocumentSize;
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxSizeMB}MB`,
      errorCode: 'FILE_TOO_LARGE',
    };
  }

  return { valid: true };
}

// Get file type category
export function getFileCategory(file: File): 'image' | 'document' | 'unknown' {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();

  if (DEFAULT_ACCEPTED_FILES.images.includes(extension)) {
    return 'image';
  }

  if (DEFAULT_ACCEPTED_FILES.documents.includes(extension)) {
    return 'document';
  }

  return 'unknown';
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}
