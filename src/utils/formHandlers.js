/**
 * Form handling utilities for schedule form
 */

import { ROUTE_PRESETS, isAM } from "./scheduleUtils";

/**
 * Handle route number changes with auto-fill logic
 * @param {Object} prevForm - Previous form state
 * @param {string} value - New route value
 * @param {string|null} editId - Edit ID to prevent auto-fill when editing
 * @returns {Object} Updated form state
 */
export function handleRouteChange(prevForm, value, editId) {
  const next = { ...prevForm, route: value };

  // Only auto-fill when adding a new schedule (not editing)
  if (!editId && ROUTE_PRESETS[value]) {
    const p = ROUTE_PRESETS[value];
    next.crew = [...p.crew];
    next.areas = [...p.areas];
    next.time = p.time;
    next.endTime = p.endTime;
    next.type = p.type;
    next.frequency = p.frequency;
    next.dayOff = p.dayOff;
  }

  return next;
}

/**
 * Handle start time changes with auto-bump logic for end time
 * @param {Object} prevForm - Previous form state
 * @param {string} value - New time value
 * @returns {Object} Updated form state
 */
export function handleTimeChange(prevForm, value) {
  const next = { ...prevForm, time: value };

  // If start time is AM, auto-bump end time to 12:00 PM when missing or AM
  if (isAM(value)) {
    const shouldBump = !prevForm.endTime || isAM(prevForm.endTime);
    if (shouldBump) {
      next.endTime = "12:00";
    }
  } else if (prevForm.endTime) {
    // If start is PM and end exists but is earlier, align end to start
    const [sh, sm] = value.split(":").map((n) => parseInt(n, 10));
    const [eh, em] = prevForm.endTime.split(":").map((n) => parseInt(n, 10));
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (endMinutes < startMinutes) {
      next.endTime = value;
    }
  }

  return next;
}

/**
 * Handle end time changes with AM validation
 * @param {Object} prevForm - Previous form state
 * @param {string} value - New end time value
 * @param {string} timeField - Start time field name
 * @returns {Object} Updated form state or null if validation fails
 */
export function handleEndTimeChange(prevForm, value, timeField = 'time') {
  // Prevent AM selection when start time is AM
  if (prevForm[timeField] && isAM(prevForm[timeField]) && isAM(value)) {
    // Don't update the end time if trying to set AM when start is AM
    return null;
  }

  return { ...prevForm, endTime: value };
}

/**
 * Main form change handler that delegates to specific handlers
 * @param {Object} prevForm - Previous form state
 * @param {string} name - Field name
 * @param {any} value - Field value
 * @param {string|null} editId - Edit ID for route auto-fill logic
 * @returns {Object} Updated form state
 */
export function handleScheduleFormChange(prevForm, name, value, editId = null) {
  switch (name) {
    case "route":
      return handleRouteChange(prevForm, value, editId);

    case "time":
      return handleTimeChange(prevForm, value);

    case "endTime":
      const result = handleEndTimeChange(prevForm, value);
      return result || prevForm; // Return prevForm if validation failed

    default:
      return { ...prevForm, [name]: value };
  }
}
