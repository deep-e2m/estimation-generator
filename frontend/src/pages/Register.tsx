/**
 * Registration Page - Beautiful Modern Design
 */

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Building2, ArrowRight, Check, X, Sparkles, Eye, EyeOff } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { registerSchema, type RegisterFormData } from '@/lib/validations'
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthLabel,
} from '@/lib/password'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { cn } from '@/lib/utils'
import '@/styles/auth.css'

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {met ? (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-gray-300 flex-shrink-0" />
      )}
      <span className={met ? 'text-green-700' : 'text-gray-500'}>{text}</span>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showError, setShowError] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { register: registerUser, isLoading, error, clearError } = useAuthStore()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      full_name: '',
      password: '',
      confirm_password: '',
      company_name: '',
    },
  })

  const password = watch('password', '')

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  )

  const requirements = useMemo(
    () => ({
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^a-zA-Z0-9]/.test(password),
    }),
    [password]
  )

  const onSubmit = async (data: RegisterFormData) => {
    setShowError(true)
    clearError()

    try {
      await registerUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        company_name: data.company_name || undefined,
      })
      navigate('/dashboard', { replace: true })
    } catch {
      // Error handled in store
    }
  }

  const dismissError = () => {
    setShowError(false)
    clearError()
  }

  const inputWrapperClass = (hasError: boolean) => `flex rounded-xl border-2 overflow-hidden transition-all duration-200 ${
    hasError
      ? 'border-red-300 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10'
      : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10'
  }`

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/10 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full flex flex-col justify-center px-8 lg:px-12 xl:px-16 text-white">
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <span className="text-4xl font-bold">Estimate AI</span>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 bg-gray-50 overflow-y-auto">
        <div className="auth-form-wrapper auth-form-wrapper-register">
          {/* Mobile Logo */}
          <div className="auth-mobile-logo">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Estimate AI</h1>
          </div>

          {/* Form Card */}
          <div className="auth-form-card auth-form-card-register">
            <div className="auth-form-header auth-form-header-register">
              <h2 className="auth-form-title">Create account</h2>
              <p className="auth-form-subtitle">Enter your details to get started</p>
            </div>

            {error && showError && (
              <Alert variant="error" dismissible onDismiss={dismissError} className="auth-form-alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form auth-form-register">
              {/* Full Name Field */}
              <div className="auth-form-field">
                <label htmlFor="full_name" className="auth-form-label">
                  Full Name
                </label>
                <div className={inputWrapperClass(!!errors.full_name)}>
                  <div className="w-14 flex-shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="full_name"
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    className="flex-1 h-14 text-base outline-none bg-white"
                    {...register('full_name')}
                  />
                </div>
                {errors.full_name && (
                  <p className="auth-form-error">{errors.full_name.message}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="auth-form-field">
                <label htmlFor="email" className="auth-form-label">
                  Email Address
                </label>
                <div className={inputWrapperClass(!!errors.email)}>
                  <div className="w-14 flex-shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                    <Mail className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="flex-1 h-14 text-base outline-none bg-white"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="auth-form-error">{errors.email.message}</p>
                )}
              </div>

              {/* Company Name Field */}
              <div className="auth-form-field">
                <label htmlFor="company_name" className="auth-form-label">
                  Company Name <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className={inputWrapperClass(!!errors.company_name)}>
                  <div className="w-14 flex-shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                    <Building2 className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="company_name"
                    type="text"
                    placeholder="Acme Inc."
                    autoComplete="organization"
                    className="flex-1 h-14 text-base outline-none bg-white"
                    {...register('company_name')}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="auth-form-field">
                <label htmlFor="password" className="auth-form-label">
                  Password
                </label>
                <div className={inputWrapperClass(!!errors.password)}>
                  <div className="w-14 flex-shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className="flex-1 h-14 text-base outline-none bg-white"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-14 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="auth-form-error">{errors.password.message}</p>
                )}

                {/* Password Strength */}
                {password && (
                  <div className="auth-password-strength">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-medium">Password strength</span>
                        <span className={cn(
                          'font-semibold',
                          passwordStrength.strength === 'weak' && 'text-red-600',
                          passwordStrength.strength === 'fair' && 'text-yellow-600',
                          passwordStrength.strength === 'good' && 'text-blue-600',
                          passwordStrength.strength === 'strong' && 'text-green-600'
                        )}>
                          {getStrengthLabel(passwordStrength.strength)}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((index) => (
                          <div
                            key={index}
                            className={cn(
                              'h-2 flex-1 rounded-full transition-all duration-300',
                              index < passwordStrength.score
                                ? getStrengthColor(passwordStrength.strength)
                                : 'bg-gray-200'
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <PasswordRequirement met={requirements.length} text="8+ characters" />
                      <PasswordRequirement met={requirements.lowercase} text="Lowercase" />
                      <PasswordRequirement met={requirements.uppercase} text="Uppercase" />
                      <PasswordRequirement met={requirements.number} text="Number" />
                      <PasswordRequirement met={requirements.special} text="Special char" />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="auth-form-field">
                <label htmlFor="confirm_password" className="auth-form-label">
                  Confirm Password
                </label>
                <div className={inputWrapperClass(!!errors.confirm_password)}>
                  <div className="w-14 flex-shrink-0 flex items-center justify-center bg-gray-50 border-r border-gray-200">
                    <Lock className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className="flex-1 h-14 text-base outline-none bg-white"
                    {...register('confirm_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="w-14 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="auth-form-error">{errors.confirm_password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all duration-200 auth-form-submit"
                size="lg"
                isLoading={isLoading}
              >
                <span className="flex items-center justify-center gap-2">
                  Create account
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Button>
            </form>

            {/* Divider */}
            <div className="auth-form-divider">
              <div className="auth-form-divider-line"></div>
              <div className="auth-form-divider-text">
                <span>Already have an account?</span>
              </div>
            </div>

            {/* Login Link */}
            <Link
              to="/auth/login"
              className="flex items-center justify-center w-full h-14 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              Sign in instead
            </Link>
          </div>

          {/* Footer */}
          <p className="auth-form-footer">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-gray-700 hover:text-gray-900 underline underline-offset-2">
              Terms
            </a>{' '}
            and{' '}
            <a href="#" className="text-gray-700 hover:text-gray-900 underline underline-offset-2">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
