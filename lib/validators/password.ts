/**
 * Password Validator & Generator
 * Enterprise-grade password policy enforcement
 */

import crypto from "crypto";

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialCharSet: string;
  preventCommonPasswords: boolean;
}

/**
 * Default password policy for LIC
 * 12+ chars, mixed case, numbers, special chars
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialCharSet: "!@#$%^&*()-_=+[]{}|;:,.<>?",
  preventCommonPasswords: true,
};

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-100 (strength)
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validate password against policy
 */
export const validatePassword = (
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Null/empty check
  if (!password) {
    return {
      valid: false,
      score: 0,
      errors: ["Password is required"],
      warnings,
      suggestions: ["Enter a password that meets all requirements"],
    };
  }

  // Length validation
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters (current: ${password.length})`);
  } else {
    score += 20;
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must not exceed ${policy.maxLength} characters`);
  }

  // Character type validation
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A-Z)");
  } else if (policy.requireUppercase) {
    score += 15;
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a-z)");
  } else if (policy.requireLowercase) {
    score += 15;
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number (0-9)");
  } else if (policy.requireNumbers) {
    score += 15;
  }

  if (policy.requireSpecialChars) {
    const specialRegex = new RegExp(`[${policy.specialCharSet.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}]`);
    if (!specialRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${policy.specialCharSet.slice(0, 10)}...)`);
    } else {
      score += 20;
    }
  }

  // Additional checks
  if (policy.preventCommonPasswords) {
    if (isCommonPassword(password)) {
      errors.push("This password is too common. Please choose a more unique password");
    } else {
      score += 15;
    }
  }

  // Pattern detection (warnings)
  if (/(.)\1{2,}/.test(password)) {
    warnings.push("Avoid repeating characters (e.g., 'aaa', '111')");
    score -= 5;
  }

  if (/^[a-zA-Z]+[0-9]+$|^[0-9]+[a-zA-Z]+$/.test(password)) {
    warnings.push("Avoid simple patterns like 'Password123' or '123456abc'");
    score -= 5;
  }

  if (/password|pass|123456|qwerty|abc123/i.test(password)) {
    errors.push("Password contains common words. Use more unique combinations");
  }

  // Suggestions for improvement
  if (password.length < policy.minLength + 2) {
    suggestions.push(`Add ${policy.minLength - password.length} more characters for stronger password`);
  }

  if (!/[0-9]/.test(password)) {
    suggestions.push("Include numbers for better security");
  }

  if (!/[!@#$%^&*]/.test(password)) {
    suggestions.push("Use special characters (!@#$%^&*) for enhanced security");
  }

  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score));

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Generate cryptographically secure password
 */
export const generateSecurePassword = (policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = policy.specialCharSet;

  // Start with one of each required type
  let password = "";

  if (policy.requireUppercase) {
    password += uppercase[crypto.randomInt(0, uppercase.length)];
  }

  if (policy.requireLowercase) {
    password += lowercase[crypto.randomInt(0, lowercase.length)];
  }

  if (policy.requireNumbers) {
    password += numbers[crypto.randomInt(0, numbers.length)];
  }

  if (policy.requireSpecialChars) {
    password += special[crypto.randomInt(0, special.length)];
  }

  // Fill remaining length with random characters
  const allChars = uppercase + lowercase + numbers + special;
  const targetLength = Math.min(policy.maxLength, policy.minLength + 4); // Don't make it too long by default

  while (password.length < targetLength) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Shuffle to avoid predictable patterns
  const shuffled = password
    .split("")
    .sort(() => crypto.randomInt(-1, 2) - 0.5)
    .join("");

  return shuffled;
};

/**
 * Check if password is in common passwords list
 */
const COMMON_PASSWORDS = [
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty",
  "abc123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "password1",
  "123123",
];

function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  return COMMON_PASSWORDS.some(
    (common) => lower === common || lower.includes(common)
  );
}

/**
 * Estimate password entropy (in bits)
 */
export const estimatePasswordEntropy = (password: string): number => {
  let characterSpace = 0;

  if (/[a-z]/.test(password)) characterSpace += 26;
  if (/[A-Z]/.test(password)) characterSpace += 26;
  if (/[0-9]/.test(password)) characterSpace += 10;
  if (/[^a-zA-Z0-9]/.test(password)) characterSpace += 32;

  const entropy = password.length * Math.log2(characterSpace);
  return Math.round(entropy);
};

/**
 * Password strength meter (for UI feedback)
 */
export interface PasswordStrength {
  level: "weak" | "fair" | "good" | "strong" | "very-strong";
  score: number; // 0-100
  estimatedCrackTime: string;
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  const validation = validatePassword(password);
  const entropy = estimatePasswordEntropy(password);

  let level: "weak" | "fair" | "good" | "strong" | "very-strong";
  let estimatedCrackTime: string;

  if (validation.score < 20) {
    level = "weak";
    estimatedCrackTime = "Minutes";
  } else if (validation.score < 40) {
    level = "fair";
    estimatedCrackTime = "Hours";
  } else if (validation.score < 60) {
    level = "good";
    estimatedCrackTime = "Days";
  } else if (validation.score < 80) {
    level = "strong";
    estimatedCrackTime = "Months";
  } else {
    level = "very-strong";
    estimatedCrackTime = "Years";
  }

  return {
    level,
    score: validation.score,
    estimatedCrackTime,
  };
};

/**
 * Test cases
 */
export const passwordValidatorTests = {
  // Valid passwords
  valid: [
    "SecurePass#2024_AbcDef123",
    "MyCompany!Pass@2024",
    "Admin@LIC#2024$Secure",
  ],

  // Invalid passwords
  invalid: [
    { password: "short", error: "too short" },
    { password: "nouppercase123!", error: "no uppercase" },
    { password: "NOLOWERCASE123!", error: "no lowercase" },
    { password: "NoNumbers!@#", error: "no numbers" },
    { password: "NoSpecial123", error: "no special chars" },
    { password: "password123", error: "common password" },
  ],
};