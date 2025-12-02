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
        .select('id, user_id, name, email'); // Select specific fields

      console.log('📊 Admins query result:', { 
        count: admins?.length || 0, 
        admins: admins,
        error: adminError 
      });
      
      if (adminError) {
        console.error('❌ Error details:', JSON.stringify(adminError, null, 2));
      }

      if (adminError) {
        console.error('❌ Error fetching admins:', adminError);
        return { error: adminError };
      }

      // Only use user_id field - this must match the user_id in push_subscriptions table
      // Filter out any admins without a valid user_id
      targetUserIds = admins
        ?.map(admin => admin.user_id) // Only use user_id, not id or email
        .filter(userId => userId != null && userId !== '') || [];
      
      console.log('📋 All admins fetched:', admins);
      console.log('🎯 Target user IDs found (using user_id only):', targetUserIds);
      
      if (targetUserIds.length === 0 && admins && admins.length > 0) {
        console.warn('⚠️ No admins have a valid user_id field');
        console.warn('📋 Admin records:', admins.map(a => ({ id: a.id, user_id: a.user_id, name: a.name, email: a.email })));
      }
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

        console.log('📤 Invoking edge function with body:', requestBody);
        const { data, error } = await supabase.functions.invoke('rapid-function', {
          body: requestBody,
        });
        
        if (error) {
          console.error(`❌ Edge function error for admin ${adminUserId}:`, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
          console.log(`✅ Edge function response for admin ${adminUserId}:`, data);
        }

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
 * Creates separate notifications for each area collected
 */
export async function notifyNewCollection(collection) {
  console.log('🔔 notifyNewCollection called with:', collection);
  
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
    areas = ['an area'];
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
  
  // Send separate notification for each area
  const results = await Promise.allSettled(
    areas.map(async (area, index) => {
      // Create unique tag for each area notification - include area name in tag for uniqueness
      const areaSlug = area.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const uniqueTag = collection.id 
        ? `collection-${collection.id}-${areaSlug}-${index}-${Date.now()}` 
        : `collection-${Date.now()}-${areaSlug}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      
      const notificationOptions = {
        title: 'New Collection Completed',
        body: `${collection.collector_name || 'Driver'} collected from ${area}${routeInfo}`,
        icon: '/logo192.png',
        url: '/Dashboard',
        tag: uniqueTag, // Unique tag ensures each notification is shown separately
      };
      
      console.log(`📤 Sending push notification ${index + 1}/${areas.length} for area: ${area}`);
      console.log('🏷️ Unique notification tag:', uniqueTag);
      console.log('📦 Notification body:', notificationOptions.body);
      
      // Add small delay between notifications to avoid rate limiting
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * index));
      }
      
      return await sendPushNotification(notificationOptions);
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`📤 Push notification results: ${successful} successful, ${failed} failed`);
  return { successful, failed, total: areas.length };
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

