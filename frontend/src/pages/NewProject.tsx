/**
 * NewProject Page
 * Form to create a new project with exactly 4 fields:
 * - Project Name (required)
 * - Project Description (required)
 * - Files (optional)
 * - Target Platform (required)
 *
 * After submission, navigates to chat where AI auto-initiates analysis
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  FileText,
  Upload,
  X,
  File,
  Loader2,
} from 'lucide-react';
import { projectsService } from '@/services';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ProjectCreate } from '@/types';
import '@/styles/projects.css';

// Platform type
type Platform = 'wordpress' | 'shopify' | 'woocommerce' | 'custom';

// Platform options - exactly as specified
const PLATFORMS: Array<{ value: Platform; label: string; description: string }> = [
  { value: 'wordpress', label: 'WordPress', description: 'Content management and blogging' },
  { value: 'shopify', label: 'Shopify', description: 'Hosted e-commerce platform' },
  { value: 'woocommerce', label: 'WooCommerce', description: 'WordPress e-commerce plugin' },
  { value: 'custom', label: 'Custom', description: 'React, Vue, Angular, Magento, or other frameworks' },
];

interface FormData {
  name: string;
  description: string;
  platform: Platform;
  files: File[];
}

interface FormErrors {
  name?: string;
  description?: string;
  platform?: string;
}

export function NewProjectPage() {
  const navigate = useNavigate();

  // Form state - exactly 4 fields as specified
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    platform: 'wordpress',
    files: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Project description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Project description must be at least 10 characters';
    }

    if (!formData.platform) {
      newErrors.platform = 'Target platform is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle input changes
  const handleChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      // Clear error when user starts typing
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // Handle platform selection
  const handlePlatformSelect = useCallback((platform: Platform) => {
    setFormData((prev) => ({ ...prev, platform }));
    setIsPlatformOpen(false);
    if (errors.platform) {
      setErrors((prev) => ({ ...prev, platform: undefined }));
    }
  }, [errors.platform]);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...selectedFiles],
      }));
    }
    // Reset input
    e.target.value = '';
  }, []);

  // Handle file removal
  const handleRemoveFile = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) return;

      try {
        setIsSubmitting(true);
        setSubmitError(null);

        // Create project with all 4 fields
        const projectData: ProjectCreate = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          platform: formData.platform,
        };

        const project = await projectsService.create(projectData);

        // Upload files if any (optional field)
        if (formData.files.length > 0) {
          setIsUploadingFiles(true);
          // Files will be uploaded separately via the file upload service
          // For now, store them in localStorage to be processed in the chat
          localStorage.setItem(
            `project_${project.id}_pending_files`,
            JSON.stringify(formData.files.map(f => f.name))
          );
        }

        // Navigate directly to chat tab - AI will auto-initiate
        // The project details are automatically passed to chat context
        navigate(`/projects/${project.id}?tab=chat`, { replace: true });
      } catch (err) {
        setSubmitError('Failed to create project. Please try again.');
        console.error('Failed to create project:', err);
      } finally {
        setIsSubmitting(false);
        setIsUploadingFiles(false);
      }
    },
    [formData, validateForm, navigate]
  );

  // Get selected platform
  const selectedPlatform = PLATFORMS.find((p) => p.value === formData.platform);

  return (
    <div className="new-project-page">
      {/* Back Button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-500 mt-1">
          Enter project details to start generating your estimate
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl shadow-sm">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <FolderPlus className="h-5 w-5 text-primary-600" />
              </div>
              Project Details
            </CardTitle>
            <CardDescription className="mt-2">
              Provide the required information for your project
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-8">
            {/* Submit Error */}
            {submitError && (
              <div className="flex items-center gap-3 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Field 1: Project Name (required) */}
            <Input
              label="Project Name *"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="Enter project name"
              error={errors.name}
              disabled={isSubmitting}
            />

            {/* Field 2: Project Description (required) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Description *
              </label>
              <textarea
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Describe the project requirements, goals, and any important details..."
                rows={6}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all disabled:bg-gray-50 disabled:opacity-50',
                  errors.description ? 'border-error-300' : 'border-gray-300'
                )}
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="mt-1.5 text-sm text-error-600">{errors.description}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Provide a clear description of what the project involves. This will be used to generate your estimate.
              </p>
            </div>

            {/* Field 3: Files (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supporting Files <span className="text-gray-400">(Optional)</span>
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Upload screenshots, mockups, diagrams, or requirement documents
              </p>

              {/* File Drop Zone */}
              <div className="relative">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isSubmitting}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.xlsx,.xls"
                />
                <div className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                  isSubmitting ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                )}>
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-primary-600">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, DOC, DOCX, TXT, PNG, JPG, XLSX (Max 10MB each)
                  </p>
                </div>
              </div>

              {/* File List */}
              {formData.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {formData.files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <File className="h-5 w-5 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 text-gray-400 hover:text-error-600 transition-colors"
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Field 4: Target Platform (required) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Platform *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlatformOpen(!isPlatformOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200',
                    errors.platform ? 'border-error-300' : 'border-gray-300 hover:border-gray-400',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={isSubmitting}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      <FileText className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-gray-900">
                        {selectedPlatform?.label}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedPlatform?.description}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-gray-400 transition-transform duration-200',
                      isPlatformOpen && 'rotate-180'
                    )}
                  />
                </button>

                {/* Platform Dropdown */}
                {isPlatformOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsPlatformOpen(false)}
                    />
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                      {PLATFORMS.map((p, index) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => handlePlatformSelect(p.value)}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3',
                            p.value === formData.platform && 'bg-primary-50',
                            index !== PLATFORMS.length - 1 && 'border-b border-gray-100'
                          )}
                        >
                          <div className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg',
                            p.value === formData.platform ? 'bg-primary-100' : 'bg-gray-100'
                          )}>
                            <FileText className={cn(
                              'h-4 w-4',
                              p.value === formData.platform ? 'text-primary-600' : 'text-gray-500'
                            )} />
                          </div>
                          <div>
                            <span className={cn(
                              'font-medium',
                              p.value === formData.platform ? 'text-primary-700' : 'text-gray-900'
                            )}>{p.label}</span>
                            <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {errors.platform && (
                <p className="mt-1.5 text-sm text-error-600">{errors.platform}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/projects')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting || isUploadingFiles}>
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading Files...
                  </>
                ) : isSubmitting ? (
                  'Creating...'
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export default NewProjectPage;
