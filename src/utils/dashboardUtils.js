/**
 * Utility functions for Dashboard calculations and processing
 */

// Time formatting utility
export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${ampm}`;
}

// Expand collections by area utility
export function expandCollectionsByArea(collectionsData) {
  if (!collectionsData || !Array.isArray(collectionsData)) {
    return [];
  }

  const expanded = [];
  collectionsData.forEach(collection => {
    if (!collection) return;

    const areas = Array.isArray(collection.areas_collected)
      ? collection.areas_collected
      : (collection.areas_collected ? [collection.areas_collected] : ['N/A']);

    // If no areas, still create one entry
    if (areas.length === 0) {
      areas.push('N/A');
    }

    // Get base timestamps
    const collectedAt = collection.collected_at ? new Date(collection.collected_at) : null;
    const updatedAt = collection.updated_at ? new Date(collection.updated_at) : null;
    const createdAt = collection.created_at ? new Date(collection.created_at) : null;

    // Determine if collection was updated (indicating areas were added later)
    const wasUpdated = updatedAt && collectedAt && updatedAt.getTime() > collectedAt.getTime() + 1000; // 1 second buffer

    // Calculate time difference if updated
    const timeDiff = wasUpdated && areas.length > 1
      ? (updatedAt.getTime() - collectedAt.getTime()) / areas.length
      : 0;

    // Create a separate entry for each area with estimated time
    areas.forEach((area, index) => {
      // Check if metadata has per-area timestamps (from collector app)
      const metadata = collection.metadata || {};
      const areaTimestamps = metadata.area_timestamps || {};
      const normalizedArea = String(area || '').trim();
      const areaTimestamp = areaTimestamps[normalizedArea] ||
                           areaTimestamps[area] ||
                           Object.values(areaTimestamps).find((ts, idx) =>
                             Object.keys(areaTimestamps)[idx]?.toLowerCase() === normalizedArea.toLowerCase()
                           );

      let estimatedTime;

      if (areaTimestamp) {
        // Use exact timestamp from metadata if available
        estimatedTime = new Date(areaTimestamp);
      } else {
        // Estimate time for this area:
        // - First area: use collected_at (or created_at if collected_at is null)
        // - Subsequent areas: use collected_at + (index * estimated interval)
        // - If collection was updated, distribute the time difference across areas
        estimatedTime = collectedAt || createdAt || new Date();

        if (areas.length > 1 && index > 0) {
          if (wasUpdated && timeDiff > 0) {
            // Distribute the time difference across areas
            estimatedTime = new Date(collectedAt.getTime() + (timeDiff * index));
          } else if (collectedAt) {
            // Estimate 15-30 minutes per area if no update info
            const minutesPerArea = 20; // Average 20 minutes per area
            estimatedTime = new Date(collectedAt.getTime() + (index * minutesPerArea * 60 * 1000));
          }
        }
      }

      expanded.push({
        ...collection,
        id: `${collection.id || 'unknown'}-${index}`, // Unique ID for each expanded entry
        areas_collected: area, // Single area instead of array
        original_id: collection.id, // Keep reference to original collection
        // Override collected_at with estimated time for this specific area
        collected_at: estimatedTime.toISOString(),
        // Store original collected_at for reference
        original_collected_at: collection.collected_at
      });
    });
  });
  return expanded;
}

// Sort collections by collected_at (newest first)
export function sortCollectionsByDate(expandedCollections) {
  return [...expandedCollections].sort((a, b) => {
    const timeA = a.collected_at ? new Date(a.collected_at).getTime() : 0;
    const timeB = b.collected_at ? new Date(b.collected_at).getTime() : 0;
    return timeB - timeA; // Descending order (newest first)
  });
}

// Calculate dashboard summary statistics
export function calculateDashboardStats(routes, expandedCollections, reports) {
  const totalSchedules = routes.length;
  const uniqueDrivers = new Set(routes.map(r => r.driver)).size;

  // Helper to get unique routes by route number
  const uniqueRoutes = Object.values(
    routes.reduce((acc, route) => {
      if (!acc[route.route]) acc[route.route] = route;
      return acc;
    }, {})
  );

  // For totalCrew, count unique crew members across all uniqueRoutes
  const crewNames = uniqueRoutes.flatMap(r =>
    (r.crew || []).map(member =>
      typeof member === "string"
        ? member.trim()
        : [member.firstName, member.lastName].filter(Boolean).join(" ").trim()
    )
  ).filter(Boolean);
  const totalCrew = new Set(crewNames).size;

  // Calculate completed pickups (total collections) - count expanded collections
  const completedPickups = expandedCollections.length;

  // Calculate reports statistics
  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const resolvedReports = reports.filter(r => r.status === 'resolved').length;
  const totalReportsCount = reports.length;

  const todayIso = new Date().toISOString().split('T')[0];
  const todayCollections = expandedCollections.filter(collection => {
    const date = collection.collected_date || collection.created_at?.split('T')[0];
    return date === todayIso;
  }).length;

  const spotlightStats = [
    { label: 'Active routes', value: uniqueRoutes.length, sub: 'Monitored' },
    { label: 'Drivers', value: uniqueDrivers, sub: 'On duty' },
    { label: 'Crew members', value: totalCrew, sub: 'Assigned' },
    { label: 'Collections today', value: todayCollections, sub: 'Logged' },
  ];

  return {
    totalSchedules,
    uniqueRoutes,
    uniqueDrivers,
    totalCrew,
    completedPickups,
    pendingReports,
    resolvedReports,
    totalReportsCount,
    todayCollections,
    spotlightStats
  };
}

// Calculate collections analytics for the chart
export function getCollectionsByDate(expandedCollections) {
  const last7Days = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days[dateStr] = 0;
  }

  expandedCollections.forEach(collection => {
    const date = collection.collected_date || collection.created_at?.split('T')[0];
    if (date && last7Days.hasOwnProperty(date)) {
      last7Days[date]++;
    }
  });

  return Object.entries(last7Days).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    collections: count
  }));
}

// Calculate weekly analytics statistics
export function calculateWeeklyAnalytics(collectionsByDate) {
  const last7DaysTotal = collectionsByDate.reduce((sum, day) => sum + day.collections, 0);
  const averagePerDay = last7DaysTotal > 0 ? (last7DaysTotal / 7).toFixed(1) : 0;
  const peakDay = collectionsByDate.reduce((max, day) =>
    day.collections > max.collections ? day : max,
    { date: 'N/A', collections: 0 }
  );

  return {
    last7DaysTotal,
    averagePerDay,
    peakDay
  };
}
