/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "../supabaseClient";
import "./MapTracking.css";
import PageHero from "../components/PageHero";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  X,
  MapPin,
  Clock,
  TrendingUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  initializeMap,
  fetchTruckLocations,
  setupTruckSubscription,
  startPolling,
  upsertTruckMarker,
  removeTruckMarker,
  cleanupMapTracking
} from "../services/mapTrackingService";
import {
  fetchTruckMovementData,
  processMovementHistory,
  processCollectionsData,
  findCollectorId
} from "../services/movementTrackingService";
import {
  getBarangayFromCoordinates,
  updateUserBarangayFromDevice
} from "../services/geocodingService";
import {
  isTruckOnline,
  formatTruckTimestamp,
  filterTruckLocations,
  sortTrucksByUpdateTime
} from "../utils/mapUtils";
import {
  buildGraphData,
  processCollectionsHistory,
  findCollectionMatches,
  calculateGraphStatistics,
  createCollectionReferenceLines,
  validateGraphData
} from "../utils/graphDataUtils";

// MapLibre GL replaces Leaflet for 3D buildings and tilting support

// Helper function to check if a string is a valid UUID
const isValidUUID = (str) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const MapTracking = ({ collectorId, userRole }) => {
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);
  const truckMarkersRef = useRef({});
  const driverCacheRef = useRef({}); // Cache driver data by collector_id
  const trucksDataRef = useRef({}); // Latest trucks data keyed by id
  const [trucks, setTrucks] = useState([]); // all trucks for list view
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  // Removed unused markerAnimationsRef
  const pollingRef = useRef(null);
  const [showGraphCard, setShowGraphCard] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [collectionsData, setCollectionsData] = useState([]);
  const [selectedTruckForGraph, setSelectedTruckForGraph] = useState(null);
  const [barangayCache, setBarangayCache] = useState({}); // Cache barangay lookups
  const [userBarangay, setUserBarangay] = useState(null); // Viewer/device barangay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const assignedColorsRef = useRef(new Map()); // Track assigned colors to ensure uniqueness

  // Configuration constants
  const OFFLINE_THRESHOLD_MINUTES = 5;

  useEffect(() => {
    initializeMap();
  }, []);

  // Clear existing data when collector changes
  useEffect(() => {
    // Clear existing markers and data when collector changes
    Object.values(truckMarkersRef.current).forEach((marker) => {
      if (marker && marker.remove) marker.remove();
    });
    truckMarkersRef.current = {};
    driverCacheRef.current = {};
    trucksDataRef.current = {};
    assignedColorsRef.current.clear(); // Clear color assignments
    setTrucks([]);
    setSelectedTruckId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorId]);

  useEffect(() => {
    console.log("🗺️ MapTracking userRole:", userRole);
    if (!map) return;

    const upsertMarker = async (row) => {
      // Use collector_id as the stable identifier for marker and color
      const id = row.collector_id || row.truck_id || row.id || row.location_id;
      const latitude = row.latitude ?? row.lat;
      const longitude = row.longitude ?? row.lng;
      if (latitude == null || longitude == null || id == null) return;

      // Check if truck is online (updated within threshold)
      const updatedAt = row.updated_at || row.inserted_at;
      if (!isTruckOnline(updatedAt)) {
        // Truck is offline, remove marker if it exists
        if (truckMarkersRef.current[id]) {
          removeMarker(row);
        }
        return;
      }

      const coords = [latitude, longitude];

      // Get color - use stored color if available, otherwise use default
      let color = trucksDataRef.current[id]?.color;
      if (!color) {
        color = "#3498db"; // Default blue color from service context
      }

      // Fetch driver info from Supabase collectors if not cached
      let driverInfo = driverCacheRef.current[id];
      if (!driverInfo) {
        try {
          // Try to match by collector_id first (handles custom ID formats)
          let query = supabase
            .from("collectors")
            .select(
              "driver, firstName, lastName, profile_image, collector_id, id, status"
            )
            .eq("collector_id", id)
            .eq("status", "active") // Only get active collectors
            .limit(1);

          let { data, error } = await query.single();

          // If no match and id looks like a UUID, try matching by id column
          if (error && isValidUUID(id)) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("collectors")
              .select(
                "driver, firstName, lastName, profile_image, collector_id, id, status"
              )
              .eq("id", id)
              .eq("status", "active")
              .limit(1)
              .single();

            if (!fallbackError && fallbackData) {
              data = fallbackData;
              error = null;
            }
          }
          if (!error && data) {
            const name =
              data.driver ||
              [data.firstName, data.lastName].filter(Boolean).join(" ") ||
              "Driver";
            driverInfo = {
              driver: name,
              profile_image: data.profile_image || null,
            };
            driverCacheRef.current[id] = driverInfo;
          } else {
            driverInfo = { driver: "Unknown Driver", profile_image: null };
          }
        } catch {
          driverInfo = { driver: "Unknown Driver", profile_image: null };
        }
      }

      // Update or create marker
      if (truckMarkersRef.current[id]) {
        // Update existing marker
        const marker = truckMarkersRef.current[id];
        const markerColor = trucksDataRef.current[id]?.color || color;
        const el = marker.getElement();
        const expectedHTML = `<div style="width:32px;height:32px;background-color:${markerColor};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🚛</div>`;
        if (el.innerHTML !== expectedHTML) {
          el.innerHTML = expectedHTML;
        }
        // Animations removed for simplicity - instant updates instead
        marker.setLngLat([longitude, latitude]);
      } else {
        // Create new marker
        const markerColor = color;
        const el = document.createElement('div');
        el.className = 'truck-marker';
        el.innerHTML = `<div style="width:32px;height:32px;background-color:${markerColor};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🚛</div>`;
        el.style.width = '32px';
        el.style.height = '32px';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map);

        // Add click handler for admin users to open graph
        if (userRole === "admin") {
          marker.on('click', (e) => {
            console.log("🚛 Truck marker clicked for admin:", id);
            handleOpenGraph(id);
            e.originalEvent.stopPropagation();
          });
        }

        truckMarkersRef.current[id] = marker;
      }

      // Get barangay for this location
      const barangay = await getBarangayFromCoordinates(
        Number(latitude),
        Number(longitude)
      );

      // Update list data
      trucksDataRef.current[id] = {
        id,
        collector_id: row.collector_id || id, // Store collector_id for later use
        latitude: Number(latitude),
        longitude: Number(longitude),
        updatedAt:
          row.updated_at || row.inserted_at || new Date().toISOString(),
        driverName: driverInfo.driver || "Driver",
        profileImage: driverInfo.profile_image || null,
        color,
        barangay,
      };
      // Update state to trigger re-render of Active Trucks card
      setTrucks([...Object.values(trucksDataRef.current)]);
    };

    const removeMarker = (row) => {
      const id = row.collector_id || row.truck_id || row.id;
      if (!id) return;
      if (truckMarkersRef.current[id]) {
        truckMarkersRef.current[id].remove();
        delete truckMarkersRef.current[id];
      }
      delete trucksDataRef.current[id];
      // Clean up assigned color when truck is removed
      assignedColorsRef.current.delete(id);
      // Update state to trigger re-render of Active Trucks card
      setTrucks([...Object.values(trucksDataRef.current)]);
    };

    // Initial fetch from Supabase TruckLocation
    (async () => {
      // Calculate the cutoff time for online trucks
      const cutoffTime = new Date();
      cutoffTime.setMinutes(
        cutoffTime.getMinutes() - OFFLINE_THRESHOLD_MINUTES
      );

      let query = supabase
        .from("trucklocation")
        .select("*")
        .order("updated_at", { ascending: false });

      // Always filter for active trucks only
      query = query.eq("status", "active");

      // Filter for trucks updated within the threshold (online trucks only)
      query = query.gte("updated_at", cutoffTime.toISOString());

      // Filter by collector_id if user is a collector
      if (userRole === "collector" && collectorId) {
        query = query.eq("collector_id", collectorId);
        console.log(
          "🔍 Filtering online active trucks for collector:",
          collectorId
        );
      } else if (userRole === "admin") {
        console.log("🔍 Admin user - showing all online active trucks");
        // No additional filtering for admins (beyond active status and online threshold)
      } else {
        console.log("🔍 Unknown user role - showing all online active trucks");
        // Could add filtering logic here if needed
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        console.log(`📍 Loaded ${data.length} online active truck locations`);
        for (const row of data) {
          await upsertMarker(row);
        }
      } else {
        console.error("❌ Error loading truck locations:", error);
      }
    })();

    // Realtime subscription to TruckLocation
    let filterString = "status=eq.active";
    if (userRole === "collector" && collectorId) {
      filterString += `,collector_id=eq.${collectorId}`;
    }

    // Set up real-time subscription with error handling
    const channel = supabase
      .channel(`realtime:trucklocation:${Date.now()}`) // Unique channel name to avoid conflicts
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trucklocation",
          filter: filterString,
        },
        async (payload) => {
          try {
            console.log(
              "📡 Real-time update received:",
              payload.eventType,
              payload.new?.collector_id || payload.old?.collector_id
            );

            if (payload.eventType === "DELETE") {
              removeMarker(payload.old || {});
            } else if (payload.eventType === "UPDATE") {
              const newData = payload.new || {};
              const oldData = payload.old || {};

              // If truck became inactive, remove it
              if (oldData.status === "active" && newData.status !== "active") {
                removeMarker(oldData);
              }
              // If truck is active, upsertMarker will check if it's online and handle accordingly
              else if (newData.status === "active") {
                // upsertMarker will check if truck is online and handle accordingly
                await upsertMarker(newData);
              }
            } else if (payload.eventType === "INSERT") {
              // Only add markers for active trucks that are online
              const newData = payload.new || {};
              if (newData.status === "active") {
                // upsertMarker will check if truck is online and handle accordingly
                await upsertMarker(newData);
              }
            }
          } catch (err) {
            console.error("❌ Error processing real-time update:", err);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time subscription active");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Real-time subscription error");
        } else if (status === "TIMED_OUT") {
          console.warn(
            "⚠️ Real-time subscription timed out, relying on polling"
          );
        } else {
          console.log("📡 Real-time subscription status:", status);
        }
      });

    // Polling fallback to keep updates smooth even if realtime is unavailable
    // Always set up polling as a backup to real-time subscriptions
    const pollingInterval = setInterval(async () => {
      try {
        // Calculate the cutoff time for online trucks
        const cutoffTime = new Date();
        cutoffTime.setMinutes(
          cutoffTime.getMinutes() - OFFLINE_THRESHOLD_MINUTES
        );

        let query = supabase
          .from("trucklocation")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(200)
          .eq("status", "active") // Only poll for active trucks
          .gte("updated_at", cutoffTime.toISOString()); // Only poll for online trucks

        // Filter by collector_id if user is a collector
        if (userRole === "collector" && collectorId) {
          query = query.eq("collector_id", collectorId);
        }

        const { data, error } = await query;
        if (error) {
          console.error("❌ Polling error:", error);
          return;
        }

        if (Array.isArray(data)) {
          // Get all currently tracked truck IDs
          const trackedIds = new Set(Object.keys(truckMarkersRef.current));
          const onlineIds = new Set();

          // Update/add markers for online trucks
          for (const row of data) {
            const id =
              row.collector_id || row.truck_id || row.id || row.location_id;
            if (id) {
              onlineIds.add(String(id));
              await upsertMarker(row);
            }
          }

          // Remove markers for trucks that are now offline
          trackedIds.forEach((id) => {
            if (!onlineIds.has(id)) {
              const truckData = trucksDataRef.current[id];
              if (truckData) {
                removeMarker({ collector_id: id, truck_id: id, id: id });
              }
            }
          });
        }
      } catch (err) {
        console.error("❌ Error in polling interval:", err);
      }
    }, 4000);

    // Store interval ID for cleanup
    pollingRef.current = pollingInterval;

    return () => {
      // Cleanup: remove real-time subscription
      if (channel) {
        supabase.removeChannel(channel);
      }
      // Cleanup: clear polling interval
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const initializeMap = () => {
    if (mapRef.current) return;
    const mapInstance = new maplibregl.Map({
      container: "map",
      style: `https://api.maptiler.com/maps/streets/style.json?key=g3VtfcpqNpVZJtfaXXcB`,
      center: [123.9866, 11.0517], // lng, lat
      zoom: 13,
      pitch: 50,
      bearing: 0,
    });
    // mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.on("load", () => {
      // Add 3D buildings layer
      mapInstance.addLayer({
        'id': '3d-buildings',
        'source': 'maptiler',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.6
        }
      }, 'building');
    });

    setMap(mapInstance);
    mapRef.current = mapInstance;
  };

  // Geocoding functions now handled by services

  // Movement tracking functions now handled by services

  // Fetch graph data immediately when the selected truck changes, and then set up a periodic refresh.
  useEffect(() => {
    let intervalId = null;
    if (showGraphCard && selectedTruckForGraph) {
      console.log(
        "📊 Graph data refresh triggered for truck:",
        selectedTruckForGraph.id
      );
      
      // Fetch data immediately when the effect runs
      fetchTruckMovementData(selectedTruckForGraph.id);

      // Set up an interval for subsequent periodic refreshes
      intervalId = setInterval(() => {
        fetchTruckMovementData(selectedTruckForGraph.id);
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (intervalId) {
        console.log("📊 Clearing graph refresh interval.");
        clearInterval(intervalId);
      }
    };
  }, [showGraphCard, selectedTruckForGraph, fetchTruckMovementData]);

  // Handle opening graph card
  const handleOpenGraph = useCallback(
    (truckId) => {
      console.log("📊 Opening graph for truck:", truckId);
      console.log("📊 Available trucks:", trucks);
      console.log("📊 userRole:", userRole);

      const truck =
        trucks.find((t) => t.id === truckId) || trucksDataRef.current[truckId];
      if (truck) {
        console.log("📊 Found truck data:", truck);
        setSelectedTruckForGraph(truck);
        setShowGraphCard(true);
        fetchTruckMovementData(truckId);

        // Also update viewer's current barangay when opening graph
        // so Location label reflects where the admin is currently located
        updateUserBarangayFromDevice();
      } else {
        console.error("❌ Truck not found for graph:", truckId);
      }
    },
    [trucks, userRole, fetchTruckMovementData, updateUserBarangayFromDevice]
  );

  // Make function globally available for popup buttons
  useEffect(() => {
    window.openTruckGraph = handleOpenGraph;
    return () => {
      delete window.openTruckGraph;
    };
  }, [handleOpenGraph]);

  // Handle fullscreen toggle using native Fullscreen API
  const toggleFullscreen = useCallback(() => {
    const container = document.querySelector(".view-map-container");
    if (!container) return;

    // Check if currently in fullscreen
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isCurrentlyFullscreen) {
      // Enter fullscreen
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }, []);

  // Listen for fullscreen changes to update state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // Listen to all fullscreen change events (different browsers use different events)
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen, toggleFullscreen]);

  // Keep selectedTruckForGraph in sync with the latest data from the trucks array
  useEffect(() => {
    if (showGraphCard && selectedTruckForGraph) {
      const latestTruckData = trucks.find(
        (t) => t.id === selectedTruckForGraph.id
      );
      if (
        latestTruckData &&
        latestTruckData.updatedAt !== selectedTruckForGraph.updatedAt
      ) {
        setSelectedTruckForGraph(latestTruckData);
      }
    }
  }, [trucks, showGraphCard, selectedTruckForGraph]);

  return (
    <div className="view-map-container">
      {userRole !== "admin" && (
        <PageHero
          eyebrow="Live tracking"
          title="Map"
          subtitle="Monitor truck locations in real time and inspect individual routes."
        />
      )}
      <div className="map-container">
        {/* Fullscreen Toggle Button */}
        {userRole === "admin" && (
          <button
            className="map-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        )}

        {/* Active Trucks Card - Top Right */}
        <div
          className={`active-trucks-card ${
            isFullscreen ? "fullscreen-mode" : ""
          }`}
        >
          <div className="active-trucks-header">
            <h3 className="active-trucks-title">Active Trucks</h3>
            <span className="active-trucks-count">{trucks.length}</span>
          </div>
          {trucks.length > 0 ? (
            <div className="active-trucks-list">
              {trucks.map((truck) => (
                <div key={truck.id} className="active-truck-item">
                  <div
                    className="active-truck-color-indicator"
                    style={{ backgroundColor: truck.color }}
                  />
                  <span className="active-truck-name">{truck.driverName}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="active-trucks-empty">
              <p>No active trucks</p>
            </div>
          )}
        </div>

        <div id="map" className="osm-map"></div>
      </div>

      {/* Selected truck details */}
      {selectedTruckId && (
        <div className="map-overlay-info">
          {(() => {
            const t = trucks.find((x) => x.id === selectedTruckId);
            if (!t) return null;
            return (
              <div>
                <div className="map-popup-header">
                  {t.profileImage ? (
                    <img
                      src={t.profileImage}
                      alt="Driver"
                      className="map-popup-driver-image"
                    />
                  ) : (
                    <span role="img" aria-label="truck">
                      🚛
                    </span>
                  )}
                  <strong>{t.driverName}</strong>
                </div>
                <div className="map-popup-coords">
                  <div>
                    <b>Lat:</b> {t.latitude.toFixed(5)}
                  </div>
                  <div>
                    <b>Lng:</b> {t.longitude.toFixed(5)}
                  </div>
                  <div>
                    <b>Last update:</b> {new Date(t.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="map-popup-actions">
                  <button
                    className="detail-btn primary"
                    onClick={() => setSelectedTruckId(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Graph Card Overlay - Only for Admin - Bottom Left Corner */}
      {userRole === "admin" && showGraphCard && selectedTruckForGraph && (
        <div className="map-overlay-graph-card graph-card-bottom-left">
          <div className="graph-card-header">
            <div className="graph-card-header-content">
              <div className="graph-card-driver-section">
                {selectedTruckForGraph.profileImage ? (
                  <img
                    src={selectedTruckForGraph.profileImage}
                    alt={selectedTruckForGraph.driverName}
                    className="graph-card-profile-img"
                  />
                ) : (
                  <div className="graph-card-profile-placeholder">
                    <span className="truck-emoji">🚛</span>
                  </div>
                )}
                <div className="graph-card-driver-info">
                  <h3 className="graph-card-driver-name">
                    {selectedTruckForGraph.driverName}
                  </h3>
                  <p className="graph-card-subtitle">
                    <TrendingUp size={14} className="inline-icon" />
                    Truck Movement Timeline • Last 24 Hours
                  </p>
                </div>
              </div>
              <div className="graph-card-location-section">
                <div className="location-info-item location-info-full">
                  <MapPin size={14} className="location-icon" />
                  <div className="location-content">
                    <span className="location-label">Location</span>
                    <span className="location-value">
                      {userBarangay ||
                        selectedTruckForGraph.barangay ||
                        "Loading..."}
                    </span>
                  </div>
                </div>
                <div className="location-info-item">
                  <Clock size={14} className="location-icon" />
                  <div className="location-content">
                    <span className="location-label">Updated</span>
                    <span className="location-value">
                      {new Date(
                        selectedTruckForGraph.updatedAt
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              className="close-graph-btn"
              onClick={() => {
                setShowGraphCard(false);
                setSelectedTruckForGraph(null);
                setMovementData([]);
                setCollectionsData([]);
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="graph-card-content">
            {movementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={movementData}
                  margin={{ top: 20, right: 40, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

                  <XAxis
                    dataKey="time"
                    stroke="#9aa79f"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />

                  {/* LEFT AXIS — Time Spent */}
                  <YAxis
                    yAxisId="left"
                    stroke="#4B8B3B"
                    label={{
                      value: "Time Spent (minutes)",
                      angle: -90,
                      position: "insideLeft",
                      style: {
                        textAnchor: "middle",
                        fill: "#4B8B3B",
                        fontSize: "12px",
                      },
                    }}
                    tick={{ fontSize: 11 }}
                  />

                  {/* RIGHT AXIS — Distance */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#2196F3"
                    label={{
                      value: "Distance Moved (m)",
                      angle: 90,
                      position: "insideRight",
                      style: { fill: "#2196F3", fontSize: "12px" },
                    }}
                    tick={{ fontSize: 11 }}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e6eee4",
                      borderRadius: 8,
                      boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => {
                      if (name === "collection")
                        return ["Collection Event", ""];

                      if (name === "movement") {
                        if (value === 0 || value < 0.1) {
                          return ["Moving", "Truck in Transit"];
                        }
                        const minutes = Math.floor(value);
                        const seconds = Math.floor((value - minutes) * 60);
                        return [
                          `${minutes}m ${seconds}s`,
                          "Time at Collection Site",
                        ];
                      }

                      if (name === "distance") {
                        // Show one decimal place for distances to see small movements
                        return [
                          `${value.toFixed(1)} meters`,
                          "Distance Moved",
                        ];
                      }

                      return value;
                    }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />

                  {/* Movement line (green) */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="movement"
                    stroke="#4B8B3B"
                    strokeWidth={3}
                    dot={{
                      fill: "#4B8B3B",
                      r: 3,
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{
                      r: 6,
                      stroke: "#4B8B3B",
                      strokeWidth: 2,
                      fill: "#fff",
                    }}
                    connectNulls={false}
                  />

                  {/* NEW: Distance line (blue) */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="distance"
                    stroke="#2196F3"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={true}
                  />

                  {/* Collection event markers */}
                  {collectionsData.map((collection, idx) => {
                    const matchingMovement = movementData.find(
                      (m) =>
                        Math.abs(m.timestamp - collection.timestamp) < 300000
                    );
                    if (matchingMovement) {
                      return (
                        <ReferenceLine
                          key={idx}
                          x={matchingMovement.time}
                          stroke="#e74c3c"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          label={{
                            value: "📦",
                            position: "top",
                            fill: "#e74c3c",
                            fontSize: "14px",
                          }}
                        />
                      );
                    }
                    return null;
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="graph-empty-state">
                <div className="empty-state-content">
                  <TrendingUp size={48} className="empty-state-icon" />
                  <p className="empty-state-text">
                    No movement data available for the last 24 hours
                  </p>
                </div>
              </div>
            )}
            {collectionsData.length > 0 && (
              <div className="collections-summary">
                <h4>Collections Today: {collectionsData.length}</h4>
                <div className="collections-list">
                  {collectionsData.map((collection, idx) => (
                    <div key={idx} className="collection-item">
                      <span className="collection-time">{collection.time}</span>
                      <span className="collection-areas">
                        {Array.isArray(collection.areas)
                          ? collection.areas.join(", ")
                          : collection.areas || "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapTracking;
