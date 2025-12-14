/**
 * Utilities for transforming and normalizing schedule data
 */

/**
 * Process and clean crew and areas arrays by removing empty/whitespace entries
 * @param {Array|string} crew - Crew data
 * @param {Array|string} areas - Areas data
 * @returns {Object} { cleanedCrew: Array, cleanedAreas: Array }
 */
export function cleanCrewAndAreas(crew, areas) {
  const cleanedCrew = (Array.isArray(crew) ? crew : [])
    .map((c) => (typeof c === "string" ? c.trim() : c))
    .filter((c) => (typeof c === "string" ? c.length > 0 : !!c));

  const cleanedAreas = (Array.isArray(areas) ? areas : [])
    .map((a) => (typeof a === "string" ? a.trim() : a))
    .filter((a) => (typeof a === "string" ? a.length > 0 : !!a));

  return { cleanedCrew, cleanedAreas };
}

/**
 * Process and normalize coordinates
 * @param {Array} coordinates - Coordinates array
 * @returns {Array} Processed coordinates
 */
export function processCoordinates(coordinates) {
  let coords = Array.isArray(coordinates) ? coordinates : [];

  // If only one coordinate, duplicate it
  if (coords.length === 1) {
    coords = [coords[0], coords[0]];
  }

  return coords;
}

/**
 * Normalize form data for consistent processing
 * @param {Object} form - Raw form data
 * @returns {Object} Normalized form data
 */
export function normalizeFormData(form) {
  const { cleanedCrew, cleanedAreas } = cleanCrewAndAreas(form.crew, form.areas);
  const coords = processCoordinates(form.coordinates);

  return {
    ...form,
    crew: cleanedCrew,
    areas: cleanedAreas,
    coordinates: coords,
  };
}

/**
 * Build the normalized payload for database submission
 * @param {Object} form - Normalized form data
 * @param {Array} cleanedCrew - Already cleaned crew array
 * @param {Array} cleanedAreas - Already cleaned areas array
 * @param {Array} coords - Processed coordinates
 * @returns {Object} Database payload
 */
export function buildNormalizedPayload(form, cleanedCrew, cleanedAreas, coords) {
  const normalizedPayload = {};

  if (form.route !== undefined) normalizedPayload.route = form.route || null;
  if (form.driver !== undefined) normalizedPayload.driver = form.driver || null;
  if (form.type !== undefined) normalizedPayload.type = form.type || "";
  if (form.time !== undefined) normalizedPayload.time = form.time || "";
  if (form.endTime !== undefined || form.end_time !== undefined) {
    normalizedPayload.end_time = form.endTime || form.end_time || "";
  }
  if (form.frequency !== undefined) normalizedPayload.frequency = form.frequency || "";
  if (cleanedAreas !== undefined) normalizedPayload.areas = cleanedAreas;
  if (coords !== undefined) normalizedPayload.coordinates = coords;
  if (cleanedCrew !== undefined) normalizedPayload.crew = cleanedCrew;
  if (form.dayOff !== undefined || form.dayoff !== undefined) {
    normalizedPayload.dayoff = form.dayOff || form.dayoff || "";
  }
  if (form.color !== undefined && form.color) {
    normalizedPayload.color = form.color;
  }

  return normalizedPayload;
}

/**
 * Alternative buildNormalizedPayload that takes cleaned form data
 * @param {Object} normalizedForm - Output from normalizeFormData
 * @returns {Object} Database payload
 */
export function buildNormalizedPayloadFromCleanData(normalizedForm) {
  return buildNormalizedPayload(
    normalizedForm,
    normalizedForm.crew,
    normalizedForm.areas,
    normalizedForm.coordinates
  );
}

/**
 * Process crew members from form input
 * @param {Array|string} crewInput - Crew from form
 * @returns {Array} Array of crew member strings
 */
export function processCrewMembers(crewInput) {
  let newCrewMembers = crewInput || [];
  if (typeof newCrewMembers === "string") {
    newCrewMembers = newCrewMembers.split(",").map((c) => c.trim());
  }
  return newCrewMembers.filter((c) => c); // removes blanks
}

/**
 * Create success message for schedule operations
 * @param {string} operation - 'add' or 'update'
 * @returns {string} Success message
 */
export function getSuccessMessage(operation) {
  return operation === "update"
    ? "The schedule has been updated successfully."
    : "The schedule has been added successfully.";
}

/**
 * Create error context for schedule operations
 * @param {string|null} editId - ID if editing
 * @returns {string} Context string
 */
export function getOperationContext(editId) {
  return editId ? "update schedule" : "add schedule";
}
