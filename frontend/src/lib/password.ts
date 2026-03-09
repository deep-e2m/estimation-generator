/**
 * Password validation and strength checking utilities
 */

import type { PasswordStrength, PasswordStrengthResult } from '@/types/auth.types'

/**
 * Calculate password strength.
 * Password suggestion/feedback disabled: always returns empty feedback array.
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [] // Disabled: no suggestions shown anywhere in the system
  let score = 0

  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      feedback: [],
    }
  }

  // Length checks (score only; no feedback)
  if (password.length >= 8) {
    score++
  }
  if (password.length >= 12) {
    score++
  }

  // Character type checks (score only)
  if (/[a-z]/.test(password)) score += 0.5
  if (/[A-Z]/.test(password)) score += 0.5
  if (/[0-9]/.test(password)) score += 0.5
  if (/[^a-zA-Z0-9]/.test(password)) score += 0.5

  // Penalty for common patterns
  const commonPatterns = [
    /^123/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /letmein/i,
    /admin/i,
  ]
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 1
      break
    }
  }

  score = Math.max(0, Math.min(4, Math.round(score)))

  let strength: PasswordStrength
  if (score <= 1) strength = 'weak'
  else if (score === 2) strength = 'fair'
  else if (score === 3) strength = 'good'
  else strength = 'strong'

  return { strength, score, feedback }
}

/**
 * Get color for password strength indicator
 */
export function getStrengthColor(strength: PasswordStrength): string {
  const colors = {
    weak: 'bg-error-500',
    fair: 'bg-warning-500',
    good: 'bg-primary-500',
    strong: 'bg-success-500',
  }
  return colors[strength]
}

/**
 * Get text label for password strength
 */
export function getStrengthLabel(strength: PasswordStrength): string {
  const labels = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  }
  return labels[strength]
}

/**
 * Validate password meets all requirements
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain a special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
