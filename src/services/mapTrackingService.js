/**
 * Service for handling map tracking operations
 */

import maplibregl from "maplibre-gl";
import { supabase } from "../supabaseClient";
import { getBarangayFromCoordinates } from "./geocodingService";

/**
 * Initialize the MapLibre map instance
 * @param {Object} options - Map initialization options
 * @returns {Object} Initialized map instance
 */
export function initializeMap(options = {}) {
  const defaultOptions = {
    container: "map",
    style: `https://api.maptiler.com/maps/streets/style.json?key=g3VtfcpqNpVZJtfaXXcB`,
    center: [123.9866, 11.0517], // lng, lat
    zoom: 13,
    pitch: 50,
    bearing: 0,
  };

  const map = new maplibregl.Map({ ...defaultOptions, ...options });

  // Add 3D buildings layer when map loads
  map.on("load", () => {
    map.addLayer({
      'id': '3d-buildings',
      'source': 'maptiler',
      'source-layer': 'building',
      'type': 'fill-extrusion',
      'minzoom': 15,
      'paint': {
        'fill-extrusion-color': '#aaa',
        'fill-extrusion-height': ['get', 'render_height'],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': 0.6
      }
    }, 'building');
  });

  return map;
}

/**
 * Fetch truck locations data from Supabase
 * @param {string} userRole - User role (admin or collector)
 * @param {string} collectorId - Collector ID if role is collector
 * @param {number} offlineThresholdMinutes - Minutes to consider truck offline
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function fetchTruckLocations(userRole, collectorId, offlineThresholdMinutes = 5) {
  // Calculate the cutoff time for online trucks
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - offlineThresholdMinutes);

  let query = supabase
    .from("trucklocation")
    .select("*")
    .order("updated_at", { ascending: false });

  // Always filter for active trucks only
  query = query.eq("status", "active");

  // Filter for trucks updated within the threshold (online trucks only)
  query = query.gte("updated_at", cutoffTime.toISOString());

  // Filter by collector_id if user is a collector
  if (userRole === "collector" && collectorId) {
    query = query.eq("collector_id", collectorId);
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Setup realtime subscription for truck locations
 * @param {string} userRole - User role
 * @param {string} collectorId - Collector ID for collectors
 * @param {Function} onUpdate - Callback for updates
 * @param {Function} onError - Callback for errors
 * @param {number} offlineThresholdMinutes - Offline threshold
 * @returns {Object} Subscription channel
 */
export function setupTruckSubscription(userRole, collectorId, onUpdate, onError, offlineThresholdMinutes = 5) {
  let filterString = "status=eq.active";

  // Add collector filter for collectors
  if (userRole === "collector" && collectorId) {
    filterString += `,collector_id=eq.${collectorId}`;
  }

  const channel = supabase
    .channel(`realtime:trucklocation:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "trucklocation",
        filter: filterString,
      },
      async (payload) => {
        try {
          console.log(
            "📡 Real-time update received:",
            payload.eventType,
            payload.new?.collector_id || payload.old?.collector_id
          );

          // Calculate if update is recent enough to be considered "online"
          const updatedAt = payload.new?.updated_at || payload.old?.updated_at;
          const isOnline = updatedAt && isTruckOnline(updatedAt, offlineThresholdMinutes);

          if (payload.eventType === "DELETE") {
            onUpdate({ type: "DELETE", data: payload.old });
          } else if (payload.eventType === "UPDATE") {
            const newData = payload.new;
            const oldData = payload.old;

            if (oldData.status === "active" && newData.status !== "active") {
              onUpdate({ type: "DELETE", data: oldData });
            } else if (newData.status === "active" && isOnline) {
              onUpdate({ type: "UPDATE", data: newData });
            } else if (!isOnline && oldData) {
              onUpdate({ type: "DELETE", data: oldData });
            }
          } else if (payload.eventType === "INSERT") {
            if (payload.new.status === "active" && isOnline) {
              onUpdate({ type: "INSERT", data: payload.new });
            }
          }
        } catch (err) {
          onError?.(err);
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("✅ Real-time subscription active");
      } else if (status === "CHANNEL_ERROR") {
        console.error("❌ Real-time subscription error");
        onError?.(new Error("Real-time subscription error"));
      } else if (status === "TIMED_OUT") {
        console.warn("⚠️ Real-time subscription timed out, relying on polling");
      } else {
        console.log("📡 Real-time subscription status:", status);
      }
    });

  return channel;
}

/**
 * Poll truck locations as fallback for realtime subscription
 * @param {string} userRole - User role
 * @param {string} collectorId - Collector ID for collectors
 * @param {Function} onUpdate - Callback for updates
 * @param {Function} onError - Callback for errors
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {number} offlineThresholdMinutes - Offline threshold
 * @returns {Function} Cleanup function
 */
export function startPolling(userRole, collectorId, onUpdate, onError, intervalMs = 4000, offlineThresholdMinutes = 5) {
  const pollingInterval = setInterval(async () => {
    try {
      const { data, error } = await fetchTruckLocations(userRole, collectorId, offlineThresholdMinutes);

      if (error) {
        onError?.(error);
        return;
      }

      if (Array.isArray(data)) {
        // Process each truck location
        for (const row of data) {
          onUpdate({ type: "POLL_UPDATE", data: row });
        }
      }
    } catch (err) {
      onError?.(err);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(pollingInterval);
}

/**
 * Create or update a truck marker on the map
 * @param {Object} map - MapLibre map instance
 * @param {Object} trucksDataRef - Reference to trucks data store
 * @param {Object} driverCacheRef - Reference to driver cache
 * @param {Object} truckMarkersRef - Reference to markers store
 * @param {Object} row - Truck location data
 * @param {string} userRole - User role for click handling
 * @param {Function} onMarkerClick - Click handler for admin users
 * @returns {Promise<Object>} Updated truck data
 */
export async function upsertTruckMarker(
  map, trucksDataRef, driverCacheRef, truckMarkersRef, row,
  userRole, onMarkerClick
) {
  // Use collector_id as the stable identifier for marker and color
  const id = row.collector_id || row.truck_id || row.id || row.location_id;
  const latitude = row.latitude ?? row.lat;
  const longitude = row.longitude ?? row.lng;

  if (!latitude || !longitude || !id) return null;

  // Check if truck is online (should be done by caller, but double-check)
  const updatedAt = row.updated_at || row.inserted_at;
  if (!isTruckOnline(updatedAt)) {
    removeTruckMarker(truckMarkersRef, id);
    if (trucksDataRef.current[id]) {
      delete trucksDataRef.current[id];
    }
    return null;
  }

  // Get or assign color
  let color = trucksDataRef.current[id]?.color;
  if (!color) {
    color = assignTruckColor(id);
  }

  // Get driver info
  let driverInfo = driverCacheRef.current[id];
  if (!driverInfo) {
    driverInfo = await fetchDriverInfo(id);
    if (driverInfo) {
      driverCacheRef.current[id] = driverInfo;
    }
  }

  const coords = [longitude, latitude]; // MapLibre uses [lng, lat]

  // Update or create marker
  if (truckMarkersRef.current[id]) {
    updateExistingMarker(truckMarkersRef.current[id], color, longitude, latitude);
  } else {
    truckMarkersRef.current[id] = await createNewMarker(
      map, id, coords, color, userRole, onMarkerClick
    );
  }

  // Get barangay
  const barangay = await getBarangayFromCoordinates(latitude, longitude);

  // Update data store
  const truckData = {
    id,
    collector_id: row.collector_id || id,
    latitude: Number(latitude),
    longitude: Number(longitude),
    updatedAt: updatedAt || new Date().toISOString(),
    driverName: driverInfo?.driver || "Driver",
    profileImage: driverInfo?.profile_image || null,
    color,
    barangay,
    originalData: row
  };

  trucksDataRef.current[id] = truckData;
  return truckData;
}

/**
 * Remove a truck marker from the map
 * @param {Object} truckMarkersRef - Reference to markers store
 * @param {string} id - Truck identifier
 * @param {Object} trucksDataRef - Reference to data store
 */
export function removeTruckMarker(truckMarkersRef, id, trucksDataRef) {
  if (!id) return;

  if (truckMarkersRef.current[id]) {
    truckMarkersRef.current[id].remove();
    delete truckMarkersRef.current[id];
  }

  if (trucksDataRef?.current[id]) {
    // Clean up assigned color
    clearAssignedColor(id);
    delete trucksDataRef.current[id];
  }
}

/**
 * Fetch driver information from collectors table
 * @param {string} collectorId - Collector identifier
 * @returns {Promise<Object|null>} Driver info or null
 */
async function fetchDriverInfo(collectorId) {
  try {
    // Try to match by collector_id first
    let query = supabase
      .from("collectors")
      .select("driver, firstName, lastName, profile_image, collector_id, id, status")
      .eq("collector_id", collectorId)
      .eq("status", "active")
      .limit(1);

    let { data, error } = await query.single();

    // If no match and collectorId looks like UUID, try matching by id column
    if (error && isValidUUID(collectorId)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("collectors")
        .select("driver, firstName, lastName, profile_image, collector_id, id, status")
        .eq("id", collectorId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!fallbackError && fallbackData) {
        data = fallbackData;
        error = null;
      }
    }

    if (!error && data) {
      const name = data.driver ||
                   [data.firstName, data.lastName].filter(Boolean).join(" ") ||
                   "Driver";
      return {
        driver: name,
        profile_image: data.profile_image || null,
        collectorData: data
      };
    }
  } catch (error) {
    console.warn(`Error fetching driver info for ${collectorId}:`, error);
  }

  return { driver: "Unknown Driver", profile_image: null };
}

/**
 * Update an existing marker's appearance and position
 * @private
 * @param {Object} marker - MapLibre marker
 * @param {string} color - Truck color
 * @param {number} longitude - Longitude
 * @param {number} latitude - Latitude
 */
function updateExistingMarker(marker, color, longitude, latitude) {
  const el = marker.getElement();
  const expectedHTML = createTruckMarkerHTML(color);

  if (el.innerHTML !== expectedHTML) {
    el.innerHTML = expectedHTML;
  }

  // Update position instantly (no animations to reduce complexity)
  marker.setLngLat([longitude, latitude]);
}

/**
 * Create a new truck marker
 * @private
 * @param {Object} map - MapLibre map instance
 * @param {string} id - Truck identifier
 * @param {Array} coords - [longitude, latitude]
 * @param {string} color - Truck color
 * @param {string} userRole - User role
 * @param {Function} onMarkerClick - Click callback
 * @returns {Object} MapLibre marker
 */
function createNewMarker(map, id, coords, color, userRole, onMarkerClick) {
  const el = document.createElement('div');
  el.className = 'truck-marker';
  el.innerHTML = createTruckMarkerHTML(color);
  el.style.width = '32px';
  el.style.height = '32px';

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat(coords)
    .addTo(map);

  // Add click handler for admin users
  if (userRole === "admin" && onMarkerClick) {
    marker.on('click', (e) => {
      console.log("🚛 Truck marker clicked for admin:", id);
      onMarkerClick(id);
      e.originalEvent.stopPropagation();
    });
  }

  return marker;
}

/**
 * Create HTML for truck marker
 * @private
 * @param {string} color - Truck color
 * @returns {string} HTML string
 */
function createTruckMarkerHTML(color) {
  return `<div style="width:32px;height:32px;background-color:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🚛</div>`;
}

// Color assignment system (global state for uniqueness)
const assignedTruckColors = new Map();
const COLOR_PALETTE = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
  "#2980b9", "#27ae60", "#d35400", "#8e44ad", "#f1c40f",
  "#e91e63", "#00bcd4", "#ff5722", "#795548", "#607d8b",
  "#4caf50", "#ff9800", "#3f51b5", "#009688", "#ffeb3b"
];

/**
 * Assign a unique color to a truck ID
 * @param {string} id - Truck identifier
 * @returns {string} Hex color code
 */
function assignTruckColor(id) {
  // Check if this ID already has an assigned color
  if (assignedTruckColors.has(id)) {
    return assignedTruckColors.get(id);
  }

  // Calculate hash for deterministic color assignment
  const hash = hashString(String(id));
  let colorIndex = hash % COLOR_PALETTE.length;
  let color = COLOR_PALETTE[colorIndex];

  // If color is already assigned to another truck, find next available color
  const usedColors = new Set(Array.from(assignedTruckColors.values()));
  if (usedColors.has(color)) {
    for (let i = 0; i < COLOR_PALETTE.length; i++) {
      const nextIndex = (colorIndex + i) % COLOR_PALETTE.length;
      const nextColor = COLOR_PALETTE[nextIndex];
      if (!usedColors.has(nextColor)) {
        color = nextColor;
        break;
      }
    }
  }

  // Assign and cache the color
  assignedTruckColors.set(id, color);
  return color;
}

/**
 * Clear assigned color for truck ID
 * @param {string} id - Truck identifier
 */
function clearAssignedColor(id) {
  assignedTruckColors.delete(id);
}

/**
 * Hash string for deterministic color assignment
 * @private
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Check if truck is online based on last update time
 * @param {string|Date} updatedAt - Last update timestamp
 * @param {number} offlineThresholdMinutes - Threshold in minutes
 * @returns {boolean} True if online
 */
function isTruckOnline(updatedAt, offlineThresholdMinutes = 5) {
  if (!updatedAt) return false;

  const updatedTime = new Date(updatedAt).getTime();
  const now = Date.now();
  const thresholdMs = offlineThresholdMinutes * 60 * 1000;

  return now - updatedTime <= thresholdMs;
}

/**
 * Check if string is a valid UUID
 * @private
 * @param {string} str - String to test
 * @returns {boolean} True if UUID
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Cleanup map tracking resources
 * @param {Object} channel - Subscription channel
 * @param {Function} clearPolling - Polling cleanup function
 * @param {Object} truckMarkersRef - Markers reference
 */
export function cleanupMapTracking(channel, clearPolling, truckMarkersRef) {
  // Cleanup real-time subscription
  try {
    if (channel) {
      supabase.removeChannel(channel);
    }
  } catch (error) {
    console.warn("Error cleaning up subscription:", error);
  }

  // Cleanup polling
  try {
    if (clearPolling) {
      clearPolling();
    }
  } catch (error) {
    console.warn("Error cleaning up polling:", error);
  }

  // Cleanup markers
  try {
    if (truckMarkersRef?.current) {
      Object.values(truckMarkersRef.current).forEach(marker => {
        if (marker && marker.remove) {
          marker.remove();
        }
      });
      truckMarkersRef.current = {};
    }
  } catch (error) {
    console.warn("Error cleaning up markers:", error);
  }

  // Clear color assignments
  assignedTruckColors.clear();
}
