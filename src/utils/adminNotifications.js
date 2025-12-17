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
  try {
    const { data, error } = await supabase.functions.invoke('manage-admin-notifications', {
      body: null, // GET request
      method: 'GET'
    });

    if (error) {
      console.error("Failed to fetch admin notifications:", error);
      return { data: [], error };
    }

    if (!data?.success) {
      console.error("Admin notifications fetch failed:", data?.error);
      return { data: [], error: new Error(data?.error || "Failed to fetch notifications") };
    }

    return { data: (data.data || []).map(mapNotificationRecord), error: null };
  } catch (err) {
    console.error("Failed to fetch admin notifications:", err);
    return { data: [], error: err };
  }
}

export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) {
    return { error: new Error("Notification ID is required") };
  }

  try {
    const { data, error } = await supabase.functions.invoke('manage-admin-notifications', {
      body: { notificationId },
      method: 'PUT'
    });

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return { error };
    }

    if (!data?.success) {
      console.error("Mark notification read failed:", data?.error);
      return { error: new Error(data?.error || "Failed to mark notification as read") };
    }

    return { error: null };
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    return { error: err };
  }
}

/**
 * Create admin notifications for a collection
 * Creates one notification per area collected
 * Note: If the database trigger is updated to create separate notifications per area,
 * this function may not be needed. Otherwise, it ensures one notification per area.
 */
export async function createAdminNotificationsForCollection(collection) {
  try {
    console.log('🔔 Creating admin notifications for collection:', collection.id);

    const { data, error } = await supabase.functions.invoke('manage-admin-notifications', {
      body: { collection },
      method: 'POST'
    });

    if (error) {
      console.error('❌ Error creating admin notifications via function:', error);
      return { error, data: null };
    }

    if (!data?.success) {
      console.error('❌ Admin notifications creation failed:', data?.error);
      return { error: new Error(data?.error || "Failed to create notifications"), data: null };
    }

    console.log(`✅ Successfully created ${data.data?.length || 0} admin notification(s)`);
    return { error: null, data: data.data };
  } catch (error) {
    console.error('❌ Exception creating admin notifications:', error);
    console.error('❌ Exception stack:', error.stack);
    return { error, data: null };
  }
}
