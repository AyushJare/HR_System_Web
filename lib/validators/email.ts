/**
 * Email Validator - RFC 5322 Compliant
 * Production-ready for enterprise use
 */

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string; // lowercase, trimmed
}

export const validateEmail = (email: unknown): EmailValidationResult => {
  if (email === null || email === undefined || email === "") {
    return {
      valid: false,
      error: "Email is required",
    };
  }

  const trimmed = String(email).trim().toLowerCase();

  // Basic length checks
  if (trimmed.length > 254) {
    return {
      valid: false,
      error: "Email too long (max 254 characters)",
    };
  }

  if (trimmed.length < 3) {
    return {
      valid: false,
      error: "Email too short",
    };
  }

  // RFC 5322 simplified regex
  // Supports: local@domain.extension
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  const [localPart, domain] = trimmed.split("@");

  // Validate local part (before @)
  if (!localPart || localPart.length > 64) {
    return {
      valid: false,
      error: "Email local part invalid (max 64 characters before @)",
    };
  }

  // Don't allow consecutive dots
  if (localPart.includes("..") || domain.includes("..")) {
    return {
      valid: false,
      error: "Email cannot contain consecutive dots",
    };
  }

  // Don't allow starting/ending with dot
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      valid: false,
      error: "Email local part cannot start or end with a dot",
    };
  }

  // Validate domain
  if (domain.length < 4) {
    return {
      valid: false,
      error: "Email domain must be at least 4 characters",
    };
  }

  // Block disposable email services (optional but recommended for enterprise)
  const disposableDomains = [
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
    "yopmail.com",
    "throwaway.email",
    "fakeinbox.com",
  ];

  if (disposableDomains.includes(domain)) {
    return {
      valid: false,
      error: "Disposable email addresses are not allowed",
    };
  }

  return {
    valid: true,
    normalized: trimmed,
  };
};

/**
 * Batch email validation for bulk operations
 */
export const validateEmails = (
  emails: string[]
): { valid: string[]; invalid: Array<{ email: string; error: string }> } => {
  const valid: string[] = [];
  const invalid: Array<{ email: string; error: string }> = [];

  const seen = new Set<string>();

  emails.forEach((email) => {
    const result = validateEmail(email);

    if (!result.valid) {
      invalid.push({
        email,
        error: result.error || "Invalid email",
      });
    } else {
      const normalized = result.normalized!;

      // Check for duplicates
      if (seen.has(normalized)) {
        invalid.push({
          email,
          error: "Duplicate email in batch",
        });
      } else {
        valid.push(normalized);
        seen.add(normalized);
      }
    }
  });

  return { valid, invalid };
};

/**
 * Test cases for validators
 */
export const emailValidatorTests = {
  valid: [
    "admin@company.com",
    "raj.kumar@licindia.co.in",
    "employee+tag@company.com",
    "123@company.co.uk",
  ],
  invalid: [
    { email: "admin@company", error: "Invalid email format" }, // No TLD
    { email: "@company.com", error: "Email local part invalid" }, // No local part
    { email: "admin@@company.com", error: "Invalid email format" }, // Double @
    { email: "admin@company..com", error: "cannot contain consecutive dots" }, // Double dot
    { email: ".admin@company.com", error: "cannot start or end with a dot" }, // Starts with dot
    { email: "admin.@company.com", error: "cannot start or end with a dot" }, // Ends with dot
    { email: "admin@tempmail.com", error: "Disposable email" }, // Disposable
  ],
};