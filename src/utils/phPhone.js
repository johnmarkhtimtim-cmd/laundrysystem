/**
 * Normalize a Philippine mobile number to 11-digit 09XXXXXXXXX format.
 */
export function normalizePhMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("639") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

/**
 * Sanitize live user input for PH mobile number fields.
 * Converts leading +639 / 639 to 09 and restricts to 11 numeric digits.
 */
export function sanitizePhMobileInput(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("639")) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith("9") && digits.length === 10) {
    digits = `0${digits}`;
  }
  return digits.slice(0, 11);
}

/**
 * Validate that a value is a valid 11-digit PH mobile number starting with 09.
 */
export function isValidPhMobile(value) {
  return /^09\d{9}$/.test(normalizePhMobile(value));
}
