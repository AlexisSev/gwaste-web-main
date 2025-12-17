// Supabase Edge Function for Collector Management
// Handles CRUD operations for collectors with validation logic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET") {
      // Fetch all collectors
      const { data, error } = await supabase
        .from("collectors")
        .select("*")
        .order("driver", { ascending: true });

      if (error) {
        console.error("Error fetching collectors:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: data || []
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // helper to safely parse JSON body (handles empty body)
    const parseRequestBody = async () => {
      try {
        const text = await req.text();
        if (!text) return {};
        return JSON.parse(text);
      } catch (err) {
        return null; // indicates invalid JSON
      }
    };

    if (method === "POST") {
      // Add new collector
      const parsed = await parseRequestBody();
      if (parsed === null) {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      // If POST with empty body, treat as fetch request (invoked by supabase.functions.invoke)
      if (!parsed || Object.keys(parsed).length === 0) {
        const { data, error } = await supabase
          .from("collectors")
          .select("*")
          .order("driver", { ascending: true });

        if (error) {
          console.error("Error fetching collectors:", error);
          throw error;
        }

        return new Response(JSON.stringify({
          success: true,
          data: data || []
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const { firstName, lastName, contact, password, crew, status = 'active' } = parsed;

      // Validation
      if (!firstName || !lastName || !contact || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: firstName, lastName, contact, password"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fetch existing collectors for duplicate check
      const { data: latestCollectors, error: fetchError } = await supabase
        .from("collectors")
        .select("*");

      if (fetchError) {
        console.error("Error fetching collectors for validation:", fetchError);
        throw fetchError;
      }

      // Fetch all routes to check crew assignments
      const { data: allRoutes, error: routesError } = await supabase
        .from("routes")
        .select("*");

      if (routesError) {
        console.error("Error fetching routes for validation:", routesError);
        throw routesError;
      }

      // Gather existing names by role (case-insensitive)
      const existingDriverNames = (latestCollectors || [])
        .map(c => (c.driver || '').toLowerCase().trim())
        .filter(Boolean);
      const existingCrewNames = (latestCollectors || [])
        .flatMap(c => (c.crew || []).map(member =>
          (member.firstName && member.lastName)
            ? (member.firstName + ' ' + member.lastName).toLowerCase().trim()
            : ''
        ))
        .filter(Boolean);

      // New driver name
      const newDriverName = (firstName + ' ' + lastName).toLowerCase();

      // New crew names
      const newCrewNames = (crew || [])
        .filter(c => c.firstName?.trim() && c.lastName?.trim())
        .map(c => (c.firstName + ' ' + c.lastName).toLowerCase());

      // Check duplicates with role separation
      if (existingDriverNames.includes(newDriverName)) {
        return new Response(JSON.stringify({
          success: false,
          error: "This driver already exists."
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (newCrewNames.some(name => existingCrewNames.includes(name))) {
        return new Response(JSON.stringify({
          success: false,
          error: "One or more crew members already exist."
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check if crew members are already assigned to routes
      const assignedCrewMembers = [];
      for (const route of allRoutes || []) {
        if (route.crew && Array.isArray(route.crew)) {
          for (const crewMember of route.crew) {
            const crewName = typeof crewMember === 'string'
              ? crewMember.toLowerCase()
              : (crewMember.firstName && crewMember.lastName
                ? (crewMember.firstName + ' ' + crewMember.lastName).toLowerCase()
                : '');

            if (newCrewNames.includes(crewName)) {
              assignedCrewMembers.push({
                name: crewName,
                route: route.route,
                driver: route.driver
              });
            }
          }
        }
      }

      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers.map(c => `${c.name} (Route ${c.route} - ${c.driver})`).join(', ');
        return new Response(JSON.stringify({
          success: false,
          error: `The following crew members are already assigned to routes: ${crewList}`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Add the collector
      const { data, error } = await supabase
        .from("collectors")
        .insert([{
          firstName,
          lastName,
          contact,
          password,
          driver: firstName + ' ' + lastName,
          crew: (crew || []).filter((c) => c.firstName?.trim() && c.lastName?.trim()),
          status,
        }])
        .select();

      if (error) {
        console.error("Error adding collector:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: data[0],
        message: "Collector added successfully"
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "PUT") {
      // Update collector
      const parsed = await parseRequestBody();
      if (parsed === null) {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const { id, firstName, lastName, contact, status, crew } = parsed;

      if (!id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Collector ID is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fetch all routes to check crew assignments
      const { data: allRoutes, error: routesError } = await supabase
        .from("routes")
        .select("*");

      if (routesError) {
        console.error("Error fetching routes for validation:", routesError);
        throw routesError;
      }

      // Get the updated crew names and intended driver name
      const updatedCrewNames = (crew || [])
        .filter(c => c.firstName?.trim() && c.lastName?.trim())
        .map(c => (c.firstName + ' ' + c.lastName).toLowerCase());
      const intendedDriverName = (firstName + ' ' + lastName).toLowerCase().trim();

      // Check if crew members are already assigned to other routes
      const assignedCrewMembers = [];
      for (const route of allRoutes || []) {
        // Skip the current route if editing same driver
        const routeDriverName = (route.driver || '').toLowerCase().trim();
        if (routeDriverName === intendedDriverName) {
          continue;
        }

        if (route.crew && Array.isArray(route.crew)) {
          for (const crewMember of route.crew) {
            const crewName = typeof crewMember === 'string'
              ? crewMember.toLowerCase()
              : (crewMember.firstName && crewMember.lastName
                ? (crewMember.firstName + ' ' + crewMember.lastName).toLowerCase()
                : '');

            if (updatedCrewNames.includes(crewName)) {
              assignedCrewMembers.push({
                name: crewName,
                route: route.route,
                driver: route.driver
              });
            }
          }
        }
      }

      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers.map(c => `${c.name} (Route ${c.route} - ${c.driver})`).join(', ');
        return new Response(JSON.stringify({
          success: false,
          error: `Cannot update: The following crew members are already assigned to routes: ${crewList}`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Update the collector
      const { data, error } = await supabase
        .from("collectors")
        .update({
          status,
          crew: (crew || []).filter((c) => c.firstName?.trim() && c.lastName?.trim()),
          firstName,
          lastName,
          contact,
          driver: firstName + ' ' + lastName,
        })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Error updating collector:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: data[0],
        message: "Collector updated successfully"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "DELETE") {
      // Delete collector (if needed in future)
      const parsed = await parseRequestBody();
      if (parsed === null) {
        return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const { id } = parsed;

      if (!id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Collector ID is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error } = await supabase
        .from("collectors")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting collector:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Collector deleted successfully"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Collector management function error:", error);
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
