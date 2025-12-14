/**
 * Service for handling collector database submission operations
 */

import { supabase } from "../supabaseClient";

/**
 * Create a new collector in the database
 * @param {Object} collectorData - Processed collector data
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function createNewCollector(collectorData) {
  try {
    const { data, error } = await supabase
      .from("collectors")
      .insert([collectorData])
      .select();

    if (error) {
      console.error("Error adding collector:", error);
      return { success: false, error };
    }

    console.log("Collector insert result:", data, error);
    return { success: true, data: data?.[0] };
  } catch (error) {
    console.error("Unexpected error creating collector:", error);
    return { success: false, error };
  }
}

/**
 * Update an existing collector in the database
 * @param {string} collectorId - ID of collector to update
 * @param {Object} updateData - Processed update data
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function updateExistingCollector(collectorId, updateData) {
  try {
    const { data, error } = await supabase
      .from("collectors")
      .update(updateData)
      .eq("id", collectorId)
      .select();

    if (error) {
      console.error("Error updating collector:", error);
      return { success: false, error };
    }

    console.log("Collector update result:", data, error);
    return { success: true, data: data?.[0] };
  } catch (error) {
    console.error("Unexpected error updating collector:", error);
    return { success: false, error };
  }
}

/**
 * Main submission function for collector creation
 * @param {Object} form - Form data
 * @param {Array} existingCollectors - For conflict checking
 * @param {Array} allRoutes - For route conflict checking
 * @param {Function} showConflictError - Callback to show conflicts
 * @param {Function} showSuccess - Callback to show success
 * @param {Function} closeModal - Callback to close modal
 * @returns {Promise<boolean>} Success status
 */
export async function submitNewCollector(form, existingCollectors, allRoutes, showConflictError, showSuccess, closeModal) {
  // This function serves as a coordinator for the creation process
  // The actual submission logic will be handled in the refactored component

  try {
    const { data, error } = await supabase
      .from("collectors")
      .insert([{
        firstName: form.firstName,
        lastName: form.lastName,
        contact: form.contact,
        password: form.password,
        driver: form.firstName + ' ' + form.lastName,
        crew: form.crew.filter((c) => c.firstName.trim() && c.lastName.trim()),
        status: 'active',
      }])
      .select();

    if (error) {
      return { success: false, error };
    }

    return { success: true, data: data?.[0] };
  } catch (error) {
    console.error("Unexpected error in collector submission:", error);
    return { success: false, error };
  }
}

/**
 * Helper function to remove all routes for a driver (utility for cleanup)
 * @param {string} driverName - Driver name
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function removeRoutesForDriver(driverName) {
  try {
    const { error } = await supabase
      .from("routes")
      .delete()
      .eq("driver", driverName);

    if (error) {
      console.error("Error removing routes for driver:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error removing routes:", error);
    return { success: false, error };
  }
}
