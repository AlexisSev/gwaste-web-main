import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

/**
 * Custom hook for managing schedule data
 * Handles data fetching, real-time subscriptions, and state management
 */
export function useScheduleData() {
  const [routes, setRoutes] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch routes
  const fetchRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .order("route");

      if (error) {
        console.error("Error fetching routes:", error);
        return;
      }

      setRoutes(data || []);
    } catch (err) {
      console.error("Error fetching routes:", err);
    }
  };

  // Fetch collectors
  const fetchCollectors = async () => {
    try {
      const { data, error } = await supabase
        .from("collectors")
        .select("*")
        .order("driver", { ascending: true });

      if (error) {
        console.error("Error fetching collectors:", error);
        return;
      }

      setCollectors(data || []);
    } catch (err) {
      console.error("Error fetching collectors:", err);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRoutes(),
        fetchCollectors()
      ]);
      if (isMounted) {
        setLoading(false);
      }
    };

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
      .subscribe();

    // Collectors subscription
    const collectorsChannel = supabase
      .channel("collectors-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collectors" },
        () => {
          if (isMounted) {
            fetchCollectors();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(routesChannel);
      supabase.removeChannel(collectorsChannel);
    };
  }, []);

  return {
    routes,
    collectors,
    loading,
    refreshRoutes: fetchRoutes,
    refreshCollectors: fetchCollectors
  };
}
