// Supabase Edge Function for Dashboard Data
// Fetches routes, collections, and reports for the dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch routes
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select("*")
      .order("route", { ascending: true });

    if (routesError) {
      console.error("Error fetching routes:", routesError);
      throw routesError;
    }

    // Fetch collections
    const { data: collections, error: collectionsError } = await supabase
      .from("collections")
      .select("*")
      .order("collected_at", { ascending: false });

    if (collectionsError) {
      console.error("Error fetching collections:", collectionsError);
      throw collectionsError;
    }

    // Fetch reports
    const { data: reports, error: reportsError } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      throw reportsError;
    }

    // Calculate dashboard statistics
    const totalSchedules = routes.length;
    const uniqueDrivers = new Set(routes.map(r => r.driver)).size;
    const uniqueRoutes = Object.values(
      routes.reduce((acc, route) => {
        if (!acc[route.route]) acc[route.route] = route;
        return acc;
      }, {})
    );
    const crewNames = uniqueRoutes.flatMap(r =>
      (r.crew || []).map(member =>
        typeof member === "string"
          ? member.trim()
          : [member.firstName, member.lastName].filter(Boolean).join(" ").trim()
      )
    ).filter(Boolean);
    const totalCrew = new Set(crewNames).size;
    const pendingReports = reports.filter(r => r.status === 'pending').length;
    const resolvedReports = reports.filter(r => r.status === 'resolved').length;

    // Calculate collections statistics
    const todayIso = new Date().toISOString().split('T')[0];
    const todayCollections = collections.filter(collection => {
      const date = collection.collected_date || collection.created_at?.split('T')[0];
      return date === todayIso;
    }).length;

    // Expand collections by area (same logic as frontend)
    const expandCollectionsByArea = (collectionsData) => {
      if (!collectionsData || !Array.isArray(collectionsData)) {
        return [];
      }

      const expanded = [];
      collectionsData.forEach(collection => {
        if (!collection) return;

        const areas = Array.isArray(collection.areas_collected)
          ? collection.areas_collected
          : (collection.areas_collected ? [collection.areas_collected] : ['N/A']);

        if (areas.length === 0) {
          areas.push('N/A');
        }

        const collectedAt = collection.collected_at ? new Date(collection.collected_at) : null;
        const updatedAt = collection.updated_at ? new Date(collection.updated_at) : null;
        const createdAt = collection.created_at ? new Date(collection.created_at) : null;

        const wasUpdated = updatedAt && collectedAt && updatedAt.getTime() > collectedAt.getTime() + 1000;

        const timeDiff = wasUpdated && areas.length > 1
          ? (updatedAt.getTime() - collectedAt.getTime()) / areas.length
          : 0;

        areas.forEach((area, index) => {
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
            estimatedTime = new Date(areaTimestamp);
          } else {
            estimatedTime = collectedAt || createdAt || new Date();

            if (areas.length > 1 && index > 0) {
              if (wasUpdated && timeDiff > 0) {
                estimatedTime = new Date(collectedAt.getTime() + (timeDiff * index));
              } else if (collectedAt) {
                const minutesPerArea = 20;
                estimatedTime = new Date(collectedAt.getTime() + (index * minutesPerArea * 60 * 1000));
              }
            }
          }

          expanded.push({
            ...collection,
            id: `${collection.id || 'unknown'}-${index}`,
            areas_collected: area,
            original_id: collection.id,
            collected_at: estimatedTime.toISOString(),
            original_collected_at: collection.collected_at
          });
        });
      });
      return expanded;
    };

    const expandedCollections = expandCollectionsByArea(collections);
    const completedPickups = expandedCollections.length;

    // Calculate collections by date for chart
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

    const collectionsByDate = Object.entries(last7Days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      collections: count
    }));

    const last7DaysTotal = collectionsByDate.reduce((sum, day) => sum + day.collections, 0);
    const averagePerDay = last7DaysTotal > 0 ? (last7DaysTotal / 7).toFixed(1) : 0;
    const peakDay = collectionsByDate.reduce((max, day) =>
      day.collections > max.collections ? day : max,
      { date: 'N/A', collections: 0 }
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        routes,
        collections: expandedCollections,
        reports,
        statistics: {
          totalSchedules,
          uniqueDrivers,
          totalCrew,
          completedPickups,
          pendingReports,
          resolvedReports,
          todayCollections,
          collectionsByDate,
          last7DaysTotal,
          averagePerDay,
          peakDay: peakDay.collections > 0 ? `${peakDay.collections} (${peakDay.date})` : 'N/A'
        }
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Dashboard data function error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
