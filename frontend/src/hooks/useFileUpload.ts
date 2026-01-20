/**
 * Custom hook for file upload functionality
 * Provides state management and upload logic for drag-and-drop file uploads
 */

import { useState, useCallback } from 'react';
import { uploadService } from '../services/upload.service';
import {
  FileWithPreview,
  FileRecord,
  UploadMetadata,
  validateFile,
  DEFAULT_ACCEPTED_FILES,
} from '../types/file.types';

interface UseFileUploadOptions {
  projectId: string;
  category?: 'requirements' | 'reference' | 'export';
  maxFiles?: number;
  onUploadComplete?: (records: FileRecord[]) => void;
  onError?: (error: string) => void;
}

interface UseFileUploadReturn {
  files: FileWithPreview[];
  uploadedRecords: FileRecord[];
  isUploading: boolean;
  totalProgress: number;
  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  retryUpload: (index: number) => Promise<void>;
}

export function useFileUpload({
  projectId,
  category = 'requirements',
  maxFiles = DEFAULT_ACCEPTED_FILES.maxFiles,
  onUploadComplete,
  onError,
}: UseFileUploadOptions): UseFileUploadReturn {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadedRecords, setUploadedRecords] = useState<FileRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Calculate total progress across all files
  const totalProgress =
    files.length > 0
      ? Math.round(
          files.reduce((sum, f) => sum + (f.uploadProgress || 0), 0) / files.length
        )
      : 0;

  /**
   * Add and upload new files
   */
  const addFiles = useCallback(
    async (newFiles: File[]) => {
      // Validate each file
      const validFiles: File[] = [];
      const currentCount = files.filter((f) => !f.error).length;

      for (const file of newFiles) {
        const validation = validateFile(file, DEFAULT_ACCEPTED_FILES, currentCount + validFiles.length);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          onError?.(validation.error || 'Invalid file');
        }
      }

      // Check max files limit
      if (currentCount + validFiles.length > maxFiles) {
        const allowed = maxFiles - currentCount;
        if (allowed <= 0) {
          onError?.(`Maximum of ${maxFiles} files allowed`);
          return;
        }
        onError?.(`Only ${allowed} more file(s) allowed. Some files were not added.`);
        validFiles.splice(allowed);
      }

      if (validFiles.length === 0) return;

      // Create preview objects for valid files
      const filesWithPreview: FileWithPreview[] = validFiles.map((file) => {
        const fileWithPreview = file as FileWithPreview;
        fileWithPreview.preview = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined;
        fileWithPreview.uploadProgress = 0;
        return fileWithPreview;
      });

      // Add to state
      setFiles((prev) => [...prev, ...filesWithPreview]);
      setIsUploading(true);

      // Upload files
      const metadata: UploadMetadata = { projectId, category };
      const newRecords: FileRecord[] = [];

      for (let i = 0; i < filesWithPreview.length; i++) {
        const file = filesWithPreview[i];
        const fileIndex = files.length + i;

        try {
          const record = await uploadService.uploadFile(
            file,
            metadata,
            (progress) => {
              // Update progress for this file
              setFiles((prev) => {
                const updated = [...prev];
                const idx = prev.findIndex((f) => f === file);
                if (idx !== -1) {
                  updated[idx] = { ...updated[idx], uploadProgress: progress };
                }
                return updated;
              });
            }
          );

          // Update file with uploaded record
          setFiles((prev) => {
            const updated = [...prev];
            const idx = prev.findIndex((f) => f === file);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                uploadProgress: 100,
                uploadedRecord: record,
              };
            }
            return updated;
          });

          newRecords.push(record);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';

          // Update file with error
          setFiles((prev) => {
            const updated = [...prev];
            const idx = prev.findIndex((f) => f === file);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                error: errorMessage,
              };
            }
            return updated;
          });

          onError?.(errorMessage);
        }
      }

      setIsUploading(false);
      setUploadedRecords((prev) => [...prev, ...newRecords]);

      if (newRecords.length > 0) {
        onUploadComplete?.(newRecords);
      }
    },
    [files.length, maxFiles, projectId, category, onUploadComplete, onError]
  );

  /**
   * Remove a file from the list
   */
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];

      // Revoke preview URL to free memory
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }

      // Remove from uploaded records if it was uploaded
      if (removed.uploadedRecord) {
        setUploadedRecords((records) =>
          records.filter((r) => r.id !== removed.uploadedRecord?.id)
        );
      }

      return newFiles;
    });
  }, []);

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    // Revoke all preview URLs
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    setFiles([]);
    setUploadedRecords([]);
  }, [files]);

  /**
   * Retry uploading a failed file
   */
  const retryUpload = useCallback(
    async (index: number) => {
      const file = files[index];
      if (!file || !file.error) return;

      // Reset error and progress
      setFiles((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          error: undefined,
          uploadProgress: 0,
        };
        return updated;
      });

      setIsUploading(true);

      try {
        const metadata: UploadMetadata = { projectId, category };
        const record = await uploadService.uploadFile(
          file,
          metadata,
          (progress) => {
            setFiles((prev) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], uploadProgress: progress };
              return updated;
            });
          }
        );

        setFiles((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            uploadProgress: 100,
            uploadedRecord: record,
          };
          return updated;
        });

        setUploadedRecords((prev) => [...prev, record]);
        onUploadComplete?.([record]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setFiles((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], error: errorMessage };
          return updated;
        });
        onError?.(errorMessage);
      }

      setIsUploading(false);
    },
    [files, projectId, category, onUploadComplete, onError]
  );

  return {
    files,
    uploadedRecords,
    isUploading,
    totalProgress,
    addFiles,
    removeFile,
    clearFiles,
    retryUpload,
  };
}

export default useFileUpload;
