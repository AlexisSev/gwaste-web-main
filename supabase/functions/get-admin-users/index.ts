// Supabase Edge Function for Admin Users
// Fetches admin users for push notifications

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

    // Fetch all admin users
    const { data: admins, error: adminError } = await supabase
      .from('admins')
      .select('id, user_id, name, email');

    if (adminError) {
      console.error('❌ Error fetching admins:', adminError);
      return new Response(JSON.stringify({
        success: false,
        error: adminError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Filter out any admins without a valid user_id
    const validAdmins = (admins || [])
      .filter(admin => admin.user_id != null && admin.user_id !== '')
      .map(admin => ({
        id: admin.id,
        user_id: admin.user_id,
        name: admin.name,
        email: admin.email
      }));

    console.log('📋 Admins fetched:', admins);
    console.log('🎯 Valid admin user IDs found:', validAdmins.map(a => a.user_id));

    if (validAdmins.length === 0) {
      console.warn('⚠️ No admins have a valid user_id field');
    }

    return new Response(JSON.stringify({
      success: true,
      data: validAdmins,
      count: validAdmins.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Get admin users function error:", error);
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
