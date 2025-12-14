import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/**
 * Custom hook for managing dashboard data
 * Handles data fetching, real-time subscriptions, and state management
 */
export function useDashboardData() {
  const [routes, setRoutes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch routes
  const fetchRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .order("route", { ascending: true });

      if (error) {
        console.error("Error fetching routes:", error);
        return;
      }

      setRoutes(data || []);
    } catch (err) {
      console.error("Error fetching routes:", err);
    }
  };

  // Fetch collections
  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order("collected_at", { ascending: false });

      if (error) {
        console.error("Error fetching collections:", error);
        return;
      }

      console.log(`📊 Dashboard: Loaded ${data?.length || 0} collections`);
      setCollections(data || []);
    } catch (err) {
      console.error("Error fetching collections:", err);
    }
  };

  // Fetch reports
  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching reports:", error);
        return;
      }

      setReports(data || []);
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  // Main data fetching function
  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRoutes(),
      fetchCollections(),
      fetchReports()
    ]);
    setLoading(false);
  };

  // Set up real-time subscriptions
  useEffect(() => {
    let isMounted = true;
    let isCleaningUp = false;

    fetchAllData();

    // Routes subscription
    const routesChannel = supabase
      .channel("routes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routes" },
        () => {
          if (isMounted) {
            fetchRoutes();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CLOSED" && !isCleaningUp) {
          console.warn("⚠️ Routes subscription closed unexpectedly");
          if (err) console.error("Routes subscription error:", err);
        }
      });

    // Collections subscription
    const collectionsChannel = supabase
      .channel("dashboard-collections-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        (payload) => {
          console.log("📊 Dashboard: Collection change detected:", payload.eventType);
          if (isMounted) {
            fetchCollections();
          }
        }
      )
      .subscribe((status, err) => {
        console.log("📊 Dashboard collections subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Dashboard subscribed to collections changes - analytics will update automatically");
        } else if (status === "CLOSED" && !isCleaningUp) {
          console.warn("⚠️ Dashboard collections subscription closed unexpectedly. Real-time updates disabled.");
          if (err) {
            console.error("Subscription error:", err);
          }
          // Attempt to resubscribe after a delay
          setTimeout(() => {
            if (isMounted && !isCleaningUp) {
              console.log("🔄 Attempting to resubscribe to collections...");
              collectionsChannel.subscribe();
            }
          }, 3000);
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Dashboard collections subscription error:", err);
        }
      });

    // Reports subscription
    const reportsChannel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          if (isMounted) {
            fetchReports();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CLOSED" && !isCleaningUp) {
          console.warn("⚠️ Reports subscription closed unexpectedly");
          if (err) console.error("Reports subscription error:", err);
        }
      });

    return () => {
      isMounted = false;
      isCleaningUp = true; // Mark that we're cleaning up to avoid false warnings
      supabase.removeChannel(routesChannel);
      supabase.removeChannel(collectionsChannel);
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  return {
    routes,
    collections,
    reports,
    loading,
    refreshData: fetchAllData
  };
}
