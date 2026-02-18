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
import type {
  ProjectCreate,
  Project,
  Quote,
  CheckContentQualityData,
} from '@/types'

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
  additionalInputs: string
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
    additionalInputs: '',
    platform: 'wordpress',
    clientType: 'new',
    files: [],
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Content quality check (AI) – show warning when content is vague/gibberish
  const [qualityResult, setQualityResult] = useState<CheckContentQualityData | null>(null)
  const [isCheckingQuality, setIsCheckingQuality] = useState(false)

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

  // Create project (shared logic after quality check or "submit anyway")
  const createProjectAndContinue = useCallback(async () => {
    const projectData: ProjectCreate = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      platform: formData.platform,
      ...(formData.additionalInputs.trim() ? { additional_instructions: formData.additionalInputs.trim() } : {}),
    }
    const project = await projectsService.create(projectData)
    if (formData.files.length > 0) {
      localStorage.setItem(
        `project_${project.id}_pending_files`,
        JSON.stringify(formData.files.map((f) => f.name))
      )
    }
    setCreatedProject(project)
    setShowEstimationUI(true)
    setQualityResult(null)
  }, [formData])

  // Handle form submission: run quality check first, then create if sufficient
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) return

      try {
        setIsCheckingQuality(true)
        setSubmitError(null)
        setQualityResult(null)

        const quality = await projectsService.checkContentQuality({
          project_name: formData.name.trim(),
          description: formData.description.trim(),
          additional_instructions: formData.additionalInputs.trim() || undefined,
        })

        if (quality.overall_sufficient) {
          setIsSubmitting(true)
          await createProjectAndContinue()
        } else {
          setQualityResult(quality)
        }
      } catch (err) {
        setSubmitError(null)
        const isTimeout =
          (err as { code?: string; message?: string })?.code === 'ECONNABORTED' ||
          /timeout/i.test(String((err as { message?: string })?.message ?? ''))
        const reason = isTimeout
          ? 'The check took too long (request timed out). Your content may be fine—create the project anyway or try again.'
          : 'The quality check could not be completed. You can create the project anyway or try again.'
        setQualityResult({
          overall_sufficient: false,
          score: 0,
          feedback: {
            project_name: [],
            description: [reason],
            additional_instructions: [],
          },
          suggested_improvements: isTimeout
            ? 'The server took too long to respond. This is usually temporary. You can create the project anyway; your description (cart page, payment page, home page) is sufficient for an estimate.'
            : 'The quality check could not be completed. You can create the project anyway or fix any issues and try again.',
        })
        console.error('Content quality check failed:', err)
      } finally {
        setIsCheckingQuality(false)
        setIsSubmitting(false)
      }
    },
    [formData, validateForm, createProjectAndContinue]
  )

  const dismissQualityWarning = useCallback(() => {
    setQualityResult(null)
  }, [])

  const handleCreateAnyway = useCallback(async () => {
    if (!validateForm()) return
    try {
      setIsSubmitting(true)
      setSubmitError(null)
      await createProjectAndContinue()
    } catch (err) {
      setSubmitError('Failed to create project. Please try again.')
      console.error('Failed to create project:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, createProjectAndContinue])

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

          {/* Content quality warning (AI detected vague/gibberish input, or check failed/timed out) */}
          {qualityResult && !qualityResult.overall_sufficient && (
            <div className="new-project-quality-warning" role="alert">
              <div className="new-project-quality-warning-header">
                <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                <span>
                  {qualityResult.suggested_improvements?.toLowerCase().includes('took too long') ||
                  qualityResult.suggested_improvements?.toLowerCase().includes('timed out')
                    ? 'Quality check timed out'
                    : 'Content may be too vague for an accurate estimate'}
                </span>
              </div>
              {qualityResult.score > 0 && (
                <p className="new-project-quality-warning-score">
                  Quality score: {qualityResult.score}/100
                </p>
              )}
              {qualityResult.suggested_improvements && (
                <p className="new-project-quality-warning-suggestion">
                  {qualityResult.suggested_improvements}
                </p>
              )}
              <div className="new-project-quality-warning-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={dismissQualityWarning}
                  disabled={isSubmitting}
                >
                  Improve content
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={handleCreateAnyway}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                >
                  Create project anyway
                </Button>
              </div>
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
                error={errors.name || (qualityResult?.feedback.project_name?.[0] ?? undefined)}
                disabled={isSubmitting || isCheckingQuality}
              />
              {qualityResult?.feedback.project_name?.map((msg, i) => (
                <span key={i} className="new-project-form-error new-project-form-quality-hint">
                  {msg}
                </span>
              ))}
            </div>

            {/* Project Description */}
            <div className="new-project-form-group">
              <Label className="new-project-form-label new-project-form-label-required">
                Project Description
              </Label>
              <textarea
                className={`input ${errors.description || qualityResult?.feedback.description?.length ? 'input-error' : ''}`}
                value={formData.description}
                onChange={handleChange('description')}
                placeholder="Describe the project requirements, goals, and any important details..."
                rows={5}
                disabled={isSubmitting || isCheckingQuality}
                style={{ resize: 'vertical', minHeight: '120px' }}
              />
              {errors.description && (
                <span className="new-project-form-error">{errors.description}</span>
              )}
              {qualityResult?.feedback.description?.map((msg, i) => (
                <span key={i} className="new-project-form-error new-project-form-quality-hint">
                  {msg}
                </span>
              ))}
              <p className="new-project-form-hint">
                This will be used to generate your AI-powered estimate.
              </p>
            </div>

            {/* Additional inputs (optional) */}
            <div className="new-project-form-group">
              <Label className="new-project-form-label">
                Additional inputs{' '}
                <span className="new-project-form-optional">(Optional)</span>
              </Label>
              <textarea
                className={`input ${qualityResult?.feedback.additional_instructions?.length ? 'input-error' : ''}`}
                value={formData.additionalInputs}
                onChange={handleChange('additionalInputs')}
                placeholder="Any extra details for the estimate: constraints, preferences, must-haves..."
                rows={3}
                disabled={isSubmitting || isCheckingQuality}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
              {qualityResult?.feedback.additional_instructions?.map((msg, i) => (
                <span key={i} className="new-project-form-error new-project-form-quality-hint">
                  {msg}
                </span>
              ))}
              <p className="new-project-form-hint">
                Optional. These will be used during estimation if provided.
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
                  accept=".pdf,.doc,.docx,.txt,.md,text/markdown,.png,.jpg,.jpeg,.gif,.xlsx,.xls"
                />
                <div className="new-project-upload">
                  <div className="new-project-upload-icon">
                    <CloudUpload style={{ width: 20, height: 20 }} />
                  </div>
                  <p className="new-project-upload-text">
                    <span>Click to upload</span> or drag and drop
                  </p>
                  <p className="new-project-upload-hint">
                    PDF, DOC, TXT, MD (Markdown), PNG, JPG (MAX 10MB EACH)
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
              <Button
                type="submit"
                isLoading={isSubmitting || isCheckingQuality}
                disabled={isSubmitting || isCheckingQuality}
              >
                {isCheckingQuality ? 'Checking content...' : 'Create Project'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default NewProjectPage
