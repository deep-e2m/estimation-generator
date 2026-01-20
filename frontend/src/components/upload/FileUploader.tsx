/**
 * FileUploader Component
 * Drag-and-drop file upload with progress tracking
 * Supports images and documents for requirements input
 */

import React, { useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload, X, FileText, Image, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FileWithPreview, formatFileSize, DEFAULT_ACCEPTED_FILES } from '../../types/file.types';

interface FileUploaderProps {
  files: FileWithPreview[];
  isUploading: boolean;
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onRetry?: (index: number) => void;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  isUploading,
  onFilesAdd,
  onFileRemove,
  onRetry,
  disabled = false,
  className,
  maxFiles = DEFAULT_ACCEPTED_FILES.maxFiles,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!disabled && !isUploading) {
        onFilesAdd(acceptedFiles);
      }
    },
    [disabled, isUploading, onFilesAdd]
  );

  // Configure accepted file types
  const accept: Accept = {
    'image/*': DEFAULT_ACCEPTED_FILES.images,
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize: 25 * 1024 * 1024, // 25MB max
    maxFiles: maxFiles - files.length,
    disabled: disabled || isUploading || files.length >= maxFiles,
  });

  const isDisabled = disabled || isUploading || files.length >= maxFiles;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200',
          isDragActive && !isDragReject && 'border-blue-500 bg-blue-50/50',
          isDragReject && 'border-red-500 bg-red-50/50',
          !isDragActive && !isDisabled && 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30',
          isDisabled && 'opacity-50 cursor-not-allowed bg-gray-50'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full transition-colors',
            isDragActive && !isDragReject && 'bg-blue-100',
            isDragReject && 'bg-red-100',
            !isDragActive && 'bg-gray-100'
          )}>
            <Upload
              className={cn(
                'h-8 w-8',
                isDragActive && !isDragReject && 'text-blue-600',
                isDragReject && 'text-red-600',
                !isDragActive && 'text-gray-500'
              )}
            />
          </div>

          {isDragActive && !isDragReject ? (
            <p className="text-lg font-semibold text-blue-700">Drop files here...</p>
          ) : isDragReject ? (
            <p className="text-lg font-semibold text-red-700">Invalid file type</p>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-900">
                Drag and drop files here
              </p>
              <p className="text-sm text-gray-500">
                or <span className="text-primary-600 font-medium">click to browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Images (PNG, JPG, GIF, WebP) up to 10MB
                <br />
                Documents (PDF, DOCX, TXT, MD) up to 25MB
                <br />
                Maximum {maxFiles} files
              </p>
            </div>
          )}

          {files.length > 0 && (
            <p className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {files.length} of {maxFiles} files uploaded
            </p>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <FileListItem
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => onFileRemove(index)}
              onRetry={onRetry ? () => onRetry(index) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Individual file list item component
 */
interface FileListItemProps {
  file: FileWithPreview;
  onRemove: () => void;
  onRetry?: () => void;
}

const FileListItem: React.FC<FileListItemProps> = ({ file, onRemove, onRetry }) => {
  const isImage = file.type.startsWith('image/');
  const hasError = !!file.error;
  const isUploading = file.uploadProgress !== undefined && file.uploadProgress < 100 && !hasError;
  const isComplete = file.uploadedRecord !== undefined;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border rounded-xl transition-all duration-200',
        hasError && 'border-red-300 bg-red-50',
        isComplete && !hasError && 'border-green-200 bg-green-50/50',
        !hasError && !isComplete && 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      )}
    >
      {/* Thumbnail or Icon */}
      <div className="flex-shrink-0">
        {isImage && file.preview ? (
          <img
            src={file.preview}
            alt={file.name}
            className="h-12 w-12 object-cover rounded-lg"
          />
        ) : (
          <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded-lg">
            <FileText className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(file.size)}</p>

        {/* Progress Bar */}
        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${file.uploadProgress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {hasError && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{file.error}</p>
          </div>
        )}

        {/* Success Indicator */}
        {isComplete && !hasError && (
          <p className="text-xs text-green-600 font-medium mt-1.5">Uploaded successfully</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {/* Retry Button */}
        {hasError && onRetry && (
          <button
            onClick={onRetry}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            title="Retry upload"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          title="Remove file"
          type="button"
          disabled={isUploading}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default FileUploader;
