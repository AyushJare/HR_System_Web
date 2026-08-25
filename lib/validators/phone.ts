/**
 * Phone Number Validator
 * Country-specific validation rules
 * Default: India (10 digits, starts with 9)
 */

export type CountryCode = "IN" | "US" | "UK" | "CA" | "AU";

export interface PhoneValidationRule {
  length: number;
  prefix?: string; // First digit must match this
  format?: string; // Display format example
  description: string;
}

export interface PhoneValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
  country?: CountryCode;
  countryName?: string;
}

/**
 * Country-specific phone validation rules
 * Add more countries as needed
 */
const PHONE_RULES: Record<CountryCode, PhoneValidationRule> = {
  IN: {
    length: 10,
    prefix: "9", // India: Must start with 9
    format: "9XXXX-XXXXX",
    description: "10 digits, starts with 9 (mobile only)",
  },
  US: {
    length: 10,
    format: "(XXX) XXX-XXXX",
    description: "10 digits (US & Canada format)",
  },
  UK: {
    length: 11,
    prefix: "7",
    format: "7XXX XXXXXX",
    description: "11 digits, starts with 7",
  },
  CA: {
    length: 10,
    format: "(XXX) XXX-XXXX",
    description: "10 digits",
  },
  AU: {
    length: 10,
    prefix: "4",
    format: "4XX XXX XXXX",
    description: "10 digits, starts with 4 (mobile)",
  },
};

/**
 * Validate phone number for a specific country
 */
export const validatePhoneNumber = (
  phone: string,
  countryCode: CountryCode = "IN"
): PhoneValidationResult => {
  if (!phone) {
    return {
      valid: false,
      error: "Phone number is required",
    };
  }

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Check if we support this country
  const rule = PHONE_RULES[countryCode];
  if (!rule) {
    return {
      valid: false,
      error: `Unsupported country code: ${countryCode}`,
    };
  }

  // Check length
  if (cleaned.length !== rule.length) {
    return {
      valid: false,
      error: `${countryCode} phone numbers must be exactly ${rule.length} digits (you provided ${cleaned.length})`,
    };
  }

  // Check prefix if required
  if (rule.prefix && !cleaned.startsWith(rule.prefix)) {
    return {
      valid: false,
      error: `${countryCode} phone numbers must start with ${rule.prefix}`,
    };
  }

  // All checks passed
  return {
    valid: true,
    formatted: formatPhoneNumber(cleaned, countryCode),
    country: countryCode,
    countryName: getCountryName(countryCode),
  };
};

/**
 * Format phone number based on country
 */
export const formatPhoneNumber = (phone: string, countryCode: CountryCode = "IN"): string => {
  const cleaned = phone.replace(/\D/g, "");

  switch (countryCode) {
    case "IN":
      // Format as: 98765-43210
      if (cleaned.length === 10) {
        return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      }
      return cleaned;

    case "US":
    case "CA":
      // Format as: (XXX) XXX-XXXX
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      return cleaned;

    case "UK":
      // Format as: XXXX XXXXXX
      if (cleaned.length === 11) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      }
      return cleaned;

    case "AU":
      // Format as: XXXX XXX XXX
      if (cleaned.length === 10) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
      }
      return cleaned;

    default:
      return cleaned;
  }
};

/**
 * Get country name from country code
 */
function getCountryName(code: CountryCode): string {
  const names: Record<CountryCode, string> = {
    IN: "India",
    US: "United States",
    UK: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
  };
  return names[code] || code;
}

/**
 * Validate multiple phone numbers (for bulk operations)
 */
export const validatePhoneNumbers = (
  phones: string[],
  countryCode: CountryCode = "IN"
): {
  valid: Array<{ phone: string; formatted: string }>;
  invalid: Array<{ phone: string; error: string }>;
} => {
  const valid: Array<{ phone: string; formatted: string }> = [];
  const invalid: Array<{ phone: string; error: string }> = [];
  const seen = new Set<string>();

  phones.forEach((phone) => {
    const result = validatePhoneNumber(phone, countryCode);

    if (!result.valid) {
      invalid.push({
        phone,
        error: result.error || "Invalid phone number",
      });
    } else {
      const formatted = result.formatted!;

      // Check for duplicates in batch
      if (seen.has(formatted)) {
        invalid.push({
          phone,
          error: "Duplicate phone number in batch",
        });
      } else {
        valid.push({
          phone,
          formatted,
        });
        seen.add(formatted);
      }
    }
  });

  return { valid, invalid };
};

/**
 * Detect country from phone number (heuristic)
 * Tries to guess country based on length and format
 */
export const detectCountry = (phone: string): CountryCode | null => {
  const cleaned = phone.replace(/\D/g, "");

  // By length (most reliable)
  if (cleaned.length === 10) {
    if (cleaned.startsWith("9")) return "IN";
    if (cleaned.startsWith("4")) return "AU";
    return "US"; // Default for 10-digit
  }

  if (cleaned.length === 11) {
    if (cleaned.startsWith("7")) return "UK";
  }

  return null;
};

/**
 * Check if phone number looks valid (without country context)
 * Useful for initial UI validation
 */
export const isPhoneNumberLike = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, "");
  // Must have between 7 and 15 digits (international standard)
  return cleaned.length >= 7 && cleaned.length <= 15;
};

/**
 * Get all supported countries and their rules
 */
export const getSupportedCountries = (): Array<{
  code: CountryCode;
  name: string;
  rule: PhoneValidationRule;
}> => {
  return Object.entries(PHONE_RULES).map(([code, rule]) => ({
    code: code as CountryCode,
    name: getCountryName(code as CountryCode),
    rule,
  }));
};

/**
 * Test cases for phone validator
 */
export const phoneValidatorTests = {
  india: {
    valid: [
      { phone: "9876543210", formatted: "98765-43210" },
      { phone: "98765-43210", formatted: "98765-43210" },
      { phone: "+91 98765 43210", formatted: "98765-43210" },
    ],
    invalid: [
      { phone: "8876543210", error: "starts with 8 - invalid for India" },
      { phone: "9876543", error: "too short (7 digits)" },
      { phone: "987654321012", error: "too long (12 digits)" },
      { phone: "+1 9876543210", error: "country prefix included" },
    ],
  },
  us: {
    valid: [
      { phone: "2025551234", formatted: "(202) 555-1234" },
      { phone: "(202) 555-1234", formatted: "(202) 555-1234" },
    ],
    invalid: [
      { phone: "202555123", error: "too short (9 digits)" },
      { phone: "20255512345", error: "too long (11 digits)" },
    ],
  },
  detection: {
    "9876543210": "IN",
    "2025551234": "US",
    "74912345678": "UK",
    "0412345678": "AU",
  },
};

/**
 * Format for bulk upload template
 */
export const getPhoneBulkUploadTemplate = (): string => {
  const countries = getSupportedCountries();
  let template = "Phone Number Format Reference:\n\n";

  countries.forEach(({ code, name, rule }) => {
    template += `${code} (${name}):\n`;
    template += `  • Length: ${rule.length} digits\n`;
    if (rule.prefix) {
      template += `  • Must start with: ${rule.prefix}\n`;
    }
    template += `  • Format: ${rule.format}\n`;
    template += `  • Example: ${generateExamplePhone(code)}\n\n`;
  });

  return template;
};

/**
 * Generate example phone for a country (for documentation)
 */
function generateExamplePhone(countryCode: CountryCode): string {
  switch (countryCode) {
    case "IN":
      return "9876543210";
    case "US":
      return "2025551234";
    case "UK":
      return "74912345678";
    case "CA":
      return "4165551234";
    case "AU":
      return "0412345678";
    default:
      return "1234567890";
  }
}