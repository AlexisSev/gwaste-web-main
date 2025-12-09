import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Schedule from "./pages/Schedule";
import MapTracking from "./pages/MapTracking";
import Collector from "./pages/Collector";
import ResidentIssues from "./pages/ResidentIssues";
import History from "./pages/History";
import RoutePerformanceAI from "./pages/RoutePerformanceAI";
import WastePrediction from "./pages/WastePrediction";
import Login from "./pages/Login";
import LogoutModal from "./components/LogoutModal";
import NotificationPrompt from "./components/NotificationPrompt";
import { notifyNewCollection } from "./utils/sendPushNotification";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
} from "./utils/adminNotifications";
import pushNotificationService from "./services/pushNotificationService";
import "./App.css";
import { supabase } from "./supabaseClient";

const mapNotificationRecord = (record) => ({
  id: record.id,
  type: record.notification_type || "collection",
  title: record.title,
  message: record.message,
  timestamp: record.created_at,
  read: record.read,
  collectionId: record.collection_id,
  metadata: record.metadata || {},
});

function App() {
  const [page, setPage] = useState("Dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [collectionNotifications, setCollectionNotifications] = useState([]);
  const [adminName, setAdminName] = useState("Admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [collectorId, setCollectorId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin', 'collector', or 'unknown'

  const ensureAdminRecord = useCallback(async (user) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        return; // admin already exists
      }

      const { error: insertError } = await supabase.from("admins").insert({
        user_id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
        email: user.email,
        profile_image_base64: user.user_metadata?.avatar_url || null,
      });

      if (insertError) {
        console.error("Failed to insert admin record:", insertError);
      } else {
        console.log("✅ Admin record created for", user.email);
      }
    } catch (err) {
      console.error("Failed ensuring admin record:", err);
    }
  }, []);

  const loadAdminNotifications = useCallback(async () => {
    const { data, error } = await fetchAdminNotifications();
    if (!error && data) {
      setCollectionNotifications(data.map(mapNotificationRecord));
      console.log(`📊 Loaded ${data.length} admin notifications (${data.filter(n => !n.read).length} unread)`);
    } else if (error) {
      console.error("❌ Error loading admin notifications:", error);
    }
  }, []);

  const handleNotificationRead = async (notificationId) => {
    if (!notificationId) return;
    await markAdminNotificationRead(notificationId);
    setCollectionNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUnresolvedReports = async () => {
      const { data, error } = await supabase.from("reports").select("status");

      if (!error && isMounted) {
        const unresolved = (data || []).filter(
          (report) => report.status === "unresolved"
        ).length;
        setUnresolvedCount(unresolved);
      } else if (error) {
        console.error("Error fetching unresolved reports:", error);
      }
    };

    fetchUnresolvedReports();

    const channel = supabase
      .channel("reports-unresolved")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => fetchUnresolvedReports()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Collection notifications listener (admins)
  useEffect(() => {
    if (userRole !== "admin") return;

    let isMounted = true;

    console.log("🔄 Setting up collection notifications listener...");

    // Channel for collections table (for push notifications)
    const collectionsChannel = supabase
      .channel("collections-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "collections" },
        (payload) => {
          console.log("📡 REALTIME EVENT RECEIVED:", payload);
          console.log("📦 Event type:", payload.eventType);
          console.log("🆕 New collection data:", payload.new);

          if (!isMounted) {
            console.log("⚠️ Component not mounted, ignoring event");
            return;
          }

          const newCollection = payload.new;
          console.log("✅ Processing new collection:", newCollection.collector_name);
          console.log("📦 Collection data:", JSON.stringify(newCollection, null, 2));
          console.log("📦 Areas collected:", newCollection.areas_collected);

          // Database trigger automatically creates admin notifications (one per area)
          // No need to create them here to avoid duplication
          console.log("✅ Collection inserted - database trigger will create admin notifications automatically");

          // Send push notification to admins (one per area)
          console.log("🚀 Triggering collection push notification...");
          notifyNewCollection(newCollection)
            .then((result) => {
              console.log("📤 Collection push notification result:", result);
              if (result?.error) {
                console.error("❌ Push notification error:", result.error);
              } else if (result?.successful !== undefined) {
                console.log(`✅ Push notifications sent: ${result.successful} successful, ${result.failed} failed`);
              }
            })
            .catch((error) => {
              console.error("❌ Failed to send collection push notification:", error);
              console.error("Error stack:", error.stack);
            });

          // Optional: Show browser notification if permission granted
          // Show one notification per area to match push notifications
          if (Notification.permission === "granted" && newCollection.areas_collected) {
            const areas = Array.isArray(newCollection.areas_collected) 
              ? newCollection.areas_collected 
              : [newCollection.areas_collected];
            
            areas.forEach((area, index) => {
              const uniqueTag = newCollection.id 
                ? `browser-collection-${newCollection.id}-${index}-${Date.now()}` 
                : `browser-collection-${Date.now()}-${index}`;
              
              setTimeout(() => {
                new Notification("G-Waste Collection", {
                  body: `${newCollection.collector_name || "A collector"} collected from ${area}`,
                  icon: "/favicon.ico",
                  tag: uniqueTag, // Unique tag prevents notification replacement
                });
              }, index * 200); // Stagger browser notifications
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("🔌 Collections subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ SUCCESSFULLY SUBSCRIBED to collections changes");
          console.log("🎧 Listening for INSERT events on 'collections' table...");
          console.log("💡 Make sure Realtime is enabled for 'collections' table in Supabase");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ FAILED to subscribe to collections changes");
          console.error("💡 Check Supabase dashboard: Database > Replication > Enable for 'collections' table");
        } else if (status === "TIMED_OUT") {
          console.error("⏰ Collections subscription timed out");
          console.error("💡 Check your internet connection and Supabase project status");
        } else if (status === "CLOSED") {
          console.log("🔒 Collections subscription closed");
        }
      });

    // Channel for admin_notifications table (for badge updates)
    const notificationsChannel = supabase
      .channel("admin-notifications-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          console.log("🔔 REALTIME ADMIN NOTIFICATION EVENT:", payload);
          console.log("📦 Event type:", payload.eventType);
          console.log("🆕 New notification data:", payload.new);

          if (!isMounted) {
            console.log("⚠️ Component not mounted, ignoring notification event");
            return;
          }

          const newNotification = payload.new;
          
          // Send browser push notification for "Area Collection Completed" notifications
          // Each admin_notification represents one area, so each INSERT = one browser notification
          if (newNotification.title === "Area Collection Completed") {
            
            console.log("📱 Sending browser push notification for area collection...");
            
            // Check if browser notifications are supported and permission is granted
            if ("Notification" in window && Notification.permission === "granted") {
              // Extract area name from message or metadata
              let areaName = "an area";
              if (newNotification.metadata?.area) {
                areaName = newNotification.metadata.area;
              } else if (newNotification.areas_collected && Array.isArray(newNotification.areas_collected) && newNotification.areas_collected.length > 0) {
                areaName = newNotification.areas_collected[0];
              } else if (newNotification.message) {
                // Try to extract area from message: "Collector collected from Area Name"
                const match = newNotification.message.match(/collected from (.+?)(?:\s+\(|$)/i);
                if (match && match[1]) {
                  areaName = match[1].trim();
                }
              }
              
              const collectorName = newNotification.collector_name || newNotification.metadata?.collector_name || "Driver";
              const uniqueTag = `admin-notification-${newNotification.id}-${Date.now()}`;
              
              try {
                new Notification("Area Collection Completed", {
                  body: `${collectorName} collected from ${areaName}`,
                  icon: "/favicon.ico",
                  badge: "/logo192.png",
                  tag: uniqueTag, // Unique tag prevents notification replacement
                  requireInteraction: false,
                });
                console.log(`✅ Browser push notification sent for area: ${areaName}`);
              } catch (error) {
                console.error("❌ Error showing browser notification:", error);
              }
            } else if ("Notification" in window && Notification.permission === "default") {
              console.log("⚠️ Notification permission not yet granted, skipping browser notification");
            } else if ("Notification" in window && Notification.permission === "denied") {
              console.log("⚠️ Notification permission denied by user");
            } else {
              console.log("⚠️ Browser notifications not supported");
            }
          }

          console.log("✅ New admin notification created, reloading notifications...");
          // Small delay to ensure the notification is fully committed
          setTimeout(() => {
            if (isMounted) {
              loadAdminNotifications();
            }
          }, 100);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_notifications" },
        (payload) => {
          console.log("🔄 ADMIN NOTIFICATION UPDATED:", payload);
          if (!isMounted) return;
          // Reload notifications when one is marked as read
          loadAdminNotifications();
        }
      )
      .subscribe((status) => {
        console.log("🔌 Admin notifications subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ SUCCESSFULLY SUBSCRIBED to admin_notifications changes");
          console.log("🎧 Listening for INSERT/UPDATE events on 'admin_notifications' table...");
          console.log("💡 Badge will now update automatically without page refresh!");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ FAILED to subscribe to admin_notifications changes");
          console.error("⚠️ Make sure Realtime is enabled for admin_notifications table in Supabase");
        } else if (status === "TIMED_OUT") {
          console.error("⏰ Admin notifications subscription timed out");
        } else if (status === "CLOSED") {
          console.log("🔒 Admin notifications subscription closed");
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(collectionsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [userRole, loadAdminNotifications]);

  const handleLogin = async (name, email) => {
    setIsLoggedIn(true);
    setAdminName(name || "Admin");
    setAdminEmail(email || "");

    // Check if user is admin or collector
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        console.log("🔍 Checking user role for:", name, email);
        console.log("User ID:", user.id);

        // First check if user is an admin
        const { data: adminData, error: adminError } = await supabase
          .from("admins")
          .select("id, name, email")
          .eq("user_id", user.id)
          .single();

        if (!adminError && adminData) {
          // User is an admin - they can see all trucks
          setUserRole("admin");
          setCollectorId(null); // No filtering for admins
          await ensureAdminRecord(user);
          setAdminName(
            adminData.name ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email ||
              name ||
              "Admin"
          );
          setAdminEmail(adminData.email || user.email || email || "");
          console.log(
            "✅ Logged in as admin:",
            adminData.name || adminData.email
          );
          console.log("Admin details:", adminData);

          // Initialize push notifications for admin
          try {
            const publicVapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || window.VAPID_PUBLIC_KEY || '';
            if (publicVapidKey) {
              console.log("🚀 Initializing push notifications for admin...");
              console.log("🔑 VAPID key present:", publicVapidKey.substring(0, 20) + "...");
              
              // Check if service worker is already registered
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                  console.log("✅ Service worker already registered");
                } else {
                  console.log("⚠️ Service worker not registered, will register now");
                }
              }
              
              const initialized = await pushNotificationService.initialize(user.id, publicVapidKey);
              if (initialized) {
                console.log("✅ Push notifications initialized successfully");
                
                // Verify subscription was saved
                const subscription = await pushNotificationService.getSubscription();
                if (subscription) {
                  console.log("✅ Push subscription verified:", subscription.endpoint.substring(0, 50) + "...");
                } else {
                  console.warn("⚠️ Push subscription not found after initialization");
                }
              } else {
                console.warn("⚠️ Push notifications failed to initialize");
                console.warn("💡 Check browser console for detailed error messages");
              }
            } else {
              console.warn("❌ VAPID public key not configured. Push notifications will not work.");
              console.warn("💡 Set REACT_APP_VAPID_PUBLIC_KEY in your .env file");
            }
          } catch (error) {
            console.error("❌ Error initializing push notifications:", error);
            console.error("Error stack:", error.stack);
          }

          await loadAdminNotifications();
          return;
        }

        // If not admin, check if they're a collector
        console.log("🔍 User is not admin, checking for collector record...");

        // Show available collectors for debugging
        const { data: allCollectors, error: listError } = await supabase
          .from("collectors")
          .select("collector_id, firstName, lastName, contact, status")
          .limit(10);

        if (!listError && allCollectors) {
          console.log("📋 Available collectors:", allCollectors);
        }

        // Try to find collector by email first
        let { data: collectorData, error } = await supabase
          .from("collectors")
          .select("collector_id, status, firstName, lastName, contact")
          .eq("contact", email) // Assuming email is stored in contact field
          .eq("status", "active") // Only get active collectors
          .single();

        console.log("🔍 Email search result:", { collectorData, error });

        // If not found by email, try by name matching
        if (error && name) {
          console.log("🔄 Trying name match for:", name);
          const nameParts = name.split(" ");
          if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ");
            console.log("🔍 Searching for:", { firstName, lastName });

            const { data: nameMatch, error: nameError } = await supabase
              .from("collectors")
              .select("collector_id, status, firstName, lastName, contact")
              .eq("firstName", firstName)
              .eq("lastName", lastName)
              .eq("status", "active")
              .single();

            console.log("🔍 Name search result:", { nameMatch, nameError });

            if (!nameError && nameMatch) {
              collectorData = nameMatch;
              error = null;
            }
          } else {
            console.log("⚠️ Name format not recognized for search:", name);
          }
        }

        if (!error && collectorData) {
          setUserRole("collector");
          setCollectorId(collectorData.collector_id);
          console.log(
            "✅ Logged in as active collector:",
            collectorData.collector_id,
            "- Status:",
            collectorData.status
          );
          console.log("Collector details:", collectorData);
        } else {
          console.warn("❌ No active collector found for user:", name, email);
          console.warn(
            "This user appears to be neither an admin nor an active collector."
          );
          console.warn(
            "They will be able to use the app but won't see filtered truck data."
          );
          setUserRole("unknown");
          setCollectorId(null);
        }
      }
    } catch (error) {
      console.error("Error determining user role:", error);
      setUserRole("unknown");
      setCollectorId(null);
    }
  };
  const handleLogout = async () => {
    setShowLogoutModal(false);
    setIsLoggedIn(false);
    setCollectionNotifications([]);
    setUserRole(null);
    setCollectorId(null);

    try {
      await supabase.auth.signOut();
      console.log("👋 User signed out, session cleared");
    } catch (error) {
      console.error("❌ Error signing out:", error);
    }
  };

  const handleShowLogout = () => setShowLogoutModal(true);
  const handleCancelLogout = () => setShowLogoutModal(false);

  const renderPage = () => {
    switch (page) {
      case "Dashboard":
        return <Dashboard onNavigate={setPage} />;
      case "Schedule":
        return <Schedule />;
      case "MapTracking":
        return <MapTracking collectorId={collectorId} userRole={userRole} />;
      case "Collector":
        return <Collector />;

      case "Reports":
        return <ResidentIssues />;
      case "History":
        return <History />;
      case "RoutePerformanceAI":
        return <RoutePerformanceAI />;
      case "WastePrediction":
        return <WastePrediction />;
      case "Settings":
        return <Settings adminName={adminName} adminEmail={adminEmail} />;
      default:
        return <Dashboard onNavigate={setPage} />;
    }
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-container">
      <Sidebar
        onNavigate={setPage}
        onLogout={handleShowLogout}
        currentPage={page}
        adminName={adminName}
        adminEmail={adminEmail}
        unresolvedCount={unresolvedCount}
      />
      <div className="main-content main-content-padding">
        <Topbar
          unresolvedCount={unresolvedCount}
          collectionNotifications={collectionNotifications}
          adminName={adminName}
          adminEmail={adminEmail}
          onNotificationRead={handleNotificationRead}
        />
        <div className="page-content">{renderPage()}</div>
        <LogoutModal
          isOpen={showLogoutModal}
          onCancel={handleCancelLogout}
          onConfirm={handleLogout}
        />
      </div>

      {/* Browser Notification Prompt */}
      <NotificationPrompt />
    </div>
  );
}

export default App;
