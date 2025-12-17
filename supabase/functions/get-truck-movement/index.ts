// Supabase Edge Function for Truck Movement Data
// Fetches truck movement history and collection data for specific trucks

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

    // Parse query parameters
    const url = new URL(req.url);
    const truckId = url.searchParams.get('truckId');

    if (!truckId) {
      return new Response(JSON.stringify({
        success: false,
        error: "truckId parameter is required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get collector_id from truck location data
    const { data: truckLocationData, error: locationError } = await supabase
      .from("trucklocation")
      .select("collector_id, location_id")
      .eq("status", "active")
      .or(`collector_id.eq."${truckId}",location_id.eq."${truckId}"`)
      .limit(1);

    if (locationError || !truckLocationData || truckLocationData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Truck not found or no location data available"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const collectorId = truckLocationData[0].collector_id || truckId;

    // Fetch truck location history (last 24 hours)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: movementHistory, error: movementError } = await supabase
      .from("trucklocation")
      .select("latitude, longitude, updated_at")
      .eq("collector_id", collectorId)
      .gte("updated_at", yesterday.toISOString())
      .order("updated_at", { ascending: true });

    if (movementError) {
      console.error("Error fetching movement history:", movementError);
      throw movementError;
    }

    // Process movement data
    let processedMovement = [];
    const STOPPED_THRESHOLD_METERS = 50;

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
    };

    if (movementHistory && movementHistory.length > 0) {
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
          processedMovement.push({
            time: time.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: timestamp,
            movement: 0,
            distance: 0,
            latitude: point.latitude,
            longitude: point.longitude,
          });
        } else {
          const prevPoint = movementHistory[index - 1];
          const distance = calculateDistance(
            prevPoint.latitude,
            prevPoint.longitude,
            point.latitude,
            point.longitude
          );

          const timeDiff =
            timestamp - new Date(prevPoint.updated_at).getTime(); // milliseconds

          if (distance < STOPPED_THRESHOLD_METERS) {
            // Truck is stopped (at collection site)
            if (currentStopLocation) {
              // Check if still at the same stop location
              const stopDistance = calculateDistance(
                currentStopLocation.lat,
                currentStopLocation.lon,
                point.latitude,
                point.longitude
              );

              if (stopDistance < STOPPED_THRESHOLD_METERS) {
                // Still at same stop - accumulate time
                accumulatedStopTime += timeDiff;
              } else {
                // Moved to a new stop location
                currentStopLocation = {
                  lat: point.latitude,
                  lon: point.longitude,
                };
                accumulatedStopTime = timeDiff;
              }
            } else {
              // Starting a new stop
              currentStopLocation = {
                lat: point.latitude,
                lon: point.longitude,
              };
              accumulatedStopTime = timeDiff;
            }

            // Convert accumulated time to minutes for display
            const timeSpentMinutes = accumulatedStopTime / (1000 * 60);
            processedMovement.push({
              time: time.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              timestamp: timestamp,
              movement: Math.max(timeSpentMinutes, 0.2),
              distance: distance,
              latitude: point.latitude,
              longitude: point.longitude,
            });
          } else {
            // Truck is moving
            currentStopLocation = null;
            accumulatedStopTime = 0;
            processedMovement.push({
              time: time.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              timestamp: timestamp,
              movement: 0, // Low value when moving
              distance: distance,
              latitude: point.latitude,
              longitude: point.longitude,
            });
          }
        }
      });
    }

    // Fetch collections for this collector (last 24 hours)
    const { data: collections, error: collectionsError } = await supabase
      .from("collections")
      .select("collected_at, areas_collected, waste_type")
      .eq("collector_name", truckLocationData[0].driver || "Unknown")
      .gte("collected_at", yesterday.toISOString())
      .order("collected_at", { ascending: true });

    if (collectionsError) {
      console.error("Error fetching collections:", collectionsError);
    }

    // Process collections data
    const processedCollections = (collections || []).map((collection) => ({
      timestamp: new Date(collection.collected_at).getTime(),
      time: new Date(collection.collected_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      areas: collection.areas_collected || [],
      wasteType: collection.waste_type || "Unknown",
    }));

    return new Response(JSON.stringify({
      success: true,
      data: {
        movementData: processedMovement,
        collectionsData: processedCollections,
        statistics: {
          totalMovements: processedMovement.length,
          totalCollections: processedCollections.length,
          timeRange: "24 hours"
        }
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Truck movement function error:", error);
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
