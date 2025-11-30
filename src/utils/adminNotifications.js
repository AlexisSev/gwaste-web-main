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

