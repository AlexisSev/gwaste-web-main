// Supabase Edge Function for Admin Notification Management
// Handles fetching, updating, and creating admin notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS"
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

    if (method === "GET") {
      // Fetch admin notifications
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '25');

      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 100));

      if (error) {
        console.error('Error fetching admin notifications:', error);
        throw error;
      }

      // Map records to expected format
      const mappedData = (data || []).map(record => ({
        id: record.id,
        type: record.notification_type,
        title: record.title,
        message: record.message,
        timestamp: record.created_at,
        read: record.read,
        collectionId: record.collection_id,
        metadata: record.metadata || {},
      }));

      return new Response(JSON.stringify({
        success: true,
        data: mappedData
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "PUT") {
      // Mark notification as read
      const { notificationId } = await req.json();

      if (!notificationId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Notification ID is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { error } = await supabase
        .from('admin_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error updating notification:', error);
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Notification marked as read"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (method === "POST") {
      // Create notifications for a collection
      const { collection } = await req.json();

      if (!collection) {
        return new Response(JSON.stringify({
          success: false,
          error: "Collection data is required"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      console.log('🔔 Creating admin notifications for collection:', collection.id);

      // Wait a moment for database trigger to complete, then check if it created proper notifications
      await new Promise(resolve => setTimeout(resolve, 300));

      const { data: existingNotifications, error: checkError } = await supabase
        .from('admin_notifications')
        .select('id, areas_collected, collector_name')
        .eq('collection_id', collection.id);

      if (!checkError && existingNotifications && existingNotifications.length > 0) {
        const collectionAreas = Array.isArray(collection.areas_collected)
          ? collection.areas_collected.filter(a => a && a.trim() !== '')
          : (collection.areas_collected ? [collection.areas_collected] : []);

        // Count how many notifications have proper data
        const validNotifications = existingNotifications.filter(n =>
          n.collector_name && n.areas_collected && Array.isArray(n.areas_collected) && n.areas_collected.length > 0
        );

        // If we have valid notifications matching the number of areas, trigger worked correctly
        if (validNotifications.length === collectionAreas.length && collectionAreas.length > 0) {
          console.log('✅ Database trigger created separate notifications per area correctly');
          return new Response(JSON.stringify({
            success: true,
            message: `Database trigger created ${validNotifications.length} notifications`,
            data: existingNotifications
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // If notifications exist but aren't properly split, delete and recreate
        console.log('⚠️ Database trigger created notifications but they are not properly split. Recreating...');
        const { error: deleteError } = await supabase
          .from('admin_notifications')
          .delete()
          .eq('collection_id', collection.id);

        if (deleteError) {
          console.warn('⚠️ Error deleting existing notifications:', deleteError);
        } else {
          console.log('🗑️ Deleted improperly formatted notifications');
        }
      }

      // Get areas collected - expand into array if needed
      let areas = [];
      if (collection.areas_collected && Array.isArray(collection.areas_collected) && collection.areas_collected.length > 0) {
        areas = collection.areas_collected;
      } else if (collection.areas_collected && typeof collection.areas_collected === 'string') {
        areas = collection.areas_collected.includes(',')
          ? collection.areas_collected.split(',').map(a => a.trim()).filter(Boolean)
          : [collection.areas_collected];
      } else {
        areas = ['an area'];
      }

      // Get route name if route_id is available
      let routeInfo = '';
      let routeNumber = null;
      if (collection.route_id) {
        try {
          const { data: route } = await supabase
            .from('routes')
            .select('route')
            .eq('id', collection.route_id)
            .single();

          if (route) {
            routeInfo = ` (Route ${route.route})`;
            routeNumber = route.route;
          }
        } catch (error) {
          console.error('Error fetching route name:', error);
        }
      }

      const collectorName = collection.collector_name || 'Driver';

      // Create one notification per area with all required fields from schema
      const notificationsToInsert = areas.map((area, index) => {
        const message = `${collectorName} collected from ${area}${routeInfo}`;

        return {
          notification_type: 'collection',
          title: 'New Collection Completed',
          message: message,
          collection_id: collection.id || null,
          collector_name: collectorName,
          areas_collected: [area], // Single area as array (per schema: text[])
          waste_type: collection.waste_type || null,
          route_id: collection.route_id || null,
          read: false,
          metadata: {
            area: area,
            area_index: index,
            total_areas: areas.length,
            collector_name: collectorName,
            waste_type: collection.waste_type || null,
            route_id: collection.route_id || null,
            route_number: routeNumber || null
          }
        };
      });

      console.log(`📝 Creating ${notificationsToInsert.length} admin notification(s) for ${areas.length} area(s)`);

      // Insert all notifications
      const { data, error } = await supabase
        .from('admin_notifications')
        .insert(notificationsToInsert)
        .select();

      if (error) {
        console.error('❌ Error creating admin notifications:', error);
        throw error;
      }

      console.log(`✅ Successfully created ${data?.length || 0} admin notification(s)`);
      return new Response(JSON.stringify({
        success: true,
        message: `Successfully created ${data?.length || 0} admin notification(s)`,
        data
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Admin notifications function error:", error);
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
