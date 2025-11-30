// Supabase Edge Function to send push notifications
// This function should be deployed to Supabase Edge Functions
// To deploy: supabase functions deploy send-push-notification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const { userId, title, body, icon, url, tag } = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active push subscriptions for the user
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription_data")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subscription: PushSubscription = sub.subscription_data;
        return await sendPushNotification(subscription, {
          title,
          body,
          icon: icon || "/logo192.png",
          url: url || "/",
          tag: tag || "notification",
        });
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successful} notifications, ${failed} failed`,
        successful,
        failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; icon: string; url: string; tag: string }
) {
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    badge: payload.icon,
    tag: payload.tag,
    data: {
      url: payload.url,
      type: payload.tag,
    },
  });

  // Get the encryption keys from the subscription
  const keys = subscription.keys;

  // This is a simplified version - in production, you should use a proper Web Push library
  // For Deno, you can use: https://deno.land/x/webpush
  // For now, we'll use a fetch-based approach

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
    },
    body: message,
  });

  if (!response.ok) {
    throw new Error(`Push notification failed: ${response.statusText}`);
  }

  return response;
}

