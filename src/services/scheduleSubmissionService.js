/**
 * Service for handling schedule database submission operations
 */

import { supabase } from "../supabaseClient";
import { ROUTE_COLORS } from "../utils/scheduleUtils";

/**
 * Insert a new schedule into the database
 * @param {Object} payload - Normalized payload for insertion
 * @returns {Promise<{id: string, error: any}>} Result with inserted ID or error
 */
export async function insertNewSchedule(payload) {
  // Assign a color based on route number or random if not available
  let color = ROUTE_COLORS[parseInt(payload.route, 10) - 1];
  if (!color) {
    color = ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
  }
  const routeWithColor = { ...payload, color };

  const { data, error } = await supabase
    .from("routes")
    .insert([routeWithColor])
    .select();

  return { data: data?.[0], error };
}

/**
 * Update an existing schedule in the database
 * @param {string} scheduleId - ID of the schedule to update
 * @param {Object} payload - Normalized payload for update
 * @returns {Promise<{data: any, error: any}>} Update result
 */
export async function updateExistingSchedule(scheduleId, payload) {
  // Update without select to avoid RLS issues with SELECT after UPDATE
  const { data, error } = await supabase
    .from("routes")
    .update(payload)
    .eq("id", scheduleId);

  return { data, error };
}

/**
 * Main submission function that handles both insert and update operations
 * @param {Object} normalizedPayload - Clean normalized payload
 * @param {string|null} editId - ID if updating, null if creating
 * @returns {Promise<{success: boolean, data?: any, error?: any}>}
 */
export async function submitSchedule(normalizedPayload, editId) {
  try {
    if (editId) {
      console.log("🔄 Updating schedule with ID:", editId);
      console.log("📦 Payload:", normalizedPayload);

      const { data, error } = await updateExistingSchedule(editId, normalizedPayload);

      if (error) {
        console.error("❌ Error updating schedule:", error);
        return { success: false, error };
      }

      console.log("✅ Update query executed successfully");
      return { success: true, data };
    } else {
      const { data, error } = await insertNewSchedule(normalizedPayload);

      if (error) {
        console.error("❌ Error adding schedule:", error);
        return { success: false, error };
      }

      console.log("✅ Add query executed successfully");
      return { success: true, data: data?.id };
    }
  } catch (error) {
    console.error("Unexpected error in schedule submission:", error);
    return { success: false, error };
  }
}
