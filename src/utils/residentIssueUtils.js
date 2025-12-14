/**
 * Utilities for processing resident issue/report data
 */

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp or "N/A"
 */
export function formatReportTimestamp(timestamp) {
  if (!timestamp) return "N/A";

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  } catch (error) {
    console.warn("Error formatting timestamp:", error);
    return "N/A";
  }
}

/**
 * Get address for a report with fallbacks
 * @param {Object} report - Report object
 * @param {Object} residents - Residents lookup map
 * @returns {string} Formatted address or "Not specified"
 */
export function getReportAddress(report, residents = {}) {
  if (!report) return "Not specified";

  // First try to get address from residents table if we have a resident ID
  const residentId = report.resident_id || report.residentId || report.userId || report.uid || report.submittedBy;
  if (residentId && residents[residentId]) {
    const resident = residents[residentId];
    const residentAddress = resident?.resident_address;
    if (isValidString(residentAddress)) {
      return trimString(residentAddress, 50);
    }
  }

  // Try various address fields from the report
  const addressFields = ['location', 'address', 'location_address', 'resident_address'];
  for (const field of addressFields) {
    const address = report[field];
    if (isValidString(address)) {
      return trimString(address, 50);
    }
  }

  return "Not specified";
}

/**
 * Get report images from various possible fields
 * @param {Object} report - Report object
 * @returns {string[]} Array of image URLs or base64 data
 */
export function getReportImages(report) {
  if (!report) return [];

  const images = [];

  // Check for images_base64 field (main database field)
  if (report.images_base64) {
    images.push(...extractImagesFromField(report.images_base64));
  }

  // Check array fields
  const arrayFields = ['images', 'image', 'photos', 'pictures'];
  for (const field of arrayFields) {
    if (Array.isArray(report[field])) {
      images.push(...report[field].filter(img => isValidString(img)));
    }
  }

  // Check single string fields
  const stringFields = ['image', 'images', 'photo', 'picture', 'photo_url', 'image_url', 'image_base64'];
  for (const field of stringFields) {
    if (isValidString(report[field])) {
      images.push(report[field]);
    }
  }

  // Filter and validate images
  const filteredImages = images
    .filter(img => isValidString(img))
    .filter(img => isValidImageUrl(img));

  // Log debug information for troubleshooting
  if (filteredImages.length === 0 && images.length > 0) {
    console.log('Report images found but filtered out:', report.id, images);
  }

  return filteredImages;
}

/**
 * Extract images from various possible field formats
 * @private
 * @param {*} fieldValue - Value from image field
 * @returns {string[]} Array of image strings
 */
function extractImagesFromField(fieldValue) {
  if (!fieldValue) return [];

  // Array format
  if (Array.isArray(fieldValue)) {
    return fieldValue.filter(img => isValidString(img));
  }

  // String format
  if (typeof fieldValue === 'string') {
    return [fieldValue];
  }

  // Object format (JSONB)
  if (typeof fieldValue === 'object') {
    if (fieldValue.images && Array.isArray(fieldValue.images)) return fieldValue.images;
    if (fieldValue.image) return Array.isArray(fieldValue.image) ? fieldValue.image : [fieldValue.image];
    if (fieldValue.data) return [fieldValue.data];
  }

  return [];
}

/**
 * Get resident name with fallbacks
 * @param {Object} report - Report object
 * @param {Object} residents - Residents lookup map
 * @returns {string} Resident name or "Anonymous"
 */
export function getReportResidentName(report, residents = {}) {
  if (!report) return "Anonymous";

  // First try to get from residents table using various ID fields
  const residentIds = ['resident_id', 'residentId', 'userId', 'uid', 'submittedBy'];
  for (const idField of residentIds) {
    const id = report[idField];
    if (id && residents[id]) {
      const resident = residents[id];

      // Try various name fields
      const name = extractResidentName(resident);
      if (name && name !== "Anonymous") {
        return name;
      }
    }
  }

  // Fallback to report fields
  const reportFields = ['resident_name', 'residentName', 'username', 'user', 'submitted_by'];
  for (const field of reportFields) {
    if (isValidString(report[field])) {
      return report[field].trim();
    }
  }

  return "Anonymous";
}

/**
 * Extract name from resident object
 * @private
 * @param {Object} resident - Resident object
 * @returns {string} Resident name or "Anonymous"
 */
function extractResidentName(resident) {
  if (!resident) return "Anonymous";

  // Try full_name field first
  if (isValidString(resident.full_name)) {
    return resident.full_name.trim();
  }

  // Try first_name + last_name
  const firstName = resident.first_name?.trim();
  const lastName = resident.last_name?.trim();
  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  // Try name field
  if (isValidString(resident.name)) {
    return resident.name.trim();
  }

  // Try email as last resort
  if (isValidString(resident.email)) {
    return resident.email.trim();
  }

  return "Anonymous";
}

/**
 * Check if string is valid (not null, undefined, empty, or just whitespace)
 * @private
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Trim string to length with ellipsis if needed
 * @private
 * @param {string} str - String to trim
 * @param {number} maxLength - Maximum length
 * @returns {string} Trimmed string
 */
function trimString(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Check if image string is valid URL or base64 data
 * @private
 * @param {string} img - Image string to validate
 * @returns {boolean}
 */
function isValidImageUrl(img) {
  const trimmed = img.trim();
  return trimmed.startsWith('http') ||
         trimmed.startsWith('data:image/') ||
         trimmed.startsWith('/');
}

/**
 * Process report data for display
 * @param {Object} report - Report object
 * @param {Object} residents - Residents lookup map
 * @returns {Object} Processed report data
 */
export function processReportData(report, residents = {}) {
  if (!report) return null;

  return {
    ...report,
    formattedTimestamp: formatReportTimestamp(report.created_at || report.timestamp),
    residentName: getReportResidentName(report, residents),
    address: getReportAddress(report, residents),
    images: getReportImages(report)
  };
}

/**
 * Filter reports by status and search term
 * @param {Array} reports - Array of reports
 * @param {string} activeTab - Status filter ("pending" or "resolved")
 * @param {string} search - Search term
 * @returns {Array} Filtered reports
 */
export function filterReports(reports = [], activeTab = "pending", search = "") {
  return reports.filter(report => {
    // Status filter
    if (report.status !== activeTab) return false;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const description = (report.description || "").toLowerCase();
      return description.includes(searchLower);
    }

    return true;
  });
}

/**
 * Get success message for status update
 * @param {boolean} wasResolved - Whether report was marked as resolved
 * @returns {string} Success message
 */
export function getStatusUpdateMessage(wasResolved) {
  return wasResolved
    ? "Report marked as resolved successfully!"
    : "Report marked as pending successfully!";
}
