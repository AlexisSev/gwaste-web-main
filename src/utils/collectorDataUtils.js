/**
 * Utilities for transforming and normalizing collector data
 */

import defaultProfileImage from "../Cooked.jpg";

/**
 * Process collector form data for submission
 * @param {Object} form - Raw form data
 * @returns {Object} Processed collector data for database insertion
 */
export function processCollectorFormData(form) {
  const processedCrew = (form.crew || [])
    .filter(c => c.firstName?.trim() && c.lastName?.trim())
    .map(c => ({
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim()
    }));

  return {
    firstName: form.firstName?.trim(),
    lastName: form.lastName?.trim(),
    contact: form.contact?.trim(),
    password: form.password,
    driver: `${form.firstName?.trim()} ${form.lastName?.trim()}`,
    crew: processedCrew,
    status: 'active'
  };
}

/**
 * Process collector update data
 * @param {Object} collector - Collector data for update
 * @returns {Object} Processed data for database update
 */
export function processCollectorUpdateData(collector) {
  const processedCrew = (collector.crew || [])
    .filter(c => c.firstName?.trim() && c.lastName?.trim())
    .map(c => ({
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim()
    }));

  return {
    status: collector.status,
    crew: processedCrew,
    firstName: collector.firstName?.trim(),
    lastName: collector.lastName?.trim(),
    contact: collector.contact?.trim(),
    driver: `${collector.firstName?.trim()} ${collector.lastName?.trim()}`
  };
}

/**
 * Format collector display name
 * @param {Object} collector - Collector data
 * @returns {string} Formatted display name
 */
export function formatCollectorName(collector) {
  if (!collector) return "Unnamed collector";

  if (collector.driver) {
    return collector.driver;
  }

  return `${collector.firstName || ""} ${collector.lastName || ""}`.trim() || "Unnamed collector";
}

/**
 * Resolve collector profile image with fallbacks
 * @param {Object} collector - Collector data
 * @returns {string} Image source URL or default image
 */
export function resolveCollectorImage(collector) {
  if (!collector) return defaultProfileImage;

  const rawImage =
    collector?.profile_image ||
    collector?.profileImage ||
    collector?.profile_image_base64 ||
    collector?.profileImageBase64;

  if (!rawImage) return defaultProfileImage;

  if (typeof rawImage === "string") {
    if (rawImage.startsWith("http")) return rawImage;
    if (rawImage.startsWith("data:image")) return rawImage;
    return `data:image/jpeg;base64,${rawImage}`;
  }

  return defaultProfileImage;
}

/**
 * Format date for display
 * @param {string|Date} value - Date value
 * @returns {string} Formatted date or "—" if invalid
 */
export function formatCollectorDate(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

/**
 * Validate collector form data
 * @param {Object} form - Form data to validate
 * @returns {Object} Validation errors object
 */
export function validateCollectorForm(form) {
  const errors = {};

  if (!form.firstName?.trim()) {
    errors.firstName = "First name required";
  }

  if (!form.lastName?.trim()) {
    errors.lastName = "Last name required";
  }

  if (!form.contact?.trim()) {
    errors.contact = "Contact number required";
  }

  if (!form.password?.trim()) {
    errors.password = "Password required";
  }

  return errors;
}

/**
 * Check if validation errors exist
 * @param {Object} errors - Validation errors object
 * @returns {boolean} True if validation passes (no errors)
 */
export function isCollectorFormValid(errors) {
  return Object.keys(errors).length === 0;
}

/**
 * Get success message for collector operations
 * @param {string} operation - 'add' or 'update'
 * @returns {string} Success message
 */
export function getCollectorSuccessMessage(operation) {
  switch (operation) {
    case 'add':
      return "Collector Added!";
    case 'update':
      return "Driver Updated!";
    default:
      return "Operation Successful!";
  }
}

/**
 * Get success content for collector operations
 * @param {string} operation - 'add' or 'update'
 * @returns {string} Success content text
 */
export function getCollectorSuccessContent(operation) {
  switch (operation) {
    case 'add':
      return "The collector has been added successfully.";
    case 'update':
      return "The driver information has been updated successfully.";
    default:
      return "The operation was completed successfully.";
  }
}
