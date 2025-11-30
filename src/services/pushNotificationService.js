// Push Notification Service using Web Push API
// Handles registration and management of push notifications for admin users

import { supabase } from '../supabaseClient';
import { isValidVapidKeyFormat, getVapidKeyErrorMessage } from '../utils/validateVapidKey';

class PushNotificationService {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this.isSupported = this.checkSupport();
  }

  checkSupport() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      } else if (permission === 'denied') {
        console.warn('Notification permission denied');
        return false;
      } else {
        console.log('Notification permission default');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async registerServiceWorker() {
    if (!this.isSupported) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('Service Worker is ready');
      
      this.registration = registration;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  urlBase64ToUint8Array(base64String) {
    if (!base64String || typeof base64String !== 'string') {
      throw new Error('Invalid VAPID key: must be a non-empty string');
    }

    // Remove any whitespace
    base64String = base64String.trim();

    // Add padding if needed
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    try {
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (error) {
      throw new Error('Invalid VAPID key format: ' + error.message);
    }
  }

  async subscribeToPush(publicVapidKey) {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return null;
    }

    if (!publicVapidKey || publicVapidKey.trim() === '') {
      console.error('VAPID public key is required for push subscriptions');
      return null;
    }

    // Debug: Log VAPID key info (first and last 10 chars for security)
    const keyPreview = publicVapidKey.length > 20 
      ? `${publicVapidKey.substring(0, 10)}...${publicVapidKey.substring(publicVapidKey.length - 10)}`
      : publicVapidKey;
    console.log('Attempting to subscribe with VAPID key:', keyPreview, `(length: ${publicVapidKey.length})`);

    try {
      // Validate and convert VAPID key
      let applicationServerKey;
      try {
        applicationServerKey = this.urlBase64ToUint8Array(publicVapidKey);
        console.log('VAPID key converted successfully, length:', applicationServerKey.length);
      } catch (keyError) {
        console.error('Failed to convert VAPID key:', keyError);
        throw new Error(`Invalid VAPID key format: ${keyError.message}`);
      }
      
      // Check service worker state
      if (this.registration.active) {
        console.log('Service worker is active');
      } else if (this.registration.installing) {
        console.log('Service worker is installing, waiting...');
        await new Promise((resolve) => {
          this.registration.installing.addEventListener('statechange', () => {
            if (this.registration.installing.state === 'activated') {
              resolve();
            }
          });
        });
      } else if (this.registration.waiting) {
        console.log('Service worker is waiting, activating...');
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Found existing subscription');
        // Check if the existing subscription uses the same key
        const existingKey = existingSubscription.options?.applicationServerKey;
        if (existingKey && this.areKeysEqual(existingKey, applicationServerKey)) {
          console.log('Using existing push subscription (same key)');
          this.subscription = existingSubscription;
          return existingSubscription;
        } else {
          // Unsubscribe from old key and subscribe with new key
          console.log('Unsubscribing from old push subscription (different key)');
          try {
            await existingSubscription.unsubscribe();
            console.log('Old subscription unsubscribed successfully');
          } catch (unsubError) {
            console.warn('Error unsubscribing from old subscription:', unsubError);
            // Continue anyway
          }
        }
      }

      // Wait a bit more to ensure service worker is ready
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('Creating new push subscription...');
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      console.log('Push subscription successful!');
      console.log('Subscription endpoint:', subscription.endpoint.substring(0, 50) + '...');
      this.subscription = subscription;
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Provide helpful error messages
      if (error.name === 'AbortError') {
        console.error('❌ Push subscription failed. Common causes:');
        console.error('1. Invalid or missing VAPID public key');
        console.error('   - Check your .env file has REACT_APP_VAPID_PUBLIC_KEY set');
        console.error('   - Key should be ~87 characters, base64url encoded');
        console.error('   - Restart dev server after adding to .env');
        console.error('2. Service worker not properly activated');
        console.error('   - Check DevTools > Application > Service Workers');
        console.error('   - Try unregistering and reloading');
        console.error('3. Browser does not support push notifications');
        console.error('   - Try Chrome, Firefox, or Edge');
        console.error('4. Not using HTTPS (required for production)');
        console.error('   - localhost is OK for development');
        console.error('5. Browser push service error');
        console.error('   - Try clearing browser cache and cookies');
        console.error('   - Try incognito/private mode');
      }
      
      return null;
    }
  }

  areKeysEqual(key1, key2) {
    if (key1 instanceof Uint8Array && key2 instanceof Uint8Array) {
      if (key1.length !== key2.length) return false;
      for (let i = 0; i < key1.length; i++) {
        if (key1[i] !== key2[i]) return false;
      }
      return true;
    }
    return false;
  }

  async getSubscription() {
    if (!this.registration) {
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      return subscription;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  }

  subscriptionToJSON(subscription) {
    if (!subscription) return null;

    const keys = subscription.getKey ? {
      p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: this.arrayBufferToBase64(subscription.getKey('auth')),
    } : {};

    return {
      endpoint: subscription.endpoint,
      keys: keys,
    };
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timestamp: new Date().toISOString(),
    };
  }

  async saveSubscriptionToDatabase(subscription, userId) {
    if (!subscription || !userId) {
      return false;
    }

    try {
      const subscriptionData = this.subscriptionToJSON(subscription);

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
            device_info: this.getDeviceInfo(),
            last_used: new Date().toISOString(),
            is_active: true,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return false;
        }
        return true;
      } else {
        // Insert new subscription
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            endpoint: subscriptionData.endpoint,
            subscription_data: subscriptionData,
            device_info: this.getDeviceInfo(),
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
            is_active: true,
          });

        if (insertError) {
          console.error('Error inserting subscription:', insertError);
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error('Error saving subscription to database:', error);
      return false;
    }
  }

  async initialize(userId, publicVapidKey) {
    console.log('🔔 Initializing push notifications...');
    
    if (!this.isSupported) {
      console.warn('❌ Push notifications not supported in this browser');
      return false;
    }
    console.log('✅ Browser supports push notifications');

    // Validate VAPID key early
    if (!publicVapidKey || publicVapidKey.trim() === '') {
      console.warn('❌ VAPID public key not provided. Push notifications will not work.');
      console.warn('📝 Please set REACT_APP_VAPID_PUBLIC_KEY in your .env file');
      console.warn('🔑 Generate keys with: npm install -g web-push && web-push generate-vapid-keys');
      console.warn('⚠️  Make sure to restart your dev server after adding the key!');
      return false;
    }

    // Validate VAPID key format
    if (!isValidVapidKeyFormat(publicVapidKey)) {
      console.error('❌', getVapidKeyErrorMessage(publicVapidKey));
      console.error('🔑 Please generate a new VAPID key pair using: web-push generate-vapid-keys');
      return false;
    }
    console.log('✅ VAPID key format is valid');

    // Request permission
    console.log('🔔 Requesting notification permission...');
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('❌ Notification permission denied by user');
      console.warn('💡 User needs to allow notifications in browser settings');
      return false;
    }
    console.log('✅ Notification permission granted');

    // Register service worker
    console.log('📝 Registering service worker...');
    const registration = await this.registerServiceWorker();
    if (!registration) {
      console.warn('❌ Failed to register service worker');
      return false;
    }
    console.log('✅ Service worker registered');

    // Wait for service worker to be fully ready
    console.log('⏳ Waiting for service worker to be ready...');
    try {
      await navigator.serviceWorker.ready;
      console.log('✅ Service worker is ready');
      
      // Additional wait to ensure it's fully activated
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn('⚠️  Error waiting for service worker:', e);
    }

    // Check for existing subscription
    console.log('🔍 Checking for existing subscription...');
    let subscription = await this.getSubscription();

    // If no subscription, create one with VAPID key
    if (!subscription) {
      console.log('📝 No existing subscription found, creating new one...');
      subscription = await this.subscribeToPush(publicVapidKey);
    } else {
      console.log('✅ Found existing subscription');
    }

    if (!subscription) {
      console.error('❌ Failed to get or create push subscription');
      console.error('🔍 Debugging steps:');
      console.error('1. Check browser console for detailed errors above');
      console.error('2. Verify VAPID key in .env file (restart server after changes)');
      console.error('3. Check DevTools > Application > Service Workers');
      console.error('4. Try clearing browser cache and reloading');
      console.error('5. Check if using HTTPS (or localhost for dev)');
      return false;
    }

    // Save subscription to database
    const saved = await this.saveSubscriptionToDatabase(subscription, userId);
    if (saved) {
      console.log('Push notification subscription saved successfully');
      this.subscription = subscription;
      return true;
    } else {
      console.warn('Failed to save subscription to database, but subscription was created');
      // Still return true as subscription exists, just not saved
      return true;
    }
  }

  async unsubscribe(userId) {
    if (!this.subscription) {
      const subscription = await this.getSubscription();
      if (!subscription) {
        return false;
      }
      this.subscription = subscription;
    }

    try {
      // Unsubscribe from push
      const unsubscribed = await this.subscription.unsubscribe();
      if (unsubscribed) {
        // Delete from database
        const subscriptionData = this.subscriptionToJSON(this.subscription);
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscriptionData.endpoint);

        if (!error) {
          this.subscription = null;
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  }

  // Show local notification (for foreground notifications)
  showLocalNotification(title, options = {}) {
    if (Notification.permission === 'granted' && this.registration) {
      this.registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || '/logo192.png',
        badge: options.badge || '/logo192.png',
        tag: options.tag || 'notification',
        data: options.data || {},
        requireInteraction: options.requireInteraction || false,
      });
    }
  }
}

// Export singleton instance
const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
