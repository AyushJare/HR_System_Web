import toast from "react-hot-toast";

export type ErrorType =
    | "validation"
    | "api"
    | "network"
    | "auth"
    | "permission"
    | "server"
    | "unknown"
    | "field_required"
    | "format_invalid"
    | "length_invalid";

export interface AppError {
    type: ErrorType;
    message: string;
    details?: string;
    code?: string;
    field?: string;
}

/**
 * Show error toast with custom message
 */
export const showErrorToast = (
    message: string,
    details?: string
): void => {
    console.error(`[ERROR] ${message}`, details);

    const fullMessage = details
        ? `${message}: ${details}`
        : message;

    toast.error(fullMessage, {
        duration: 5000,
        position: "top-right",
        style: {
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            border: "1px solid #fecaca",
        },
    });
};

/**
 * Show success toast
 */
export const showSuccessToast = (message: string): void => {
    console.log(`[SUCCESS] ${message}`);

    toast.success(message, {
        duration: 4000,
        position: "top-right",
        style: {
            background: "#dcfce7",
            color: "#166534",
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
        },
    });
};

/**
 * Show warning toast
 */
export const showWarningToast = (message: string): void => {
    console.warn(`[WARNING] ${message}`);

    toast(message, {
        duration: 3000,
        position: "top-right",
        icon: "⚠️",
        style: {
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: "8px",
            border: "1px solid #fde68a",
        },
    });
};

/**
 * Field validation with error toast
 */
export const validateField = (
    value: string | null | undefined,
    fieldName: string,
    rules: {
        required?: boolean;
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        custom?: (value: string) => string | null;
    }
): { valid: boolean; error?: string } => {
    try {
        // Check required
        if (rules.required && (!value || !value.trim())) {
            const error = `${fieldName} is required`;

            showErrorToast(
                `${fieldName} Validation`,
                error
            );

            return {
                valid: false,
                error,
            };
        }

        // Skip other checks if value is empty and not required
        if (!value || !value.trim()) {
            return {
                valid: true,
            };
        }

        const trimmedValue = value.trim();

        // Check minimum length
        if (
            rules.minLength !== undefined &&
            trimmedValue.length < rules.minLength
        ) {
            const error =
                `${fieldName} must be at least ${rules.minLength} characters`;

            showErrorToast(
                `${fieldName} Validation`,
                error
            );

            return {
                valid: false,
                error,
            };
        }

        // Check maximum length
        if (
            rules.maxLength !== undefined &&
            trimmedValue.length > rules.maxLength
        ) {
            const error =
                `${fieldName} must not exceed ${rules.maxLength} characters`;

            showErrorToast(
                `${fieldName} Validation`,
                error
            );

            return {
                valid: false,
                error,
            };
        }

        // Check pattern
        if (
            rules.pattern &&
            !rules.pattern.test(trimmedValue)
        ) {
            const error = `${fieldName} format is invalid`;

            showErrorToast(
                `${fieldName} Validation`,
                error
            );

            return {
                valid: false,
                error,
            };
        }

        // Custom validation
        if (rules.custom) {
            const customError = rules.custom(trimmedValue);

            if (customError) {
                showErrorToast(
                    `${fieldName} Validation`,
                    customError
                );

                return {
                    valid: false,
                    error: customError,
                };
            }
        }

        return {
            valid: true,
        };
    } catch (error) {
        const errorMsg =
            error instanceof Error
                ? error.message
                : "Unknown validation error";

        showErrorToast(
            `${fieldName} Error`,
            errorMsg
        );

        return {
            valid: false,
            error: errorMsg,
        };
    }
};

/**
 * Validate required field
 */
export const validateRequired = (
    value: string,
    fieldName: string
): boolean => {
    if (!value || !value.trim()) {
        showErrorToast(
            `${fieldName} Required`,
            `${fieldName} is required`
        );

        return false;
    }

    return true;
};

/**
 * Validate email format
 */
export const validateEmailFormat = (
    email: string
): boolean => {
    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
        showErrorToast(
            "Email Invalid",
            "Please enter a valid email address"
        );

        return false;
    }

    return true;
};

/**
 * Validate phone number (India)
 */
export const validatePhoneFormat = (
    phone: string
): boolean => {
    // Optional field
    if (!phone || !phone.trim()) {
        return true;
    }

    const cleaned = phone.replace(/\D/g, "");

    if (cleaned.length !== 10) {
        showErrorToast(
            "Phone Invalid",
            "Phone must be exactly 10 digits"
        );

        return false;
    }

    if (!cleaned.startsWith("9")) {
        showErrorToast(
            "Phone Invalid",
            "Phone must start with 9"
        );

        return false;
    }

    return true;
};

/**
 * Validate minimum length
 */
export const validateMinLength = (
    value: string,
    minLength: number,
    fieldName: string
): boolean => {
    if (value.trim().length < minLength) {
        showErrorToast(
            `${fieldName} Length`,
            `${fieldName} must be at least ${minLength} characters`
        );

        return false;
    }

    return true;
};

/**
 * Validate select field
 */
export const validateSelectField = (
    value: string,
    fieldName: string,
    required: boolean = true
): boolean => {
    if (required && !value) {
        showErrorToast(
            `${fieldName} Required`,
            `Please select a ${fieldName}`
        );

        return false;
    }

    return true;
};

/**
 * Handle API errors with detailed logging
 */
export const handleApiError = (
    error: unknown,
    context: string = "API Call"
): void => {
    console.error(
        `[API ERROR - ${context}]`,
        error
    );

    if (error instanceof Response) {
        showErrorToast(
            "Server Error",
            `Status: ${error.status} - ${error.statusText}`
        );
    } else if (error instanceof TypeError) {
        if (
            error.message
                .toLowerCase()
                .includes("fetch")
        ) {
            showErrorToast(
                "Network Error",
                "Cannot reach server. Check your connection."
            );
        } else {
            showErrorToast(
                "Network Error",
                error.message
            );
        }
    } else if (error instanceof Error) {
        showErrorToast(
            "Error",
            error.message
        );
    } else if (
        typeof error === "object" &&
        error !== null
    ) {
        const errorObj = error as {
            message?: string;
            error?: string;
        };

        showErrorToast(
            "Error",
            errorObj.message ||
            errorObj.error ||
            JSON.stringify(error)
        );
    } else {
        showErrorToast(
            "Unknown Error",
            "Something unexpected happened"
        );
    }
};

/**
 * Wrap async functions with error handling
 */
export const withErrorHandling = async <T>(
    fn: () => Promise<T>,
    errorMessage: string = "An error occurred"
): Promise<T | null> => {
    try {
        return await fn();
    } catch (error) {
        handleApiError(error, errorMessage);
        return null;
    }
};

/**
 * Safe JSON parse
 */
export const safeJsonParse = (
    json: string,
    fieldName: string = "Data"
): unknown => {
    try {
        return JSON.parse(json);
    } catch (error) {
        console.error(
            `[JSON PARSE ERROR - ${fieldName}]`,
            error
        );

        showErrorToast(
            "Parse Error",
            `Failed to parse ${fieldName}`
        );

        return null;
    }
};

/**
 * Validate array response
 */
export const validateArrayResponse = <T>(
    data: unknown,
    fieldName: string = "Data"
): T[] => {
    if (!Array.isArray(data)) {
        showErrorToast(
            "Data Error",
            `${fieldName} is not in correct format`
        );

        return [];
    }

    return data as T[];
};

/**
 * Validate object response
 */
export const validateObjectResponse = (
    data: unknown,
    fieldName: string = "Data"
): Record<string, unknown> | null => {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        showErrorToast(
            "Data Error",
            `${fieldName} is not in correct format`
        );

        return null;
    }

    return data as Record<string, unknown>;
};