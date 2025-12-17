// Supabase Edge Function for Saving Waste Predictions
// Saves new waste predictions to database

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
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

    const { predictions } = await req.json();

    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Valid predictions array is required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate each prediction
    const validatedPredictions = predictions.map(pred => {
      if (!pred.area || !pred.predicted_fill_percentage || !pred.risk_level) {
        throw new Error("Each prediction must have area, predicted_fill_percentage, and risk_level");
      }

      return {
        area_name: pred.area,
        predicted_fill_percentage: Math.round(pred.predicted_fill_percentage),
        risk_level: pred.risk_level,
        predicted_at: new Date().toISOString(),
        metadata: pred.metadata || {
          population: Math.round(Math.random() * 3000 + 1000),
          last_collection: new Date().toISOString()
        }
      };
    });

    // Save to Supabase
    const { data, error } = await supabase
      .from('waste_predictions')
      .insert(validatedPredictions)
      .select();

    if (error) {
      console.error('Error saving waste predictions:', error);
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      data: data,
      message: `Successfully saved ${data.length} waste predictions`
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Save waste predictions function error:", error);
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
