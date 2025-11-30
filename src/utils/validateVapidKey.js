// Utility to validate VAPID public key format

/**
 * Validates if a string looks like a valid VAPID public key
 * VAPID keys are base64url encoded strings, typically 87 characters long
 * @param {string} key - The VAPID public key to validate
 * @returns {boolean} - True if the key appears valid
 */
export function isValidVapidKeyFormat(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const trimmed = key.trim();
  
  // VAPID public keys are typically 87 characters (base64url encoded)
  // But they can vary slightly, so we check for reasonable length (80-100 chars)
  if (trimmed.length < 80 || trimmed.length > 100) {
    return false;
  }

  // Check if it's valid base64url format (alphanumeric, -, _)
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!base64urlRegex.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Provides helpful error message for VAPID key issues
 * @param {string} key - The VAPID key that failed validation
 * @returns {string} - Helpful error message
 */
export function getVapidKeyErrorMessage(key) {
  if (!key || key.trim() === '') {
    return 'VAPID public key is missing. Please set REACT_APP_VAPID_PUBLIC_KEY in your .env file.';
  }

  if (!isValidVapidKeyFormat(key)) {
    return `Invalid VAPID public key format. The key should be a base64url-encoded string (typically 87 characters). Current key length: ${key.trim().length}`;
  }

  return 'Unknown VAPID key error';
}

