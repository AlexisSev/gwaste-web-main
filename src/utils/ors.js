const ORS_API_KEY = '5b3ce3597851110001cf6248dbaf9e65e9784aae890cb76f61ceff5c';

/**
 * Fetch a street-following polyline from OpenRouteService (ORS).
 * @param {Array<Array<number>>} waypoints - Array of [lon, lat] pairs.
 * @returns {Promise<Array<Array<number>>>} - Polyline as array of [lon, lat] pairs.
 */
export async function fetchORSRoute(waypoints) {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
  const body = { coordinates: waypoints };

  // Debug: log the request
  console.log('ORS request body:', JSON.stringify(body));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  // Debug: log the response
  const text = await response.text();
  console.log('ORS response:', response.status, text);

  if (!response.ok) {
    // Fallback: return a static route for simulation
    console.warn('ORS failed, using fallback static route.');
    return [
      [123.9866, 11.0517],
      [123.9900, 11.0600],
      [123.9957, 11.0801]
    ];
  }

  const data = JSON.parse(text);
  return data.features[0].geometry.coordinates;
} 