import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsService } from '@/services';
import type { ProjectCreate } from '@/types';

type Platform = 'wordpress';

export interface ProjectFormData {
  name: string;
  description: string;
  additional_instructions: string;
  platform: Platform;
  files: File[];
}

export interface ProjectFormErrors {
  name?: string;
  description?: string;
  additional_instructions?: string;
  platform?: string;
}

const INITIAL_FORM_DATA: ProjectFormData = {
  name: '',
  description: '',
  additional_instructions: '',
  platform: 'wordpress',
  files: [],
};

export function useProjectForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const validateForm = useCallback((): boolean => {
    const newErrors: ProjectFormErrors = {};

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

  const handleChange = useCallback(
    (field: keyof ProjectFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
        if (errors[field as keyof ProjectFormErrors]) {
          setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
      },
    [errors],
  );

  const handlePlatformSelect = useCallback(
    (platform: Platform) => {
      setFormData((prev) => ({ ...prev, platform }));
      setIsPlatformOpen(false);
      if (errors.platform) {
        setErrors((prev) => ({ ...prev, platform: undefined }));
      }
    },
    [errors.platform],
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFormData((prev) => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
    }
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;

      try {
        setIsSubmitting(true);
        setSubmitError(null);

        const projectData: ProjectCreate = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          additional_instructions: formData.additional_instructions.trim() || undefined,
          platform: formData.platform,
        };

        const project = await projectsService.create(projectData);

        if (formData.files.length > 0) {
          setIsUploadingFiles(true);
          localStorage.setItem(
            `project_${project.id}_pending_files`,
            JSON.stringify(formData.files.map((f) => f.name)),
          );
        }

        navigate(`/projects/${project.id}?tab=chat`, { replace: true });
      } catch (err) {
        setSubmitError('Failed to create project. Please try again.');
        console.error('Failed to create project:', err);
      } finally {
        setIsSubmitting(false);
        setIsUploadingFiles(false);
      }
    },
    [formData, validateForm, navigate],
  );

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isSubmitting,
    submitError,
    isPlatformOpen,
    setIsPlatformOpen,
    isUploadingFiles,
    handleChange,
    handlePlatformSelect,
    handleFileChange,
    handleRemoveFile,
    handleSubmit,
  };
}
