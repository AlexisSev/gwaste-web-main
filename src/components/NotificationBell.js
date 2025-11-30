import React, { useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import './NotificationBell.css';

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    requestPermission
  } = useNotifications();

  const [isOpen, setIsOpen] = React.useState(false);

  // Request notification permission on mount
  useEffect(() => {
    requestPermission();
  }, []);

  return (
    <div className="notification-bell-container">
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="notification-overlay"
            onClick={() => setIsOpen(false)}
          />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="notification-mark-all"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={16} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="notification-unread-indicator" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

