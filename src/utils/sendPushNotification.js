// Utility function to send push notifications via Supabase Edge Function
// This can be called from anywhere in the app


import { supabase } from '../supabaseClient';

/**
 * Send a push notification to admin users
 * @param {Object} options - Notification options
 * @param {string} options.userId - User ID to send notification to (optional, sends to all admins if not provided)
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} options.icon - Icon URL (optional)
 * @param {string} options.url - URL to navigate to when clicked (optional)
 * @param {string} options.tag - Notification tag (optional)
 * @returns {Promise<Object>} Response from edge function
 */
export async function sendPushNotification(options) {
  try {
    const { userId, title, body, icon, url, tag } = options;

    if (!title || !body) {
      throw new Error('Title and body are required');
    }

    // If userId is not provided, get all admin user IDs
    let targetUserIds = [];
    if (userId) {
      targetUserIds = [userId];
    } else {
      // Get all admin user IDs
      console.log('🔍 Fetching admin users for notifications...');
      const { data: admins, error: adminError } = await supabase
        .from('admins')
        .select('*'); // Get all columns to see what's available

      console.log('📊 Admins query result:', { data: admins, error: adminError });

      if (adminError) {
        console.error('❌ Error fetching admins:', adminError);
        return { error: adminError };
      }

      // Try different column names that might exist
      targetUserIds = admins?.map(admin => admin.user_id || admin.id || admin.email).filter(Boolean) || [];
      console.log('🎯 Target user IDs found:', targetUserIds);
    }

    if (targetUserIds.length === 0) {
      console.warn('⚠️ No admin users found to send notification to');
      console.warn('💡 Check your admins table structure and RLS policies');
      return { message: 'No admin users found' };
    }

    // Send notification to each admin
    console.log(`📤 Sending push notifications to ${targetUserIds.length} admin(s)...`);
    const results = await Promise.allSettled(
      targetUserIds.map(async (adminUserId) => {
        console.log(`📤 Sending to admin ${adminUserId}...`);
        const requestBody = {
          userId: adminUserId,
          title,
          body,
          icon: icon || '/logo192.png',
          url: url || '/',
          tag: tag || 'notification',
        };
        console.log('📦 Request body:', requestBody);

        const { data, error } = await supabase.functions.invoke('rapid-function', {
          body: requestBody,
        });

        if (error) {
          console.error(`❌ Error sending to admin ${adminUserId}:`, error);
        } else {
          console.log(`✅ Successfully sent to admin ${adminUserId}:`, data);
        }

        return { data, error, adminUserId };
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      successful,
      failed,
      total: targetUserIds.length,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { error: error.message };
  }
}

/**
 * Send push notification for new report
 */
export async function notifyNewReport(report) {
  return sendPushNotification({
    title: 'New Report Submitted',
    body: `A new report has been submitted${report.location ? ` at ${report.location}` : ''}`,
    icon: '/logo192.png',
    url: '/Reports',
    tag: 'report',
  });
}

/**
 * Send push notification for new collection
 */
export async function notifyNewCollection(collection) {
  // Format areas collected
  let areasText = 'an area';
  if (collection.areas_collected && Array.isArray(collection.areas_collected) && collection.areas_collected.length > 0) {
    areasText = collection.areas_collected.join(', ');
  }
  
  // Get route name if route_id is available
  let routeInfo = '';
  if (collection.route_id) {
    try {
      const { data: route } = await supabase
        .from('routes')
        .select('route')
        .eq('id', collection.route_id)
        .single();
      
      if (route) {
        routeInfo = ` (Route ${route.route})`;
      }
    } catch (error) {
      console.error('Error fetching route name:', error);
    }
  }
  
  return sendPushNotification({
    title: 'New Collection Completed',
    body: `${collection.collector_name || 'Driver'} collected from ${areasText}${routeInfo}`,
    icon: '/logo192.png',
    url: '/Dashboard',
    tag: 'collection',
  });
}

/**
 * Send push notification for unresolved reports count
 */
export async function notifyUnresolvedReports(count) {
  if (count > 0) {
    return sendPushNotification({
      title: 'Unresolved Reports',
      body: `You have ${count} unresolved report${count > 1 ? 's' : ''} that need attention`,
      icon: '/logo192.png',
      url: '/Reports',
      tag: 'unresolved-reports',
    });
  }
}

