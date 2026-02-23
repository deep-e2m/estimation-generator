/**
 * Register Page
 * 
 * Uses centralized CSS classes from styles/pages.css
 * Features animated branding with Framer Motion
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { useAuthStore } from '@/store/authStore'

// Form validation schema
const registerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function Register() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const registerUser = useAuthStore((state) => state.register)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError(null)

    try {
      await registerUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      })
      toast.success('Account created successfully')
      navigate('/dashboard', { replace: true })
    } catch {
      const message = useAuthStore.getState().error || 'Registration failed. Please try again.'
      setError(message)
      toast.error(message, { duration: 5000 })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Left side - Branding */}
      <div className="auth-branding">
        {/* Decorative elements */}
        <div className="auth-branding-decor">
          <div className="auth-branding-blur-1" />
          <div className="auth-branding-blur-2" />
          <div className="auth-branding-circle auth-branding-circle-1" />
          <div className="auth-branding-circle auth-branding-circle-2" />
          <div className="auth-branding-circle auth-branding-circle-3" />
        </div>

        {/* Centered branding content */}
        <div className="auth-branding-content">
          <motion.div 
            className="auth-branding-logo"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div 
              className="auth-branding-icon"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles style={{ width: 36, height: 36, color: 'white' }} />
            </motion.div>
            <motion.h1 
              className="auth-branding-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Estimate AI
            </motion.h1>
          </motion.div>
          <motion.p 
            className="auth-branding-tagline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Join thousands of professionals creating accurate estimates in minutes.
          </motion.p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="auth-form-section">
        <div className="auth-form-container">
          {/* Mobile logo */}
          <div className="auth-form-logo-mobile lg:hidden">
            <div className="auth-form-logo-icon">
              <Sparkles style={{ width: 32, height: 32, color: 'white' }} />
            </div>
            <h1 className="auth-form-title">Estimate AI</h1>
          </div>

          {/* Form header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
            <h2 className="auth-form-title">Create your account</h2>
            <p className="auth-form-subtitle">Start your free trial today</p>
          </div>

          {/* Error alert */}
          {error && (
            <Alert variant="error" dismissible onDismiss={() => setError(null)} style={{ marginBottom: 'var(--space-6)' }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            {/* Full name field */}
            <div className="auth-form-field">
              <label htmlFor="full_name" className="label">
                Full Name
              </label>
              <div className={`auth-input-wrapper ${errors.full_name ? 'auth-input-wrapper-error' : ''}`}>
                <div className="auth-input-icon-box">
                  <User style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
                </div>
                <input
                  id="full_name"
                  type="text"
                  className="auth-input"
                  placeholder="John Doe"
                  autoComplete="name"
                  {...register('full_name')}
                />
              </div>
              {errors.full_name && (
                <p className="auth-error-text">{errors.full_name.message}</p>
              )}
            </div>

            {/* Email field */}
            <div className="auth-form-field">
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <div className={`auth-input-wrapper ${errors.email ? 'auth-input-wrapper-error' : ''}`}>
                <div className="auth-input-icon-box">
                  <Mail style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
                </div>
                <input
                  id="email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="auth-error-text">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div className="auth-form-field">
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className={`auth-input-wrapper ${errors.password ? 'auth-input-wrapper-error' : ''}`}>
                <div className="auth-input-icon-box">
                  <Lock style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
                </div>
                <input
                  id="password"
                  type="password"
                  className="auth-input"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="auth-error-text">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password field */}
            <div className="auth-form-field">
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <div className={`auth-input-wrapper ${errors.confirmPassword ? 'auth-input-wrapper-error' : ''}`}>
                <div className="auth-input-icon-box">
                  <Lock style={{ width: 20, height: 20, color: 'var(--color-gray-400)' }} />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  className="auth-input"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="auth-error-text">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms checkbox */}
            <div className="auth-form-field">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  {...register('terms')}
                />
                <span>
                  I agree to the{' '}
                  <a href="#" className="auth-link">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="auth-link">Privacy Policy</a>
                </span>
              </label>
              {errors.terms && (
                <p className="auth-error-text">{errors.terms.message}</p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="auth-submit-btn"
              isLoading={isLoading}
              rightIcon={<ArrowRight style={{ width: 20, height: 20 }} />}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
          </div>

          {/* Sign in link */}
          <Link to="/auth/login">
            <Button variant="outline" className="auth-secondary-btn">
              Sign in to existing account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
