/**
 * Service for geocoding operations using OpenCage API
 */

/**
 * Cache for geocoding results
 */
const geocodingCache = new Map();

/**
 * Reverse geocode coordinates to get barangay using OpenCage API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} Barangay name or "Unknown Location"
 */
export async function getBarangayFromCoordinates(latitude, longitude) {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

  // Check cache first
  if (geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey);
  }

  try {
    // Use OpenCage API for Philippine barangays
    const OPENCAGE_API_KEY = "47176bb1582f427aa83292b2e2080e34";
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPENCAGE_API_KEY}&limit=1&countrycode=ph`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`OpenCage API HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // Extract barangay from OpenCage address components
    let barangay = "Unknown Location";

    if (data.results && data.results.length > 0) {
      const components = data.results[0].components;

      // Try different possible field names for barangay in Philippines
      // OpenCage uses different field names for Philippine addresses
      barangay =
        extractBarangayFromComponents(components);
    }

    // Cache the result
    geocodingCache.set(cacheKey, barangay);

    return barangay;
  } catch (error) {
    console.error("Error reverse geocoding with OpenCage:", error);
    return "Unknown Location";
  }
}

/**
 * Extract barangay name from OpenCage address components
 * @private
 * @param {Object} components - OpenCage address components
 * @returns {string} Barangay name or fallback
 */
function extractBarangayFromComponents(components) {
  // Most common for barangays
  if (components.village) return components.village;

  // Alternative names for barangays
  const barangayFields = [
    'suburb',
    'neighbourhood',
    'city_district',
    'town',
    'municipality',
    'county'
  ];

  for (const field of barangayFields) {
    if (components[field]) {
      return components[field];
    }
  }

  // Final fallback
  return components.city || "Unknown Location";
}

/**
 * Get viewer's current device barangay (browser geolocation)
 * @returns {Promise<string|null>} Barangay name or null if geolocation not available
 */
export async function updateUserBarangayFromDevice() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      console.warn("⚠️ Geolocation not supported in this browser");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          console.log("📍 Device location:", latitude, longitude);
          const barangay = await getBarangayFromCoordinates(
            latitude,
            longitude
          );
          console.log("📍 Device barangay resolved via OpenCage:", barangay);
          resolve(barangay);
        } catch (error) {
          console.error("❌ Failed to resolve device barangay:", error);
          resolve(null);
        }
      },
      (error) => {
        console.warn("⚠️ Geolocation error:", error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodingCache() {
  geocodingCache.clear();
}

/**
 * Get cache size for debugging
 * @returns {number} Number of cached locations
 */
export function getGeocodingCacheSize() {
  return geocodingCache.size;
}

/**
 * Test geocoding API connectivity
 * @returns {Promise<boolean>} True if API is responsive
 */
export async function testGeocodingAPI() {
  try {
    const testLat = 14.5955; // Manila, Philippines coordinates
    const testLng = 120.9842;

    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${testLat}+${testLng}&key=47176bb1582f427aa83292b2e2080e34&limit=1&countrycode=ph`,
      {
        headers: { Accept: "application/json" },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Geocoding API test failed:", error);
    return false;
  }
}
