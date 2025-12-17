// Supabase Edge Function for Push Notification Subscription Management
// Handles saving and managing push notification subscriptions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    if (method === "POST") {
      // Save subscription
      const { userId, subscriptionData, deviceInfo } = await req.json();

      if (!userId || !subscriptionData) {
        return new Response(JSON.stringify({
          success: false,
          error: "userId and subscriptionData are required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Check if subscription already exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('endpoint', subscriptionData.endpoint)
        .single();

      if (existing) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            subscription_data: subscriptionData,
            device_info: deviceInfo || {},
            last_used: new Date().toISOString(),
            is_active: true,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          throw updateError;
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Subscription updated successfully"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else {
        // Insert new subscription
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            endpoint: subscriptionData.endpoint,
            subscription_data: subscriptionData,
            device_info: deviceInfo || {},
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
            is_active: true,
          });

        if (insertError) {
          console.error('Error inserting subscription:', insertError);
          throw insertError;
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Subscription saved successfully"
        }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (method === "PUT") {
      // Update subscription status (activate/deactivate)
      const { userId, endpoint, isActive } = await req.json();

      if (!userId || !endpoint) {
        return new Response(JSON.stringify({
          success: false,
          error: "userId and endpoint are required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          is_active: isActive,
          last_used: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Error updating subscription status:', error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Subscription ${isActive ? 'activated' : 'deactivated'} successfully`
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "DELETE") {
      // Delete subscription
      const { userId, endpoint } = await req.json();

      if (!userId || !endpoint) {
        return new Response(JSON.stringify({
          success: false,
          error: "userId and endpoint are required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('Error deleting subscription:', error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Subscription deleted successfully"
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
    console.error("Push subscription management function error:", error);
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
