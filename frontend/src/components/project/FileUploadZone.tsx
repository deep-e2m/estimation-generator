import React from 'react';
import { Upload, File, FileText, Image, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  files: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  isSubmitting: boolean;
}

// Helper function to get file icon based on file type
function getFileIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-error-600" />;
    case 'md':
      return <FileText className="h-5 w-5 text-primary-600" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return <Image className="h-5 w-5 text-primary-600" />;
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet className="h-5 w-5 text-success-600" />;
    case 'doc':
    case 'docx':
    case 'md':
      return <FileText className="h-5 w-5 text-primary-600" />;
    default:
      return <File className="h-5 w-5 text-gray-400" />;
  }
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileUploadZone({
  files,
  onFileChange,
  onRemoveFile,
  isSubmitting,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isSubmitting) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    // Create a synthetic event to pass to onFileChange
    const syntheticEvent = {
      target: { files: e.dataTransfer.files },
    } as React.ChangeEvent<HTMLInputElement>;

    onFileChange(syntheticEvent);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Supporting Files <span className="text-gray-400">(Optional)</span>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Upload screenshots, mockups, diagrams, or requirement documents
      </p>

      {/* File Drop Zone */}
      <div
        className="relative"
        role="button"
        aria-label="Upload files"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          onChange={onFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isSubmitting}
          accept=".pdf,.doc,.docx,.txt,.md,text/markdown,.png,.jpg,.jpeg,.gif,.xlsx,.xls"
          aria-label="Choose files to upload"
        />
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
            isSubmitting
              ? 'border-gray-200 bg-gray-50'
              : isDragOver
              ? 'border-primary-400 bg-primary-50 scale-[1.02] shadow-sm'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          )}
        >
          <Upload
            className={cn(
              'h-8 w-8 mx-auto mb-3 transition-all duration-200',
              isDragOver ? 'text-primary-600 scale-110' : 'text-gray-400',
            )}
          />
          {isDragOver ? (
            <p className="text-sm font-medium text-primary-700 animate-fade-in">
              Drop files here
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-primary-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, DOC, DOCX, TXT, MD (Markdown), PNG, JPG, XLSX (Max 10MB each)
              </p>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 animate-fade-in"
            >
              {/* File type icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shrink-0">
                {getFileIcon(file.name)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="p-2 hover:bg-error-50 rounded-lg transition-colors shrink-0"
                disabled={isSubmitting}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4 text-gray-400 hover:text-error-600 transition-colors" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
