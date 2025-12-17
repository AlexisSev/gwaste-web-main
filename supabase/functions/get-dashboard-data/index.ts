// Supabase Edge Function for Dashboard Data
// Fetches routes, collections, and reports for the dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Return raw data - Dashboard.js handles all expansion and calculations
    return new Response(JSON.stringify({
      success: true,
      data: {
        routes: routes || [],
        collections: collections || [],
        reports: reports || [],
        statistics: {}
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
