// Supabase Edge Function for Truck Location Management
// Fetches truck locations with driver information

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const OFFLINE_THRESHOLD_MINUTES = 5;

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
    const userRole = url.searchParams.get('userRole') || 'admin';
    const collectorId = url.searchParams.get('collectorId') || '';

    // Calculate the cutoff time for online trucks
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - OFFLINE_THRESHOLD_MINUTES);

    let query = supabase
      .from("trucklocation")
      .select("*")
      .order("updated_at", { ascending: false })
      .eq("status", "active")
      .gte("updated_at", cutoffTime.toISOString());

    // Filter by collector_id if user is a collector
    if (userRole === "collector" && collectorId) {
      query = query.eq("collector_id", collectorId);
    }

    const { data: truckLocations, error } = await query;

    if (error) {
      console.error("Error fetching truck locations:", error);
      throw error;
    }

    if (!truckLocations || truckLocations.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: [],
        message: "No active trucks found"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get unique collector IDs to fetch driver info
    const collectorIds = [...new Set(truckLocations.map(t => t.collector_id).filter(Boolean))];

    // Fetch driver information
    const driversMap = {};
    if (collectorIds.length > 0) {
      const { data: drivers, error: driversError } = await supabase
        .from("collectors")
        .select("driver, firstName, lastName, profile_image, collector_id, id, status")
        .in("collector_id", collectorIds)
        .eq("status", "active");

      if (!driversError && drivers) {
        drivers.forEach(driver => {
          const name = driver.driver ||
                      [driver.firstName, driver.lastName].filter(Boolean).join(" ") ||
                      "Driver";
          driversMap[driver.collector_id] = {
            driver: name,
            profile_image: driver.profile_image || null,
          };
        });
      }
    }

    // Process truck locations with driver info
    const processedTrucks = truckLocations.map(truck => {
      const id = truck.collector_id || truck.truck_id || truck.id || truck.location_id;
      const driverInfo = driversMap[truck.collector_id] || { driver: "Unknown Driver", profile_image: null };

      return {
        id,
        collector_id: truck.collector_id,
        latitude: Number(truck.latitude ?? truck.lat),
        longitude: Number(truck.longitude ?? truck.lng),
        updatedAt: truck.updated_at || truck.inserted_at || new Date().toISOString(),
        driverName: driverInfo.driver,
        profileImage: driverInfo.profile_image,
        barangay: "Location data", // Could be enhanced with reverse geocoding
        status: "online"
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: processedTrucks,
      statistics: {
        total: processedTrucks.length,
        online: processedTrucks.length,
        offlineThresholdMinutes: OFFLINE_THRESHOLD_MINUTES
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Truck locations function error:", error);
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
