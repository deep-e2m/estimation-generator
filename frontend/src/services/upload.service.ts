/**
 * File Upload Service
 * Handles file uploads with progress tracking
 */

import { apiClient, createMultipartConfig } from './api';
import type { FileRecord, UploadMetadata, UploadProgressCallback } from '../types/file.types';

class UploadService {
  /**
   * Upload a single file to the server
   * @param file - File to upload
   * @param metadata - Upload metadata (project ID, category, description)
   * @param onProgress - Optional progress callback
   * @returns Promise with uploaded file record
   */
  async uploadFile(
    file: File,
    metadata: UploadMetadata,
    onProgress?: UploadProgressCallback
  ): Promise<FileRecord> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', metadata.projectId);
    formData.append('category', metadata.category);

    if (metadata.description) {
      formData.append('description', metadata.description);
    }

    const response = await apiClient.post<{ success: boolean; data: FileRecord }>(
      '/api/v1/files/upload',
      formData,
      createMultipartConfig(onProgress)
    );

    return response.data.data;
  }

  /**
   * Upload multiple files sequentially with individual progress tracking
   * @param files - Array of files to upload
   * @param metadata - Upload metadata
   * @param onFileProgress - Callback for individual file progress
   * @param onFileComplete - Callback when a file completes
   * @returns Promise with array of uploaded file records
   */
  async uploadMultipleFiles(
    files: File[],
    metadata: UploadMetadata,
    onFileProgress?: (fileIndex: number, progress: number) => void,
    onFileComplete?: (fileIndex: number, record: FileRecord) => void
  ): Promise<FileRecord[]> {
    const results: FileRecord[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const record = await this.uploadFile(
        file,
        metadata,
        onFileProgress ? (progress) => onFileProgress(i, progress) : undefined
      );
      results.push(record);
      onFileComplete?.(i, record);
    }

    return results;
  }

  /**
   * Get a signed URL for downloading a file
   * @param fileId - File ID
   * @returns Promise with download URL
   */
  async getFileUrl(fileId: string): Promise<string> {
    const response = await apiClient.get<{ success: boolean; data: { url: string } }>(
      `/api/v1/files/${fileId}/url`
    );
    return response.data.data.url;
  }

  /**
   * Delete a file
   * @param fileId - File ID to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/api/v1/files/${fileId}`);
  }

  /**
   * Get file metadata
   * @param fileId - File ID
   * @returns Promise with file record
   */
  async getFileMetadata(fileId: string): Promise<FileRecord> {
    const response = await apiClient.get<{ success: boolean; data: FileRecord }>(
      `/api/v1/files/${fileId}`
    );
    return response.data.data;
  }

  /**
   * List files for a project
   * @param projectId - Project ID
   * @param category - Optional category filter
   * @returns Promise with array of file records
   */
  async listProjectFiles(
    projectId: string,
    category?: string
  ): Promise<FileRecord[]> {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }

    const response = await apiClient.get<{
      success: boolean;
      data: FileRecord[];
    }>(`/api/v1/projects/${projectId}/files?${params.toString()}`);

    return response.data.data;
  }
}

export const uploadService = new UploadService();
export default uploadService;
