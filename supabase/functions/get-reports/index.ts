// Supabase Edge Function for Reports Management
// Fetches reports and associated resident data

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
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';

    // Fetch reports
    let reportsQuery = supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      reportsQuery = reportsQuery.eq("status", status);
    }

    const { data: reports, error: reportsError } = await reportsQuery;

    if (reportsError) {
      console.error("Error fetching reports:", reportsError);
      throw reportsError;
    }

    // Fetch residents for lookup
    const { data: residents, error: residentsError } = await supabase
      .from("residents")
      .select("*");

    if (residentsError) {
      console.error("Error fetching residents:", residentsError);
      // Continue without residents data - not critical
    }

    // Create residents lookup map
    const residentsMap = {};
    (residents || []).forEach(resident => {
      residentsMap[resident.id] = resident;
    });

    // Process reports with resident information and apply search filter
    let processedReports = (reports || []).map(report => {
      const resident = getResidentForReport(report, residentsMap);
      const residentName = getResidentName(report, resident);
      const address = getAddress(report, resident);

      return {
        ...report,
        residentName,
        address,
        images: getReportImages(report)
      };
    });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      processedReports = processedReports.filter(report =>
        (report.description || "").toLowerCase().includes(searchLower) ||
        (report.residentName || "").toLowerCase().includes(searchLower)
      );
    }

    // Helper functions
    function getResidentForReport(report, residentsMap) {
      const residentId = report.resident_id || report.residentId || report.userId || report.uid || report.submittedBy;
      return residentId ? residentsMap[residentId] : null;
    }

    function getResidentName(report, resident) {
      if (!report) return "Anonymous";

      // First try to get from residents table
      if (resident) {
        const fullName = resident.full_name || `${resident.first_name || ""} ${resident.last_name || ""}`.trim();
        if (fullName && fullName.trim()) return fullName.trim();
        if (resident.name) return resident.name;
        if (resident.email) return resident.email;
      }

      // Fallback to report fields
      const residentName = report.resident_name || report.residentName || report.username || report.user;
      if (residentName) return residentName;

      // Last resort
      return report.submitted_by || "Anonymous";
    }

    function getAddress(report, resident) {
      if (!report) return "Not specified";

      // First try to get address from residents table
      if (resident) {
        const residentAddress = resident.resident_address;
        if (residentAddress && typeof residentAddress === 'string' && residentAddress.trim()) {
          const trimmed = residentAddress.trim();
          return trimmed.length > 50 ? trimmed.substring(0, 47) + "..." : trimmed;
        }
      }

      // Try various address fields from the report
      const address = report.location || report.address || report.location_address || report.resident_address;

      if (address && typeof address === 'string' && address.trim()) {
        const trimmed = address.trim();
        return trimmed.length > 50 ? trimmed.substring(0, 47) + "..." : trimmed;
      }

      return "Not specified";
    }

    function getReportImages(report) {
      if (!report) return [];

      // Check for different possible image field names and formats
      let images = [];

      // Check for images_base64 field (database field)
      if (report.images_base64) {
        if (Array.isArray(report.images_base64)) {
          images = report.images_base64;
        } else if (typeof report.images_base64 === 'string') {
          images = [report.images_base64];
        } else if (typeof report.images_base64 === 'object') {
          const base64Data = report.images_base64;
          if (base64Data.images && Array.isArray(base64Data.images)) {
            images = base64Data.images;
          } else if (base64Data.image) {
            images = [base64Data.image];
          } else if (base64Data.data) {
            images = [base64Data.data];
          }
        }
      }
      // Check if images field exists as array
      else if (report.images && Array.isArray(report.images)) {
        images = report.images;
      }
      // Check if image field exists as array
      else if (report.image && Array.isArray(report.image)) {
        images = report.image;
      }
      // Check if images field exists as single string
      else if (report.images && typeof report.images === 'string') {
        images = [report.images];
      }
      // Check if image field exists as single string
      else if (report.image && typeof report.image === 'string') {
        images = [report.image];
      }
      // Check for photo field
      else if (report.photo && typeof report.photo === 'string') {
        images = [report.photo];
      }
      // Check for picture field
      else if (report.picture && typeof report.picture === 'string') {
        images = [report.picture];
      }

      // Filter out empty/null values and validate URLs/base64
      const filteredImages = images.filter(img => {
        if (!img || typeof img !== 'string') return false;
        const trimmed = img.trim();
        if (!trimmed) return false;

        // Check if it's a valid URL, base64 data, or relative path
        return trimmed.startsWith('http') || trimmed.startsWith('data:image/') || trimmed.startsWith('/');
      });

      return filteredImages;
    }

    return new Response(JSON.stringify({
      success: true,
      data: processedReports,
      statistics: {
        total: reports?.length || 0,
        filtered: processedReports.length,
        pending: processedReports.filter(r => r.status === 'pending').length,
        resolved: processedReports.filter(r => r.status === 'resolved').length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Reports function error:", error);
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
