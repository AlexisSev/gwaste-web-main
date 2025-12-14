/**
 * Service for handling resident issue/report operations
 */

import { supabase } from "../supabaseClient";

/**
 * Update report status with proper error handling
 * @param {Object} report - Report object
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function updateReportStatus(report) {
  const newStatus = report.status === "resolved" ? "pending" : "resolved";

  try {
    const { error } = await supabase
      .from("reports")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", report.id);

    if (error) {
      console.error("Error updating report status:", error);
      return { success: false, error };
    }

    return {
      success: true,
      data: { ...report, status: newStatus },
      wasResolved: newStatus === "resolved"
    };
  } catch (err) {
    console.error("Unexpected error updating report status:", err);
    return { success: false, error: err };
  }
}

/**
 * Fetch reports data from the database
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchReportsData() {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  return { data, error };
}

/**
 * Fetch residents data for report enrichment
 * @returns {Promise<{data: Object, error: any}>}
 */
export async function fetchResidentsData() {
  const { data, error } = await supabase
    .from("residents")
    .select("*");

  return { data, error };
}

/**
 * Process residents data into a lookup map
 * @param {Array} residentsArray - Array of resident objects
 * @returns {Object} Residents lookup map by ID
 */
export function createResidentsLookup(residentsArray = []) {
  const residentsMap = {};
  residentsArray.forEach((resident) => {
    if (resident.id) {
      residentsMap[resident.id] = resident;
    }
  });
  return residentsMap;
}

/**
 * Setup realtime subscription for reports changes
 * @param {Function} onChange - Callback when data changes
 * @param {Function} onComplete - Cleanup function callback
 * @returns {Object} Subscription channel
 */
export function setupReportsSubscription(onChange, onComplete) {
  const channel = supabase
    .channel("reports-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reports" },
      (payload) => {
        onChange?.();
      }
    )
    .subscribe();

  if (onComplete) {
    onComplete(channel);
  }

  return channel;
}

/**
 * Cleanup subscription
 * @param {Object} channel - Supabase subscription channel
 */
export function cleanupReportsSubscription(channel) {
  try {
    if (channel) {
      supabase.removeChannel(channel);
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn("Error cleaning up reports subscription:", error);
  }
}

/**
 * Bulk update multiple reports
 * @param {Array} reportIds - Array of report IDs
 * @param {Object} updates - Update data
 * @returns {Promise<{success: boolean, updated: number, error?: any}>}
 */
export async function bulkUpdateReports(reportIds, updates) {
  try {
    const { data, error } = await supabase
      .from("reports")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .in("id", reportIds);

    if (error) {
      console.error("Error bulk updating reports:", error);
      return { success: false, updated: 0, error };
    }

    return { success: true, updated: data?.length || 0 };
  } catch (error) {
    console.error("Unexpected error in bulk update:", error);
    return { success: false, updated: 0, error };
  }
}
