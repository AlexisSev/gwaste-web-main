/**
 * Service for checking collector-related conflicts and validations
 */

import { supabase } from "../supabaseClient";

/**
 * Check for duplicate driver names
 * @param {string} firstName - Driver first name
 * @param {string} lastName - Driver last name
 * @param {Array} existingCollectors - Array of existing collectors
 * @returns {Object|null} Conflict info or null if no conflicts
 */
export function checkDriverNameConflicts(firstName, lastName, existingCollectors = []) {
  const newDriverName = `${firstName} ${lastName}`.toLowerCase().trim();

  const existingDrivers = (existingCollectors || [])
    .map(c => (c.driver || '').toLowerCase().trim())
    .filter(Boolean);

  if (existingDrivers.includes(newDriverName)) {
    return {
      type: "driver",
      name: `${firstName} ${lastName}`,
      message: "This driver already exists."
    };
  }

  return null;
}

/**
 * Check for duplicate crew member names
 * @param {Array} newCrew - Array of new crew objects
 * @param {Array} existingCollectors - Array of existing collectors
 * @returns {Array} Array of conflict objects
 */
export function checkCrewNameConflicts(newCrew, existingCollectors = []) {
  const newCrewNames = newCrew
    .filter(c => c.firstName?.trim() && c.lastName?.trim())
    .map(c => `${c.firstName} ${c.lastName}`.toLowerCase().trim());

  const existingCrewNames = (existingCollectors || [])
    .flatMap(c => (c.crew || []).map(member =>
      (member?.firstName && member?.lastName)
        ? `${member.firstName} ${member.lastName}`.toLowerCase().trim()
        : ''
    ))
    .filter(Boolean);

  const conflicts = [];
  for (const newName of newCrewNames) {
    if (existingCrewNames.includes(newName)) {
      conflicts.push({
        name: newName,
        message: `Crew member ${newName} already exists.`
      });
    }
  }

  return conflicts;
}

/**
 * Check if crew members are already assigned to routes
 * @param {Array} newCrew - Array of new crew objects
 * @param {Array} allRoutes - Array of all existing routes
 * @param {string} intendedDriverName - Name of driver being added (for exclusions)
 * @returns {Array} Array of conflict objects
 */
export function checkCrewRouteConflicts(newCrew, allRoutes = [], intendedDriverName = '') {
  const newCrewNames = newCrew
    .filter(c => c.firstName?.trim() && c.lastName?.trim())
    .map(c => `${c.firstName} ${c.lastName}`.toLowerCase().trim());

  const assignedCrewMembers = [];
  const normalizedIntendedDriver = intendedDriverName.toLowerCase().trim();

  for (const route of allRoutes) {
    if (route.crew && Array.isArray(route.crew)) {
      for (const crewMember of route.crew) {
        const crewName = typeof crewMember === 'string'
          ? crewMember.toLowerCase().trim()
          : (crewMember?.firstName && crewMember?.lastName
            ? `${crewMember.firstName} ${crewMember.lastName}`.toLowerCase().trim()
            : '');

        if (newCrewNames.includes(crewName)) {
          assignedCrewMembers.push({
            name: crewName,
            route: route.route,
            driver: route.driver
          });
        }
      }
    }
  }

  return assignedCrewMembers.filter(member => {
    // Allow if this crew is assigned to a route under the same driver being added
    const routeDriverName = (member.driver || '').toLowerCase().trim();
    return routeDriverName !== normalizedIntendedDriver;
  });
}

/**
 * Main validation function for collector creation
 * @param {Object} form - Form data
 * @param {Array} existingCollectors - Existing collectors
 * @param {Array} allRoutes - All routes
 * @returns {Array} Array of conflict objects with details
 */
export function validateNewCollector(form, existingCollectors, allRoutes) {
  const conflicts = [];
  const intendedDriverName = `${form.firstName} ${form.lastName}`;

  // Check driver conflicts
  const driverConflict = checkDriverNameConflicts(form.firstName, form.lastName, existingCollectors);
  if (driverConflict) {
    conflicts.push(driverConflict);
  }

  // Check crew name conflicts
  const crewNameConflicts = checkCrewNameConflicts(form.crew, existingCollectors);
  conflicts.push(...crewNameConflicts);

  // Check crew route conflicts
  const crewRouteConflicts = checkCrewRouteConflicts(form.crew, allRoutes, intendedDriverName);
  if (crewRouteConflicts.length > 0) {
    const routeCrewList = crewRouteConflicts
      .map(c => `${c.name} (Route ${c.route} - ${c.driver})`)
      .join(', ');

    conflicts.push({
      type: "crew",
      assignedCrewMembers: crewRouteConflicts,
      message: `The following crew members are already assigned to routes: ${routeCrewList}`
    });
  }

  return conflicts;
}

/**
 * Validation for collector updates (different rules for editing)
 * @param {Object} collector - Collector being updated
 * @param {Array} allRoutes - All routes
 * @returns {Array} Array of conflict objects
 */
export function validateCollectorUpdate(collector, allRoutes) {
  const conflicts = [];
  const intendedDriverName = `${collector.firstName} ${collector.lastName}`;

  const updatedCrewNames = (collector.crew || [])
    .filter(c => c.firstName?.trim() && c.lastName?.trim())
    .map(c => `${c.firstName} ${c.lastName}`.toLowerCase().trim());

  // Check crew route conflicts for updates
  const assignedCrewMembers = [];
  for (const route of allRoutes) {
    if (route.crew && Array.isArray(route.crew)) {
      for (const crewMember of route.crew) {
        const crewName = typeof crewMember === 'string'
          ? crewMember.toLowerCase().trim()
          : (crewMember?.firstName && crewMember?.lastName
            ? `${crewMember.firstName} ${crewMember.lastName}`.toLowerCase().trim()
            : '');

        if (updatedCrewNames.includes(crewName)) {
          // Allow if this crew is assigned to a route under the same driver being edited
          const routeDriverName = (route.driver || '').toLowerCase().trim();
          if (routeDriverName !== intendedDriverName) {
            assignedCrewMembers.push({
              name: crewName,
              route: route.route,
              driver: route.driver
            });
          }
        }
      }
    }
  }

  if (assignedCrewMembers.length > 0) {
    const crewList = assignedCrewMembers
      .map(c => `${c.name} (Route ${c.route} - ${c.driver})`)
      .join(', ');

    conflicts.push({
      type: "crew",
      assignedCrewMembers,
      message: `Cannot update: The following crew members are already assigned to routes: ${crewList}`
    });
  }

  return conflicts;
}

/**
 * Fetch collectors for conflict checking
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchCollectorsForConflictCheck() {
  const { data, error } = await supabase.from("collectors").select("*");
  return { data, error };
}

/**
 * Fetch routes for collector validation
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchRoutesForCollectorConflictCheck() {
  const { data, error } = await supabase.from("routes").select("*");
  return { data, error };
}
