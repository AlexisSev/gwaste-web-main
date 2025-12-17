// Supabase Edge Function for Schedule Management
// Handles CRUD operations for routes/schedules with validation logic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

const ROUTE_COLORS = [
  "#28a745", // green
  "#007bff", // blue
  "#ffc107", // yellow
  "#6f42c1", // purple
  "#e83e8c", // pink
  "#fd7e14", // orange
  "#17a2b8", // teal
  "#dc3545", // red
  "#20c997", // cyan
  "#343a40", // dark gray
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check for authentication
  const authHeader = req.headers.get("authorization");
  const apiKey = req.headers.get("apikey");

  if (!authHeader && !apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: "Missing authorization header"
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    if (method === "GET") {
      // Fetch all routes
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .order("route");

      if (error) {
        console.error("Error fetching routes:", error);
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

    if (method === "POST") {
      // Add new route or fetch routes if body is empty
      let requestData;
      try {
        const bodyText = await req.text();
        requestData = bodyText ? JSON.parse(bodyText) : {};
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid JSON in request body"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // If POST with empty body, treat as fetch request
      if (!requestData || Object.keys(requestData).length === 0) {
        const { data, error } = await supabase
          .from("routes")
          .select("*")
          .order("route");

        if (error) {
          console.error("Error fetching routes:", error);
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

      const {
        route, driver, crew, areas, time, endTime, type, frequency, dayOff,
        coordinates, color
      } = requestData;

      // Validation
      const errors = [];
      if (!route) errors.push("Route number is required");
      if (!driver) errors.push("Driver is required");
      if (!crew || (Array.isArray(crew) && crew.filter(c => c).length === 0)) {
        errors.push("At least one crew member");
      }
      if (!areas || (Array.isArray(areas) && areas.filter(a => a).length === 0)) {
        errors.push("At least one area");
      }
      if (!time) errors.push("Collection start time is required");
      if (!endTime) errors.push("Collection end time is required");
      if (!type) errors.push("Waste type is required");
      if (!frequency) errors.push("Frequency is required");
      if (!dayOff) errors.push("Day off is required");

      if (errors.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: errors.join(", ")
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Time validation
      if (time && endTime) {
        const [sh, sm] = time.split(":").map((n: string) => parseInt(n, 10));
        const [eh, em] = endTime.split(":").map((n: string) => parseInt(n, 10));
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        const isAM = (timeStr: string) => {
          const hour = parseInt(timeStr.split(":")[0], 10);
          return hour < 12;
        };

        if (isAM(time) && endMinutes < 12 * 60) {
          return new Response(JSON.stringify({
            success: false,
            error: "End time must be in the afternoon (PM)."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (endMinutes <= startMinutes) {
          return new Response(JSON.stringify({
            success: false,
            error: "End time must be after start time."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Check for crew assignment conflicts
      const { data: allRoutes, error: routesError } = await supabase
        .from("routes")
        .select("*");

      if (routesError) {
        console.error("Error fetching routes for conflict check:", routesError);
        throw routesError;
      }

      const newCrewMembers = Array.isArray(crew) ? crew : [crew];
      const driverName = (driver || "").trim().toLowerCase();

      // Prevent assigning same driver to multiple routes
      if (driverName) {
        const conflictingDriverRoute = allRoutes.find((r: any) =>
          r.driver && r.driver.trim().toLowerCase() === driverName
        );
        if (conflictingDriverRoute) {
          return new Response(JSON.stringify({
            success: false,
            error: `Driver "${driver}" is already assigned to Route ${conflictingDriverRoute.route}. Please select a different driver or edit that route instead.`
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Check if any crew members are already assigned to other routes
      const assignedCrewMembers = [];
      for (const r of allRoutes || []) {
        if (r.crew && Array.isArray(r.crew)) {
          for (const routeCrewMember of r.crew) {
            for (const newCrewMember of newCrewMembers) {
              if (routeCrewMember === newCrewMember) {
                assignedCrewMembers.push({
                  name: newCrewMember,
                  route: r.route,
                  driver: r.driver,
                });
              }
            }
          }
        }
      }

      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers
          .map((c: any) => `${c.name} (Route ${c.route})`)
          .join("");
        return new Response(JSON.stringify({
          success: false,
          error: `Crew already assigned: ${crewList}`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Always ensure coordinates is an array
      let coords = Array.isArray(coordinates) ? coordinates : [];
      // If only one coordinate, duplicate it
      if (coords.length === 1) {
        coords = [coords[0], coords[0]];
      }

      // Clean crew and areas
      const cleanedCrew = (Array.isArray(crew) ? crew : [])
        .map((c: any) => (typeof c === "string" ? c.trim() : c))
        .filter((c: any) => (typeof c === "string" ? c.length > 0 : !!c));
      const cleanedAreas = (Array.isArray(areas) ? areas : [])
        .map((a: any) => (typeof a === "string" ? a.trim() : a))
        .filter((a: any) => (typeof a === "string" ? a.length > 0 : !!a));

      // Assign a color based on route number or random if not available
      let routeColor = color || ROUTE_COLORS[parseInt(route, 10) - 1];
      if (!routeColor) {
        routeColor = ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
      }

      const routeData = {
        route,
        driver,
        crew: cleanedCrew,
        areas: cleanedAreas,
        time,
        end_time: endTime,
        type,
        frequency,
        dayoff: dayOff,
        coordinates: coords,
        color: routeColor
      };

      const { data, error } = await supabase
        .from("routes")
        .insert([routeData])
        .select();

      if (error) {
        console.error("Error adding route:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: data[0],
        message: "Schedule added successfully"
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "PUT") {
      // Update route
      let requestData;
      try {
        requestData = await req.json();
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid JSON in request body"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const {
        id, route, driver, crew, areas, time, endTime, type, frequency, dayOff,
        coordinates, color
      } = requestData;

      if (!id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Route ID is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Validation (same as POST)
      const errors = [];
      if (!route) errors.push("Route number is required");
      if (!driver) errors.push("Driver is required");
      if (!crew || (Array.isArray(crew) && crew.filter(c => c).length === 0)) {
        errors.push("At least one crew member");
      }
      if (!areas || (Array.isArray(areas) && areas.filter(a => a).length === 0)) {
        errors.push("At least one area");
      }
      if (!time) errors.push("Collection start time is required");
      if (!endTime) errors.push("Collection end time is required");
      if (!type) errors.push("Waste type is required");
      if (!frequency) errors.push("Frequency is required");
      if (!dayOff) errors.push("Day off is required");

      if (errors.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: errors.join(", ")
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Time validation
      if (time && endTime) {
        const [sh, sm] = time.split(":").map((n: string) => parseInt(n, 10));
        const [eh, em] = endTime.split(":").map((n: string) => parseInt(n, 10));
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        const isAM = (timeStr: string) => {
          const hour = parseInt(timeStr.split(":")[0], 10);
          return hour < 12;
        };

        if (isAM(time) && endMinutes < 12 * 60) {
          return new Response(JSON.stringify({
            success: false,
            error: "End time must be in the afternoon (PM)."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (endMinutes <= startMinutes) {
          return new Response(JSON.stringify({
            success: false,
            error: "End time must be after start time."
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Check for conflicts (excluding current route)
      const { data: allRoutes, error: routesError } = await supabase
        .from("routes")
        .select("*");

      if (routesError) {
        console.error("Error fetching routes for conflict check:", routesError);
        throw routesError;
      }

      const newCrewMembers = Array.isArray(crew) ? crew : [crew];
      const driverName = (driver || "").trim().toLowerCase();

      // Prevent assigning same driver to multiple routes (unless editing same record)
      if (driverName) {
        const conflictingDriverRoute = allRoutes.find((r: any) =>
          r.driver &&
          r.driver.trim().toLowerCase() === driverName &&
          r.id !== id
        );
        if (conflictingDriverRoute) {
          return new Response(JSON.stringify({
            success: false,
            error: `Driver "${driver}" is already assigned to Route ${conflictingDriverRoute.route}. Please select a different driver or edit that route instead.`
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // Check if any crew members are already assigned to other routes
      const assignedCrewMembers = [];
      for (const r of allRoutes || []) {
        // Skip the current route being edited
        if (r.id === id) continue;

        if (r.crew && Array.isArray(r.crew)) {
          for (const routeCrewMember of r.crew) {
            for (const newCrewMember of newCrewMembers) {
              if (routeCrewMember === newCrewMember) {
                assignedCrewMembers.push({
                  name: newCrewMember,
                  route: r.route,
                  driver: r.driver,
                });
              }
            }
          }
        }
      }

      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers
          .map((c: any) => `${c.name} (Route ${c.route})`)
          .join("");
        return new Response(JSON.stringify({
          success: false,
          error: `Crew already assigned: ${crewList}`
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Clean data
      let coords = Array.isArray(coordinates) ? coordinates : [];
      if (coords.length === 1) {
        coords = [coords[0], coords[0]];
      }

      const cleanedCrew = (Array.isArray(crew) ? crew : [])
        .map((c: any) => (typeof c === "string" ? c.trim() : c))
        .filter((c: any) => (typeof c === "string" ? c.length > 0 : !!c));
      const cleanedAreas = (Array.isArray(areas) ? areas : [])
        .map((a: any) => (typeof a === "string" ? a.trim() : a))
        .filter((a: any) => (typeof a === "string" ? a.length > 0 : !!a));

      const updateData = {
        route,
        driver,
        crew: cleanedCrew,
        areas: cleanedAreas,
        time,
        end_time: endTime,
        type,
        frequency,
        dayoff: dayOff,
        coordinates: coords,
        color: color || ROUTE_COLORS[parseInt(route, 10) - 1] || ROUTE_COLORS[0]
      };

      const { data, error } = await supabase
        .from("routes")
        .update(updateData)
        .eq("id", id)
        .select();

      if (error) {
        console.error("Error updating route:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        data: data[0],
        message: "Schedule updated successfully"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "DELETE") {
      // Delete route
      let requestData;
      try {
        requestData = await req.json();
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid JSON in request body"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { id } = requestData;

      if (!id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Route ID is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting route:", error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Schedule deleted successfully"
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
    console.error("Schedule management function error:", error);
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
