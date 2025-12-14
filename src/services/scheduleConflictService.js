/**
 * Service for checking schedule conflicts (drivers and crew assignments)
 */

import { supabase } from "../supabaseClient";

/**
 * Check for driver conflicts - prevents same driver on multiple routes
 * @param {Object} form - Form data
 * @param {Array} routes - All existing routes
 * @param {string|null} editId - ID of route being edited (skip self-conflict)
 * @returns {Object} Conflict info or null if no conflicts
 */
export function checkDriverConflicts(form, routes, editId) {
  const driverName = (form.driver || "").trim().toLowerCase();
  if (!driverName) return null;

  const conflictingDriverRoute = routes.find(
    (route) =>
      route.driver &&
      route.driver.trim().toLowerCase() === driverName &&
      (!editId || route.id !== editId)
  );

  if (conflictingDriverRoute) {
    return {
      type: "driver",
      driver: form.driver,
      conflictingRoute: conflictingDriverRoute.route,
      message: `Driver "${form.driver}" is already assigned to Route ${conflictingDriverRoute.route}. Please select a different driver or edit that route instead.`,
    };
  }

  return null;
}

/**
 * Check for crew conflicts - prevents same crew member on multiple routes
 * @param {Object} form - Form data
 * @param {Array} routes - All existing routes
 * @param {string|null} editId - ID of route being edited (skip self-conflict)
 * @returns {Array} Array of conflict objects, empty if no conflicts
 */
export function checkCrewConflicts(form, routes, editId) {
  let newCrewMembers = form.crew || [];
  if (typeof newCrewMembers === "string") {
    newCrewMembers = newCrewMembers.split(",").map((c) => c.trim());
  }
  newCrewMembers = newCrewMembers.filter((c) => c); // removes blanks

  const assignedCrewMembers = [];

  for (const route of routes) {
    // Skip the current route if editing
    if (editId && route.id === editId) continue;

    if (route.crew && Array.isArray(route.crew)) {
      for (const routeCrewMember of route.crew) {
        for (const newCrewMember of newCrewMembers) {
          if (routeCrewMember === newCrewMember) {
            assignedCrewMembers.push({
              name: newCrewMember,
              route: route.route,
              driver: route.driver,
            });
          }
        }
      }
    }
  }

  return assignedCrewMembers;
}

/**
 * Main validation function for schedule conflicts
 * @param {Object} form - Form data
 * @param {Array} routes - All existing routes
 * @param {string|null} editId - ID of route being edited
 * @returns {Array} Array of conflict objects with details
 */
export function validateScheduleConflicts(form, routes, editId) {
  const conflicts = [];

  // Check driver conflicts
  const driverConflict = checkDriverConflicts(form, routes, editId);
  if (driverConflict) {
    conflicts.push(driverConflict);
  }

  // Check crew conflicts
  const crewConflicts = checkCrewConflicts(form, routes, editId);
  if (crewConflicts.length > 0) {
    conflicts.push({
      type: "crew",
      assignedCrewMembers: crewConflicts,
      message: `Crew already assigned: ${crewConflicts
        .map((c) => `${c.name} (Route ${c.route})`)
        .join(", ")}`,
    });
  }

  return conflicts;
}

/**
 * Fetch all routes for conflict checking
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchRoutesForConflictCheck() {
  const { data, error } = await supabase.from("routes").select("*");
  return { data, error };
}
