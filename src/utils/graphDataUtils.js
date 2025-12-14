/**
 * Utilities for processing graph data in MapTracking component
 */

/**
 * Build complete graph data object from movement and collections
 * @param {Array} movementData - Processed movement data points
 * @param {Array} collectionsData - Processed collections data
 * @returns {Object} Graph data object ready for chart components
 */
export function buildGraphData(movementData, collectionsData) {
  return {
    movement: movementData || [],
    collections: collectionsData || [],
    hasData: (movementData?.length > 0) || (collectionsData?.length > 0),
    movementPoints: movementData?.length || 0,
    collectionEvents: collectionsData?.length || 0
  };
}

/**
 * Process raw collections data for graph display
 * @param {Array} collectionsHistory - Raw collections from database
 * @returns {Array} Processed collections with timestamps and display info
 */
export function processCollectionsHistory(collectionsHistory = []) {
  if (!Array.isArray(collectionsHistory)) return [];

  return collectionsHistory.map(collection => ({
    timestamp: new Date(collection.collected_at).getTime(),
    time: new Date(collection.collected_at).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: new Date(collection.collected_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    areas: Array.isArray(collection.areas_collected)
      ? collection.areas_collected.filter(area => area && typeof area === 'string')
      : [],
    wasteType: collection.waste_type || "Unknown",
    original: collection
  }));
}

/**
 * Find collections that match movement timestamps for graph annotations
 * @param {Array} movementData - Movement data points
 * @param {Array} collectionsData - Collections data
 * @param {number} timeWindowMs - Time window for matching (default 5 minutes)
 * @returns {Array} Matched collection events for graph display
 */
export function findCollectionMatches(movementData, collectionsData, timeWindowMs = 300000) {
  if (!Array.isArray(movementData) || !Array.isArray(collectionsData)) {
    return [];
  }

  return collectionsData.map(collection => {
    // Find movement point closest to collection timestamp
    const collectionTime = collection.timestamp || collection.collected_at;

    let closestMovement = null;
    let minTimeDiff = Infinity;

    movementData.forEach(movement => {
      const timeDiff = Math.abs((movement.timestamp || 0) - collectionTime);
      if (timeDiff < minTimeDiff && timeDiff <= timeWindowMs) {
        minTimeDiff = timeDiff;
        closestMovement = movement;
      }
    });

    return {
      ...collection,
      matchingMovement: closestMovement,
      timeDifference: minTimeDiff,
      hasMatch: closestMovement !== null
    };
  }).filter(match => match.hasMatch);
}

/**
 * Calculate graph statistics from movement and collection data
 * @param {Array} movementData - Movement data points
 * @param {Array} collectionsData - Collections data
 * @returns {Object} Statistics object
 */
export function calculateGraphStatistics(movementData = [], collectionsData = []) {
  if (movementData.length === 0 && collectionsData.length === 0) {
    return {
      totalDistance: 0,
      averageSpeed: 0,
      totalStopTime: 0,
      collectionEfficiency: 0,
      dataPoints: 0,
      timeSpan: 0
    };
  }

  // Calculate basic stats from movement data
  const totalDistance = movementData.reduce((sum, point) => sum + (point.distance || 0), 0);
  const totalStopTime = movementData
    .filter(point => point.movement > 0.1) // Filter out very small stops
    .reduce((sum, point) => sum + point.movement, 0);

  // Calculate time span
  if (movementData.length > 0) {
    const firstTime = Math.min(...movementData.map(p => p.timestamp || 0));
    const lastTime = Math.max(...movementData.map(p => p.timestamp || 0));
    const timeSpanHours = (lastTime - firstTime) / (1000 * 60 * 60); // in hours

    // Calculate average speed (simplified)
    const averageSpeed = timeSpanHours > 0 ? totalDistance / timeSpanHours : 0;

    // Calculate collection efficiency (collections per hour)
    const collectionEfficiency = timeSpanHours > 0 ? collectionsData.length / timeSpanHours : 0;

    return {
      totalDistance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      totalStopTime: Math.round(totalStopTime * 10) / 10,
      collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
      dataPoints: movementData.length,
      timeSpan: Math.round(timeSpanHours * 10) / 10
    };
  }

  return {
    totalDistance: 0,
    averageSpeed: 0,
    totalStopTime: 0,
    collectionEfficiency: collectionsData.length > 0 ? collectionsData.length : 0,
    dataPoints: movementData.length,
    timeSpan: 0
  };
}

/**
 * Generate chart tooltip content for movement points
 * @param {Object} data - Chart data point
 * @param {string} dataKey - Which data series (movement/distance)
 * @returns {Object} Tooltip content configuration
 */
export function generateTooltipContent(data, dataKey) {
  if (!data || !data.payload || data.payload.length === 0) {
    return { content: null };
  }

  const point = data.payload[0];

  if (dataKey === 'movement') {
    if (!point.movement || point.movement === 0) {
      return {
        label: point.time || 'Unknown time',
        content: 'Truck in transit (moving)'
      };
    }

    const minutes = Math.floor(point.movement);
    const seconds = Math.floor((point.movement - minutes) * 60);

    return {
      label: point.time || 'Unknown time',
      content: `${minutes}m ${seconds}s at collection site`
    };
  }

  if (dataKey === 'distance') {
    const distance = point.distance || 0;
    return {
      label: point.time || 'Unknown time',
      content: `${distance.toFixed(1)}m moved since last update`
    };
  }

  return { content: null };
}

/**
 * Format collection tooltip
 * @param {Object} collection - Collection data
 * @returns {string} Formatted tooltip text
 */
export function formatCollectionTooltip(collection) {
  if (!collection) return '';

  const areas = Array.isArray(collection.areas) && collection.areas.length > 0
    ? collection.areas.join(', ')
    : 'Unknown areas';

  return `${collection.time} - ${areas}`;
}

/**
 * Get color scheme for different data types in charts
 * @returns {Object} Color mapping for chart elements
 */
export function getChartColors() {
  return {
    movement: '#4B8B3B',     // Green for time spent
    distance: '#2196F3',     // Blue for distance moved
    collection: '#FF9800',   // Orange for collection events
    inactive: '#9E9E9E',     // Gray for inactive periods
    background: '#FFFFFF',
    grid: '#F5F5F5'
  };
}

/**
 * Validate graph data before rendering
 * @param {Object} graphData - Graph data object
 * @returns {Object} Validation result with errors
 */
export function validateGraphData(graphData) {
  const errors = [];
  const warnings = [];

  if (!graphData) {
    errors.push('Graph data is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(graphData.movement)) {
    errors.push('Movement data must be an array');
  } else if (graphData.movement.length === 0) {
    warnings.push('No movement data available');
  }

  if (!Array.isArray(graphData.collections)) {
    errors.push('Collections data must be an array');
  } else if (graphData.collections.length === 0) {
    warnings.push('No collection data available');
  }

  // Check for data consistency
  if (graphData.movement && graphData.movement.length > 0) {
    const invalidPoints = graphData.movement.filter(point => !point.timestamp);
    if (invalidPoints.length > 0) {
      warnings.push(`${invalidPoints.length} movement points missing timestamps`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create reference lines for collection events on the graph
 * @param {Array} collectionsData - Collections data
 * @param {Array} movementData - Movement data for matching
 * @returns {Array} Chart reference line components
 */
export function createCollectionReferenceLines(collectionsData, movementData) {
  if (!Array.isArray(collectionsData) || !Array.isArray(movementData)) {
    return [];
  }

  return collectionsData.map((collection, index) => {
    // Find closest movement point by timestamp
    const collectionTime = collection.timestamp;
    let closestMovement = null;
    let minDiff = Infinity;

    movementData.forEach(movement => {
      const diff = Math.abs((movement.timestamp || 0) - collectionTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestMovement = movement;
      }
    });

    if (closestMovement) {
      return {
        x: closestMovement.time,
        stroke: '#e74c3c',
        strokeWidth: 2,
        strokeDasharray: '3 3',
        label: {
          value: '📦',
          position: 'top',
          fill: '#e74c3c',
          fontSize: '14px'
        },
        key: `collection-${index}`
      };
    }

    return null;
  }).filter(line => line !== null);
}

/**
 * Export graph data for external use (CSV, etc.)
 * @param {Object} graphData - Complete graph data object
 * @returns {string} CSV formatted data
 */
export function exportGraphDataToCSV(graphData) {
  const lines = ['Time,Timestamp,Movement (minutes),Distance (m),Collections'];

  if (graphData.movement && Array.isArray(graphData.movement)) {
    graphData.movement.forEach(point => {
      const collections = graphData.collections ? graphData.collections.filter(
        c => Math.abs((c.timestamp || 0) - (point.timestamp || 0)) < 300000 // 5 minutes window
      ).length : 0;

      lines.push(`${point.time},${point.timestamp},${point.movement},${point.distance},${collections}`);
    });
  }

  return lines.join('\n');
}

/**
 * Get empty state content for when no graph data is available
 * @returns {Object} Empty state configuration
 */
export function getEmptyGraphState() {
  return {
    icon: '📊',
    title: 'No movement data available',
    description: 'The truck has not been active in the last 24 hours.',
    action: null
  };
}
