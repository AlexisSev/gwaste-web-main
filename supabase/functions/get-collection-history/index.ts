// Supabase Edge Function for Collection History
// Fetches collection history with search and filtering capabilities

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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
    const search = url.searchParams.get('search') || '';
    const dateFilter = url.searchParams.get('date') || '';

    // Build query
    let query = supabase
      .from("collections")
      .select("*")
      .order("collected_at", { ascending: false });

    // Apply date filter if provided
    if (dateFilter) {
      query = query.eq("collected_date", dateFilter);
    }

    const { data: collections, error } = await query;

    if (error) {
      console.error("Error fetching collections:", error);
      throw error;
    }

    // Apply search filter in memory (since Supabase doesn't support complex text search easily)
    let filteredCollections = collections || [];

    if (search) {
      const searchLower = search.toLowerCase();
      filteredCollections = filteredCollections.filter(collection => {
        const collectorName = (collection.collector_name || "").toLowerCase();
        const areas = Array.isArray(collection.areas_collected)
          ? collection.areas_collected.join(", ").toLowerCase()
          : (collection.areas_collected || "").toLowerCase();

        return collectorName.includes(searchLower) || areas.includes(searchLower);
      });
    }

    // Calculate statistics
    const totalRecords = collections?.length || 0;
    const filteredCount = filteredCollections.length;

    // Expand collections by area (same logic as dashboard)
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
          let estimatedTime = collectedAt || createdAt || new Date();

          if (areas.length > 1 && index > 0) {
            if (wasUpdated && timeDiff > 0) {
              estimatedTime = new Date(collectedAt.getTime() + (timeDiff * index));
            } else if (collectedAt) {
              const minutesPerArea = 20;
              estimatedTime = new Date(collectedAt.getTime() + (index * minutesPerArea * 60 * 1000));
            }
          }

          expanded.push({
            ...collection,
            id: `${collection.id || 'unknown'}-${index}`,
            areas_collected: area,
            collected_at: estimatedTime.toISOString(),
          });
        });
      });
      return expanded;
    };

    const expandedCollections = expandCollectionsByArea(filteredCollections);

    return new Response(JSON.stringify({
      success: true,
      data: expandedCollections,
      statistics: {
        totalRecords,
        filteredCount,
        showing: expandedCollections.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Collection history function error:", error);
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
