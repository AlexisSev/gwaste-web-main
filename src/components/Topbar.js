import React, { useState } from "react";
import "../App.css";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

const Topbar = ({
  unresolvedCount,
  collectionNotifications = [],
  adminName = "Admin",
  adminEmail = "Supervisor",
  onNotificationRead = () => {},
}) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

// Normalize notifications received from parent (already real-time data)
const notifications = collectionNotifications.map((notification, index) => ({
  id: notification.id || `collection-${index}`,
  type: notification.type || "collection",
  title: notification.title || "Collection Completed",
  message: notification.message || "A garbage collection was completed.",
  timestamp: notification.timestamp ? new Date(notification.timestamp) : new Date(),
  read: Boolean(notification.read)
}));

const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const markAsRead = (notificationId) => {
    onNotificationRead(notificationId);
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const eventTime = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diff = now - eventTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      <div className="topbar custom-topbar">
        <div className="topbar-actions">
          <button className="topbar-icon-btn" type="button" onClick={() => setHelpOpen(true)} aria-label="Help">
            <HelpOutlineIcon />
          </button>
          <button
            className="topbar-icon-btn"
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Notifications"
          >
            <NotificationsNoneIcon />
            {(unreadNotificationCount + unresolvedCount) > 0 && (
              <span className="topbar-notif-count">{unreadNotificationCount + unresolvedCount}</span>
            )}
          </button>
          <div className="topbar-user-chip">
            <span>{adminName}</span>
            <small>{adminEmail || "Supervisor"}</small>
          </div>
        </div>
      </div>

      {helpOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.25)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              maxWidth: 420,
              width: "90vw",
              boxShadow: "0 8px 32px rgba(51,106,41,0.13)",
              position: "relative",
            }}
          >
            <h2 style={{ color: "#386D2C", marginBottom: 18 }}>Help & Quick Tips</h2>
            <ul style={{ color: "#222", fontSize: 16, lineHeight: 1.7, marginBottom: 18 }}>
              <li>To <b>add a collector</b>, click the <b>Add Collector</b> button and fill out the form.</li>
              <li>To <b>edit a driver or crew</b>, click the <b>Edit</b> button on the collector card.</li>
              <li>To <b>view details</b> of a collector, click <b>View Details</b> on their card.</li>
              <li>Use the <b>search bar</b> to quickly find collectors by name.</li>
              <li>Check the <b>Dashboard</b> for total drivers, crew, and route stats.</li>
              <li>Go to <b>Settings</b> to update your profile or change your password.</li>
              <li>Need more help? Contact your system administrator.</li>
            </ul>
            <button
              style={{
                background: "#4B8B3B",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                marginTop: 8,
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
              }}
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {notificationsOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 70,
          paddingRight: 20,
        }} onClick={() => setNotificationsOpen(false)}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            width: 380,
            maxHeight: '70vh',
            overflow: 'hidden',
            position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, color: '#386D2C', fontSize: 18, fontWeight: 600 }}>
                Notifications
              </h3>
              <button
                onClick={() => setNotificationsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666',
                  padding: 0,
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              maxHeight: 'calc(70vh - 80px)',
              overflowY: 'auto',
            }}>

              {unresolvedCount > 0 && (
                <div style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #f5f5f5',
                  background: '#fff7e6'
                }}>
                  <div style={{ fontWeight: 600, color: '#b25e09', marginBottom: 4 }}>
                    {unresolvedCount} unresolved report{unresolvedCount > 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#7a4a0f' }}>
                    Review pending issues under the Issues section.
                  </div>
                </div>
              )}

              {notifications.length === 0 ? (
                <div style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 16,
                }}>
                  No collection notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      background: notification.read ? '#fff' : '#f8f9ff',
                      transition: 'background 0.2s ease',
                    }}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: notification.read ? '#ccc' : '#4B8B3B',
                        marginTop: 6,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 600,
                          color: '#386D2C',
                          fontSize: 14,
                          marginBottom: 4,
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          color: '#666',
                          fontSize: 13,
                          lineHeight: 1.4,
                          marginBottom: 6,
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          color: '#999',
                          fontSize: 11,
                        }}>
                          {formatTimeAgo(notification.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;