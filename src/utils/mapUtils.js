/**
 * Utilities for map functionality in MapTracking component
 */

/**
 * Check if truck is online based on last update time
 * @param {string|Date} updatedAt - Last update timestamp
 * @param {number} offlineThresholdMinutes - Threshold in minutes (default 5)
 * @returns {boolean} True if online
 */
export function isTruckOnline(updatedAt, offlineThresholdMinutes = 5) {
  if (!updatedAt) return false;

  try {
    const updatedTime = new Date(updatedAt).getTime();
    const now = Date.now();
    const thresholdMs = offlineThresholdMinutes * 60 * 1000;

    return now - updatedTime <= thresholdMs;
  } catch (error) {
    console.warn("Error checking truck online status:", error);
    return false;
  }
}

/**
 * Format timestamp for display in UI elements
 * @param {string|Date} timestamp - Timestamp to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted timestamp or fallback
 */
export function formatTruckTimestamp(timestamp, options = {}) {
  if (!timestamp) return "N/A";

  try {
    const date = new Date(timestamp);

    // Default to a simple format if no options provided
    if (Object.keys(options).length === 0) {
      return date.toLocaleString();
    }

    return date.toLocaleString(undefined, options);
  } catch (error) {
    console.warn("Error formatting timestamp:", error);
    return "Invalid Date";
  }
}

/**
 * Determine the appropriate map zoom level based on truck distribution
 * @param {Array} truckLocations - Array of truck location objects with lat/lng
 * @returns {number} Recommended zoom level
 */
export function calculateMapZoom(truckLocations = []) {
  if (truckLocations.length === 0) return 13;

  try {
    // Calculate bounding box
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    truckLocations.forEach(truck => {
      const lat = truck.latitude || truck.lat;
      const lng = truck.longitude || truck.lng;

      if (lat !== undefined && lng !== undefined) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
    });

    // Calculate spans
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Simple zoom calculation based on span
    const maxSpan = Math.max(latSpan, lngSpan);

    if (maxSpan < 0.01) return 18; // Very close together
    if (maxSpan < 0.1) return 15;
    if (maxSpan < 0.5) return 13;
    if (maxSpan < 2) return 11;
    if (maxSpan < 5) return 9;
    return 7; // Widely distributed
  } catch (error) {
    console.warn("Error calculating map zoom:", error);
    return 13; // Default zoom
  }
}

/**
 * Calculate center point for truck locations
 * @param {Array} truckLocations - Array of truck location objects
 * @returns {Array} [longitude, latitude] center coordinates
 */
export function calculateMapCenter(truckLocations = []) {
  if (truckLocations.length === 0) return [123.9866, 11.0517]; // Default center

  try {
    let totalLat = 0, totalLng = 0, count = 0;

    truckLocations.forEach(truck => {
      const lat = truck.latitude || truck.lat;
      const lng = truck.longitude || truck.lng;

      if (lat !== undefined && lng !== undefined) {
        totalLat += lat;
        totalLng += lng;
        count++;
      }
    });

    if (count === 0) return [123.9866, 11.0517];

    // Return [longitude, latitude] as expected by MapLibre
    return [totalLng / count, totalLat / count];
  } catch (error) {
    console.warn("Error calculating map center:", error);
    return [123.9866, 11.0517];
  }
}

/**
 * Get truck location coordinates in MapLibre format [lng, lat]
 * @param {Object} truck - Truck location object
 * @returns {Array|null} [longitude, latitude] or null if invalid
 */
export function getTruckCoordinates(truck) {
  if (!truck) return null;

  const latitude = truck.latitude ?? truck.lat;
  const longitude = truck.longitude ?? truck.lng;

  if (latitude == null || longitude == null) return null;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  // Validate coordinate ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return [longitude, latitude];
}

/**
 * Check if string is a valid UUID for collector identification
 * @param {string} str - String to test
 * @returns {boolean} True if valid UUID
 */
export function isValidCollectorUUID(str) {
  if (!str || typeof str !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
}

/**
 * Extract collector identifier from various possible fields
 * @param {Object} truck - Truck location data
 * @returns {string|null} Collector identifier or null
 */
export function getCollectorId(truck) {
  if (!truck) return null;

  return truck.collector_id || truck.truck_id || truck.id || truck.location_id || null;
}

/**
 * Determine truck marker size based on zoom level
 * @param {number} zoom - Current map zoom level
 * @returns {Object} Size object with width and height
 */
export function getMarkerSize(zoom) {
  // Smaller markers at lower zoom levels, larger at higher zoom
  if (zoom >= 16) return { width: 36, height: 36, fontSize: 20 };
  if (zoom >= 14) return { width: 32, height: 32, fontSize: 18 };
  if (zoom >= 12) return { width: 28, height: 28, fontSize: 16 };
  return { width: 24, height: 24, fontSize: 14 };
}

/**
 * Create CSS style object for truck marker
 * @param {string} color - Truck color
 * @param {number} zoom - Current zoom level
 * @returns {string} CSS style string
 */
export function createMarkerStyle(color, zoom = 13) {
  const size = getMarkerSize(zoom);
  const style = `
    width: ${size.width}px;
    height: ${size.height}px;
    background-color: ${color};
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${size.fontSize}px;
    color: #fff;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `.trim();

  return style;
}

/**
 * Filter truck locations by online status and user role
 * @param {Array} truckLocations - Raw truck locations
 * @param {string} userRole - User role (admin|collector)
 * @param {string} collectorId - Specific collector ID for filtering
 * @param {number} offlineThresholdMinutes - Offline threshold
 * @returns {Array} Filtered truck locations
 */
export function filterTruckLocations(truckLocations, userRole, collectorId, offlineThresholdMinutes = 5) {
  if (!Array.isArray(truckLocations)) return [];

  return truckLocations.filter(truck => {
    // Must be online
    if (!isTruckOnline(truck.updated_at || truck.inserted_at, offlineThresholdMinutes)) {
      return false;
    }

    // Must be active
    if (truck.status !== 'active') {
      return false;
    }

    // Filter by collector if user is not admin
    if (userRole === 'collector' && collectorId) {
      const truckCollectorId = getCollectorId(truck);
      return truckCollectorId === collectorId;
    }

    // Admin sees all (filtered above)
    return true;
  });
}

/**
 * Sort trucks by last update time (most recent first)
 * @param {Array} trucks - Array of truck objects
 * @returns {Array} Sorted trucks
 */
export function sortTrucksByUpdateTime(trucks) {
  if (!Array.isArray(trucks)) return [];

  return [...trucks].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.updated_at || 0).getTime();
    const timeB = new Date(b.updatedAt || b.updated_at || 0).getTime();
    return timeB - timeA; // Most recent first
  });
}

/**
 * Get truck status display information
 * @param {Object} truck - Truck object
 * @returns {Object} Status info with text, color, and icon
 */
export function getTruckStatusInfo(truck) {
  if (!isTruckOnline(truck?.updatedAt || truck?.updated_at)) {
    return {
      text: "Offline",
      color: "#999",
      icon: "⚪"
    };
  }

  // Additional status could be added here based on other truck properties
  return {
    text: "Online",
    color: "#4CAF50",
    icon: "🟢"
  };
}
