/**
 * Login Page
 * 
 * Uses centralized CSS classes from styles/pages.css
 * Features animated branding with Framer Motion
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { useAuthStore } from '@/store/authStore'

// Form validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)

  // Get redirect path from location state
  const from = (location.state as { from?: string })?.from || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      await login({ email: data.email, password: data.password, remember_me: data.remember })
      navigate(from, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid email or password. Please try again.'
      )
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
            Transform your estimation process with AI-powered accuracy and efficiency.
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
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">Sign in to continue to your dashboard</p>
          </div>

          {/* Error alert */}
          {error && (
            <Alert variant="error" dismissible onDismiss={() => setError(null)} style={{ marginBottom: 'var(--space-6)' }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
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
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="auth-error-text">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me & Forgot password */}
            <div className="auth-form-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  {...register('remember')}
                />
                Remember me
              </label>
              <Link to="/auth/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="auth-submit-btn"
              isLoading={isLoading}
              rightIcon={<ArrowRight style={{ width: 20, height: 20 }} />}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
          </div>

          {/* Create account link */}
          <Link to="/auth/register">
            <Button variant="outline" className="auth-secondary-btn">
              Create a new account
            </Button>
          </Link>

          {/* Footer */}
          <p className="auth-footer">
            By signing in, you agree to our{' '}
            <a href="#">Terms of Service</a> and{' '}
            <a href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
