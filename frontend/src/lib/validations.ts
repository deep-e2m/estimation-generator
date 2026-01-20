/**
 * Form validation schemas using Zod
 */

import { z } from 'zod'

// Email validation
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

// Password validation with rules
const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character')

// Simple password (for login - no validation rules)
const simplePasswordSchema = z.string().min(1, 'Password is required')

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  remember_me: z.boolean().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Registration form schema
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    full_name: z
      .string()
      .min(1, 'Full name is required')
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
    company_name: z.string().max(100, 'Company name must be less than 100 characters').optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>

/**
 * Forgot password form schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

/**
 * Reset password form schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

/**
 * Change password form schema
 */
export const changePasswordSchema = z
  .object({
    current_password: simplePasswordSchema,
    new_password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  })

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

/**
 * Profile update schema
 */
export const profileSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  company_name: z.string().max(100, 'Company name must be less than 100 characters').optional(),
})

export type ProfileFormData = z.infer<typeof profileSchema>
