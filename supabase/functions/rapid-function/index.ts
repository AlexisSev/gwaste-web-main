// Supabase Edge Function to send push notifications
// This function should be deployed to Supabase Edge Functions
// To deploy: supabase functions deploy rapid-function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate VAPID keys
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, icon, url, tag } = await req.json();

    // Validate required fields
    if (!userId || !title || !body) {
      return new Response(JSON.stringify({
        error: "Missing required fields: userId, title, body"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📤 Sending push notification to user ${userId}: "${title}"`);

    // Get all active push subscriptions for the user
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription_data")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching subscriptions:", error);
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`ℹ️ No active subscriptions found for user ${userId}`);
      return new Response(JSON.stringify({
        message: "No active subscriptions found",
        userId,
        subscriptionsCount: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📱 Found ${subscriptions.length} active subscriptions for user ${userId}`);

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub, index) => {
        try {
          const subscription: PushSubscription = sub.subscription_data;
          console.log(`📤 Sending to subscription ${index + 1}/${subscriptions.length}`);
          return await sendPushNotification(subscription, {
            title,
            body,
            icon: icon || "/logo192.png",
            url: url || "/",
            tag: tag || "notification"
          });
        } catch (error) {
          console.error(`❌ Failed to send to subscription ${index + 1}:`, error);
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`✅ Push notification results: ${successful} successful, ${failed} failed`);

    return new Response(JSON.stringify({
      message: `Sent ${successful} notifications, ${failed} failed`,
      successful,
      failed,
      total: subscriptions.length,
      userId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Push notification function error:", error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Web Push encryption utilities
function base64UrlEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array([...prk, ...info, 1]));
  return new Uint8Array(hash.slice(0, length));
}

async function encryptPayload(userPublicKey: string, userAuth: string, payload: string): Promise<{ ciphertext: Uint8Array; salt: Uint8Array }> {
  // Decode base64 keys
  const publicKeyBytes = Uint8Array.from(atob(userPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const authBytes = Uint8Array.from(atob(userAuth.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  // Generate salt and server key pair
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Import client's public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  // Derive encryption keys using HKDF
  const prk = await hmacSha256(authBytes, new Uint8Array(sharedSecret));
  const keyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

  const key = await hkdfExpand(prk, keyInfo, 16);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // Encrypt payload
  const algorithm = { name: 'AES-GCM', iv: nonce };
  const cryptoKey = await crypto.subtle.importKey('raw', key, algorithm, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(algorithm, cryptoKey, new TextEncoder().encode(payload));

  return {
    ciphertext: new Uint8Array(encrypted),
    salt: salt
  };
}

async function sendPushNotification(subscription: PushSubscription, payload: any) {
  // Validate subscription
  if (!subscription.endpoint) {
    throw new Error("Invalid subscription data - missing endpoint");
  }

  // Prepare the payload
  const payloadData = {
    title: payload.title,
    body: payload.body,
    icon: payload.icon,
    badge: payload.icon,
    tag: payload.tag,
    data: {
      url: payload.url,
      type: payload.tag
    }
  };

  const payloadString = JSON.stringify(payloadData);

  console.log(`📤 Sending encrypted push notification to ${subscription.endpoint.substring(0, 50)}...`);

  try {
    // Encrypt the payload using Web Push protocol
    const { ciphertext, salt } = await encryptPayload(
      subscription.keys.p256dh,
      subscription.keys.auth,
      payloadString
    );

    // Create the final payload with padding
    const padding = new Uint8Array(0); // Minimal padding for now
    const finalPayload = new Uint8Array([...salt, ...padding, ...ciphertext]);

    // Send the encrypted push notification
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Urgency": "normal"
      },
      body: finalPayload
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push notification failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`✅ Successfully sent encrypted push to ${subscription.endpoint.substring(0, 50)}...`);
    return response;

  } catch (error) {
    console.error(`❌ Push encryption/send failed for ${subscription.endpoint.substring(0, 50)}:`, error.message);
    throw error;
  }
}
