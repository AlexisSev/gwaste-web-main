import { supabase } from "../supabaseClient";

const mapNotificationRecord = (record) => ({
  id: record.id,
  type: record.notification_type,
  title: record.title,
  message: record.message,
  timestamp: record.created_at,
  read: record.read,
  collectionId: record.collection_id,
  metadata: record.metadata || {},
});

export async function fetchAdminNotifications(limit = 25) {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch admin notifications:", error);
    return { data: [], error };
  }

  return { data: (data || []).map(mapNotificationRecord), error: null };
}

export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) {
    return { error: new Error("Notification ID is required") };
  }

  const { error } = await supabase
    .from("admin_notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("Failed to mark notification as read:", error);
  }

  return { error };
}

/**
 * Create admin notifications for a collection
 * Creates one notification per area collected
 * Deletes any existing notifications for this collection first (from database trigger)
 */
export async function createAdminNotificationsForCollection(collection) {
  try {
    console.log('🔔 Creating admin notifications for collection:', collection.id);
    
    // First, delete any notifications created by the database trigger for this collection
    // (The trigger creates one notification per collection, but we want one per area)
    if (collection.id) {
      const { error: deleteError } = await supabase
        .from('admin_notifications')
        .delete()
        .eq('collection_id', collection.id);
      
      if (deleteError) {
        console.warn('⚠️ Error deleting existing notifications (may not exist yet):', deleteError);
      } else {
        console.log('🗑️ Deleted any existing notifications for this collection');
      }
    }
    
    // Get areas collected - expand into array if needed
    let areas = [];
    if (collection.areas_collected && Array.isArray(collection.areas_collected) && collection.areas_collected.length > 0) {
      areas = collection.areas_collected;
    } else if (collection.areas_collected && typeof collection.areas_collected === 'string') {
      // If it's a string, try to split by comma, otherwise treat as single area
      areas = collection.areas_collected.includes(',') 
        ? collection.areas_collected.split(',').map(a => a.trim()).filter(Boolean)
        : [collection.areas_collected];
    } else {
      // If no areas, create one notification with placeholder
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
    console.log('📋 Areas:', areas);
    
    // Insert all notifications
    const { data, error } = await supabase
      .from('admin_notifications')
      .insert(notificationsToInsert)
      .select();
    
    if (error) {
      console.error('❌ Error creating admin notifications:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return { error, data: null };
    }
    
    console.log(`✅ Successfully created ${data?.length || 0} admin notification(s)`);
    return { error: null, data };
  } catch (error) {
    console.error('❌ Exception creating admin notifications:', error);
    console.error('❌ Exception stack:', error.stack);
    return { error, data: null };
  }
}

