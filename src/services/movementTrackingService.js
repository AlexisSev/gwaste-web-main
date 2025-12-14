/* eslint-disable no-unused-vars */
/**
 * Service for handling truck movement and collection data tracking
 */

import { supabase } from "../supabaseClient";

/**
 * Fetch truck movement data and collections for graphing
 * @param {string} collectorId - Collector identifier
 * @param {string} driverName - Driver name for collections lookup
 * @returns {Promise<{movement: Array, collections: Array, error?: any}>}
 */
export async function fetchTruckMovementData(collectorId, driverName) {
  if (!collectorId) {
    return { movement: [], collections: [], error: "No collector ID provided" };
  }

  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Fetch movement history in parallel with collections
    const [movementResult, collectionsResult] = await Promise.all([
      fetchMovementHistory(collectorId, yesterday),
      fetchCollectionsHistory(driverName, yesterday)
    ]);

    return {
      movement: movementResult.data || [],
      collections: collectionsResult.data || [],
      error: movementResult.error || collectionsResult.error
    };
  } catch (error) {
    console.error("Error fetching truck movement data:", error);
    return { movement: [], collections: [], error };
  }
}

/**
 * Fetch truck location history for movement analysis
 * @private
 * @param {string} collectorId - Collector identifier
 * @param {Date} since - Date to fetch from
 * @returns {Promise<{data: Array, error: any}>}
 */
async function fetchMovementHistory(collectorId, since) {
  const { data, error } = await supabase
    .from("trucklocation")
    .select("latitude, longitude, updated_at")
    .eq("collector_id", collectorId)
    .gte("updated_at", since.toISOString())
    .order("updated_at", { ascending: true });

  return { data, error };
}

/**
 * Fetch collections history for a driver
 * @private
 * @param {string} driverName - Driver name
 * @param {Date} since - Date to fetch from
 * @returns {Promise<{data: Array, error: any}>}
 */
async function fetchCollectionsHistory(driverName, since) {
  if (!driverName) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("collections")
    .select("collected_at, areas_collected, waste_type")
    .eq("collector_name", driverName)
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  return { data, error };
}

/**
 * Process raw movement history into graph-ready data
 * @param {Array} movementHistory - Raw movement data from database
 * @returns {Array} Processed movement data for charting
 */
export function processMovementHistory(movementHistory) {
  if (!movementHistory || movementHistory.length === 0) {
    return [];
  }

  const STOPPED_THRESHOLD_METERS = 50;
  const processedMovement = [];
  let currentStopLocation = null;
  let accumulatedStopTime = 0; // in milliseconds

  movementHistory.forEach((point, index) => {
    const time = new Date(point.updated_at);
    const timestamp = time.getTime();

    if (index === 0) {
      // First point - initialize
      currentStopLocation = {
        lat: point.latitude,
        lon: point.longitude,
      };
      processedMovement.push(createMovementPoint(time, timestamp, 0, 0, point));
    } else {
      const prevPoint = movementHistory[index - 1];
      const distance = calculateDistance(
        prevPoint.latitude, prevPoint.longitude,
        point.latitude, point.longitude
      );

      const timeDiff = timestamp - new Date(prevPoint.updated_at).getTime();

      if (distance < STOPPED_THRESHOLD_METERS) {
        // Truck is stopped (at collection site)
        processStopLocation(point, timeDiff, distance, time, timestamp, processedMovement);
      } else {
        // Truck is moving
        processMovingLocation(point, distance, time, timestamp, processedMovement);
      }
    }
  });

  return processedMovement;
}

/**
 * Process stopped truck location
 * @private
 * @param {Object} point - Current location point
 * @param {number} timeDiff - Time difference in milliseconds
 * @param {number} distance - Distance from previous point
 * @param {Date} time - Current timestamp
 * @param {number} timestamp - Current timestamp in milliseconds
 * @param {Array} processedMovement - Output array to modify
 */
function processStopLocation(point, timeDiff, distance, time, timestamp, processedMovement) {
  const currentStopLocation = processedMovement[processedMovement.length - 1]?.stopLocation;
  const STOPPED_THRESHOLD_METERS = 50;

  if (currentStopLocation) {
    // Check if still at the same stop location
    const stopDistance = calculateDistance(
      currentStopLocation.lat, currentStopLocation.lon,
      point.latitude, point.longitude
    );

    if (stopDistance < STOPPED_THRESHOLD_METERS) {
      // Still at same stop - accumulate time
      const lastIndex = processedMovement.length - 1;
      if (processedMovement[lastIndex]) {
        processedMovement[lastIndex].accumulatedStopTime =
          (processedMovement[lastIndex].accumulatedStopTime || 0) + timeDiff;
      }
    } else {
      // Moved to a new stop location
      point.stopLocation = { lat: point.latitude, lon: point.longitude };
      point.accumulatedStopTime = timeDiff;
      processedMovement.push(createMovementPoint(time, timestamp, calculateTimeSpent(timeDiff), distance, point));
    }
  } else {
    // Starting a new stop
    point.stopLocation = { lat: point.latitude, lon: point.longitude };
    point.accumulatedStopTime = timeDiff;
    processedMovement.push(createMovementPoint(time, timestamp, calculateTimeSpent(timeDiff), distance, point));
  }
}

/**
 * Process moving truck location
 * @private
 * @param {Object} point - Current location point
 * @param {number} distance - Distance from previous point
 * @param {Date} time - Current timestamp
 * @param {number} timestamp - Current timestamp in milliseconds
 * @param {Array} processedMovement - Output array to modify
 */
function processMovingLocation(point, distance, time, timestamp, processedMovement) {
  point.stopLocation = null;
  point.accumulatedStopTime = 0;
  processedMovement.push(createMovementPoint(time, timestamp, 0, distance, point));
}

/**
 * Create a movement data point for the graph
 * @private
 * @param {Date} time - Timestamp
 * @param {number} timestamp - Timestamp in milliseconds
 * @param {number} movement - Movement value (time spent or 0 for moving)
 * @param {number} distance - Distance moved
 * @param {Object} point - Original point data
 * @returns {Object} Processed movement point
 */
function createMovementPoint(time, timestamp, movement, distance, point) {
  return {
    time: time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    timestamp,
    movement,
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
    latitude: point.latitude,
    longitude: point.longitude,
    stopLocation: point.stopLocation,
    accumulatedStopTime: point.accumulatedStopTime
  };
}

/**
 * Calculate time spent in minutes from milliseconds
 * @private
 * @param {number} milliseconds - Time in milliseconds
 * @returns {number} Time in minutes (minimum 0.2)
 */
function calculateTimeSpent(milliseconds) {
  return Math.max(milliseconds / (1000 * 60), 0.2);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Process collections data for display
 * @param {Array} collections - Raw collections data
 * @returns {Array} Processed collections data
 */
export function processCollectionsData(collections = []) {
  return collections.map((collection) => ({
    timestamp: new Date(collection.collected_at).getTime(),
    time: new Date(collection.collected_at).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    areas: collection.areas_collected || [],
    wasteType: collection.waste_type || "Unknown",
    original: collection
  }));
}

/**
 * Find collector ID from various possible sources
 * @param {Object} truckData - Truck data from trucksDataRef
 * @param {string} truckId - Truck ID
 * @returns {Promise<string|null>} Collector ID or null
 */
export async function findCollectorId(truckData, truckId) {
  // Prefer collector_id from truck data
  if (truckData?.collector_id) {
    return truckData.collector_id;
  }

  // Try to find it from trucklocation table
  try {
    const { data, error } = await supabase
      .from("trucklocation")
      .select("collector_id, location_id")
      .eq("status", "active")
      .or(`collector_id.eq."${truckId}",location_id.eq."${truckId}"`)
      .limit(1);

    if (!error && data && data.length > 0) {
      return data[0].collector_id || truckId;
    }
  } catch (error) {
    console.warn("Error finding collector ID:", error);
  }

  return truckId;
}
