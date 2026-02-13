/**
 * NewProject Page
 * 
 * Two-column layout matching Stitch reference design.
 * Uses centralized CSS classes from styles/pages.css
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  CloudUpload,
  X,
  FileIcon,
  Users,
  Globe,
  Sparkles,
} from 'lucide-react'
import { projectsService } from '@/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { EstimationGenerationUI } from '@/components/estimate'
import type { ProjectCreate, Project, Quote } from '@/types'

// Platform type
type Platform = 'wordpress'

// Platform options
const PLATFORMS = [
  { value: 'wordpress', label: 'WordPress' },
]

// Client type options
const CLIENT_TYPES = [
  { value: 'new', label: 'New Client' },
  { value: 'existing', label: 'Existing Client' },
]

interface FormData {
  name: string
  description: string
  platform: Platform
  clientType: 'new' | 'existing'
  files: File[]
}

interface FormErrors {
  name?: string
  description?: string
  platform?: string
}

// Steps data
const STEPS = [
  {
    title: 'Project Details',
    desc: 'Tell us about your project goals and scope.',
  },
  {
    title: 'Supporting Assets',
    desc: 'Upload any reference files or brand guidelines.',
  },
  {
    title: 'AI Generation',
    desc: "We'll craft a comprehensive estimate automatically.",
  },
]

export function NewProjectPage() {
  const navigate = useNavigate()

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    platform: 'wordpress',
    clientType: 'new',
    files: [],
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  // Estimation generation state
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const [showEstimationUI, setShowEstimationUI] = useState(false)

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Project name must be at least 2 characters'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Project description is required'
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }

    if (!formData.platform) {
      newErrors.platform = 'Target platform is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  // Handle input changes
  const handleChange = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }))
        if (errors[field as keyof FormErrors]) {
          setErrors((prev) => ({ ...prev, [field]: undefined }))
        }
      },
    [errors]
  )

  // Handle select changes
  const handleSelectChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length > 0) {
        setFormData((prev) => ({
          ...prev,
          files: [...prev.files, ...selectedFiles],
        }))
      }
      e.target.value = ''
    },
    []
  )

  // Handle file removal
  const handleRemoveFile = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }))
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) return

      try {
        setIsSubmitting(true)
        setSubmitError(null)

        const projectData: ProjectCreate = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          platform: formData.platform,
        }

        const project = await projectsService.create(projectData)

        // Store file references for later upload
        if (formData.files.length > 0) {
          localStorage.setItem(
            `project_${project.id}_pending_files`,
            JSON.stringify(formData.files.map((f) => f.name))
          )
        }

        // Show estimation generation UI
        setCreatedProject(project)
        setShowEstimationUI(true)
      } catch (err) {
        setSubmitError('Failed to create project. Please try again.')
        console.error('Failed to create project:', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [formData, validateForm]
  )

  // Handle estimation complete
  const handleEstimationComplete = useCallback(
    (quote: Quote) => {
      if (createdProject) {
        navigate(`/projects/${createdProject.id}`, { replace: true })
      }
    },
    [createdProject, navigate]
  )

  // Handle estimation cancel
  const handleEstimationCancel = useCallback(() => {
    if (createdProject) {
      // Navigate to project without estimate
      navigate(`/projects/${createdProject.id}`, { replace: true })
    } else {
      setShowEstimationUI(false)
    }
  }, [createdProject, navigate])

  // Show estimation generation UI when project is created
  if (showEstimationUI && createdProject) {
    return (
      <EstimationGenerationUI
        project={createdProject}
        onComplete={handleEstimationComplete}
        onCancel={handleEstimationCancel}
      />
    )
  }

  return (
    <div className="new-project-page">
      {/* Back Button */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault()
          navigate('/projects')
        }}
        className="new-project-back"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Back to Projects
      </a>

      {/* Two Column Layout */}
      <div className="new-project-layout">
        {/* Left Sidebar */}
        <aside className="new-project-sidebar">
          {/* Header */}
          <div className="new-project-header">
            <h1 className="new-project-title">Create New Project</h1>
            <p className="new-project-subtitle">
              Enter project details to start generating your estimate. Our AI will handle the rest.
            </p>
          </div>

          {/* AI Tip */}
          <div className="new-project-ai-tip">
            <div className="new-project-ai-tip-icon">
              <Sparkles style={{ width: 14, height: 14 }} />
            </div>
            <p className="new-project-ai-tip-text">
              <strong>Pro tip:</strong> Detailed descriptions improve estimate accuracy by <span className="new-project-ai-tip-highlight">31%</span>
            </p>
          </div>

          {/* Stepper */}
          <div className="new-project-stepper">
            <span className="new-project-stepper-label">What happens next</span>
            {STEPS.map((step, index) => (
              <div key={index} className="new-project-step">
                <div className="new-project-step-number">{index + 1}</div>
                <div className="new-project-step-content">
                  <p className="new-project-step-title">{step.title}</p>
                  <p className="new-project-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Form Card */}
        <div className="new-project-form-card">
          {/* Form Header */}
          <div className="new-project-form-header">
            <h2 className="new-project-form-title">Project Details</h2>
            <p className="new-project-form-subtitle">
              Fill in the required information below to get started.
            </p>
          </div>

          {/* Error Alert */}
          {submitError && (
            <div className="new-project-error">
              <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="new-project-form">
            {/* Project Name */}
            <div className="new-project-form-group">
              <Label className="new-project-form-label new-project-form-label-required">
                Project Name
              </Label>
              <Input
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="Enter your project name"
                error={errors.name}
                disabled={isSubmitting}
              />
            </div>

            {/* Project Description */}
            <div className="new-project-form-group">
              <Label className="new-project-form-label new-project-form-label-required">
                Project Description
              </Label>
              <textarea
                className={`input ${errors.description ? 'input-error' : ''}`}
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Describe the project requirements, goals, and any important details..."
                rows={5}
                disabled={isSubmitting}
                style={{ resize: 'vertical', minHeight: '120px' }}
              />
              {errors.description && (
                <span className="new-project-form-error">{errors.description}</span>
              )}
              <p className="new-project-form-hint">
                This will be used to generate your AI-powered estimate.
              </p>
            </div>

            {/* Client Type and Platform Row */}
            <div className="new-project-form-row">
              <div className="new-project-form-group">
                <Label className="new-project-form-label">Client Type</Label>
                <NativeSelect
                  value={formData.clientType}
                  onChange={handleSelectChange('clientType')}
                  options={CLIENT_TYPES}
                  disabled={isSubmitting}
                  icon={<Users style={{ width: 16, height: 16, color: 'var(--color-gray-400)' }} />}
                />
              </div>
              <div className="new-project-form-group">
                <Label className="new-project-form-label new-project-form-label-required">
                  Target Platform
                </Label>
                <NativeSelect
                  value={formData.platform}
                  onChange={handleSelectChange('platform')}
                  options={PLATFORMS}
                  disabled={isSubmitting}
                  error={errors.platform}
                  icon={<Globe style={{ width: 16, height: 16, color: 'var(--color-primary-500)' }} />}
                />
              </div>
            </div>

            {/* Supporting Files */}
            <div className="new-project-form-group">
              <Label className="new-project-form-label">
                Supporting Files{' '}
                <span className="new-project-form-optional">(Optional)</span>
              </Label>

              {/* File Upload Zone */}
              <div className="new-project-upload-wrapper">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="new-project-upload-input"
                  disabled={isSubmitting}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.xlsx,.xls"
                />
                <div className="new-project-upload">
                  <div className="new-project-upload-icon">
                    <CloudUpload style={{ width: 20, height: 20 }} />
                  </div>
                  <p className="new-project-upload-text">
                    <span>Click to upload</span> or drag and drop
                  </p>
                  <p className="new-project-upload-hint">
                    PDF, DOC, PNG, JPG (MAX 10MB EACH)
                  </p>
                </div>
              </div>

              {/* File List */}
              {formData.files.length > 0 && (
                <div className="new-project-file-list">
                  {formData.files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="new-project-file-item">
                      <div className="new-project-file-info">
                        <div className="new-project-file-icon">
                          <FileIcon style={{ width: 16, height: 16, color: 'var(--color-gray-500)' }} />
                        </div>
                        <div>
                          <p className="new-project-file-name">{file.name}</p>
                          <p className="new-project-file-size">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="new-project-file-remove"
                        disabled={isSubmitting}
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="new-project-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/projects')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Create Project
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default NewProjectPage
