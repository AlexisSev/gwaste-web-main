import React, { useState, useEffect } from 'react';
import '../App.css';

const NotificationPrompt = () => {
  const [userResponded, setUserResponded] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    // Check current permission status
    console.log('🔔 Notification permission status:', Notification.permission);
    if (Notification.permission === 'granted') {
      setPermissionGranted(true);
      setUserResponded(true);
      console.log('✅ Permission already granted');
    } else if (Notification.permission === 'denied') {
      setUserResponded(true);
      console.log('❌ Permission denied');
    } else {
      console.log('❓ Permission not requested yet');
    }
  }, []);

  const notifyUser = async (notificationText = 'Thank you for enabling notifications!') => {
    console.log('🔔 notifyUser called with:', notificationText);
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }

    console.log('🔔 Current permission:', Notification.permission);

    if (Notification.permission === 'granted') {
      console.log('✅ Creating notification...');
      const notification = new Notification(notificationText, {
        icon: '/logo192.png',
        badge: '/logo192.png',
      });
      console.log('✅ Notification created:', notification);
    } else if (Notification.permission !== 'denied') {
      console.log('🔔 Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('🔔 Permission result:', permission);
      if (permission === 'granted') {
        setPermissionGranted(true);
        console.log('✅ Creating notification after permission...');
        const notification = new Notification(notificationText, {
          icon: '/logo192.png',
          badge: '/logo192.png',
        });
        console.log('✅ Notification created:', notification);
      } else {
        console.log('❌ Permission denied');
      }
    } else {
      console.log('❌ Permission already denied');
    }
  };

  const enableNotifsAndClose = async () => {
    await notifyUser();
    setUserResponded(true);
    setPermissionGranted(true);
  };

  const disableNotifsAndClose = () => {
    setUserResponded(true);
  };

  // Debug logging
  console.log('🔔 Render state:', { userResponded, permissionGranted, permission: Notification.permission });

  // Don't show if user has already responded or permissions are granted
  if (userResponded && permissionGranted) {
    return null;
  }

  // Don't show if user has responded but denied permissions
  if (userResponded && !permissionGranted) {
    console.log('🔔 User denied permissions, not showing anything');
    return null; // User denied, don't show anything
  }

  // If user hasn't responded yet, show permission prompt
  if (!userResponded) {
    console.log('🔔 Showing permission prompt');
  }

  // Show permission prompt
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        textAlign: 'center'
      }}>
        <div style={{
          width: 48,
          height: 48,
          background: '#4B8B3B',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 24
        }}>
          🔔
        </div>

        <h3 style={{
          margin: '0 0 8px 0',
          color: '#333',
          fontSize: 18
        }}>
          Enable Notifications
        </h3>

        <p style={{
          margin: '0 0 24px 0',
          color: '#666',
          lineHeight: 1.5
        }}>
          Would you like to enable browser notifications? You'll receive updates about collections and reports.
        </p>

        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center'
        }}>
          <button
            onClick={enableNotifsAndClose}
            style={{
              background: '#4B8B3B',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sure!
          </button>

          <button
            onClick={disableNotifsAndClose}
            style={{
              background: '#f5f5f5',
              color: '#666',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            No, Thanks
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPrompt;
