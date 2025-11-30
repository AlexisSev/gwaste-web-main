import React, { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  ReferenceLine
} from 'recharts';
import { X, MapPin, Clock, TrendingUp, Maximize2, Minimize2 } from 'lucide-react';

// Fix for Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  // iconRetinaUrl: require("leaflet/dist/images/  marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Helper function to check if a string is a valid UUID
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  const markerAnimationsRef = useRef({});
  const pollingRef = useRef(null);
  const [showGraphCard, setShowGraphCard] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [collectionsData, setCollectionsData] = useState([]);
  const [selectedTruckForGraph, setSelectedTruckForGraph] = useState(null);
  const [barangayCache, setBarangayCache] = useState({}); // Cache barangay lookups
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Threshold for considering a truck offline (in minutes)
  const OFFLINE_THRESHOLD_MINUTES = 5;

  // Helper function to check if a truck is online (updated within threshold)
  const isTruckOnline = (updatedAt) => {
    if (!updatedAt) return false;
    const updatedTime = new Date(updatedAt).getTime();
    const now = Date.now();
    const thresholdMs = OFFLINE_THRESHOLD_MINUTES * 60 * 1000;
    return (now - updatedTime) <= thresholdMs;
  };

  // Deterministic color per truck id
  const getColorForId = (id) => {
    const palette = [
      "#e74c3c", // red
      "#f39c12", // orange
      "#27ae60", // green
      "#2980b9", // blue
      "#8e44ad", // purple
      "#16a085", // teal
      "#d35400", // dark orange
      "#2c3e50", // navy
      "#c0392b", // dark red
      "#7f8c8d", // gray
    ];
    const s = String(id);
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
  };

  useEffect(() => {
    initializeMap();
  }, []);

  // Clear existing data when collector changes
  useEffect(() => {
    // Clear existing markers and data when collector changes
    Object.values(truckMarkersRef.current).forEach(marker => {
      if (map) map.removeLayer(marker);
    });
    truckMarkersRef.current = {};
    driverCacheRef.current = {};
    trucksDataRef.current = {};
    setTrucks([]);
    setSelectedTruckId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorId]);

  useEffect(() => {
    console.log('🗺️ MapTracking userRole:', userRole);
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
      const color = getColorForId(id);

      // Fetch driver info from Supabase collectors if not cached
      let driverInfo = driverCacheRef.current[id];
      if (!driverInfo) {
        try {
          // Try to match by collector_id first (handles custom ID formats)
          let query = supabase
            .from("collectors")
            .select("driver, firstName, lastName, profile_image, collector_id, id, status")
            .eq("collector_id", id)
            .eq("status", "active") // Only get active collectors
            .limit(1);

          let { data, error } = await query.single();

          // If no match and id looks like a UUID, try matching by id column
          if (error && isValidUUID(id)) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("collectors")
              .select("driver, firstName, lastName, profile_image, collector_id, id, status")
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
            const name = data.driver || [data.firstName, data.lastName].filter(Boolean).join(" ") || "Driver";
            driverInfo = { driver: name, profile_image: data.profile_image || null };
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
        const marker = truckMarkersRef.current[id];
        // Ensure icon color is up to date
        marker.setIcon(
          L.divIcon({
            className: "truck-marker",
            html: `<div style="width:32px;height:32px;background-color:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">🚛</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })
        );
        const from = marker.getLatLng();
        const to = L.latLng(coords[0], coords[1]);
        const durationMs = 600;
        const startTs = performance.now();
        if (markerAnimationsRef.current[id]) {
          cancelAnimationFrame(markerAnimationsRef.current[id]);
        }
        const step = (nowTs) => {
          const t = Math.min(1, (nowTs - startTs) / durationMs);
          const lat = from.lat + (to.lat - from.lat) * t;
          const lng = from.lng + (to.lng - from.lng) * t;
          marker.setLatLng([lat, lng]);
          if (t < 1) {
            markerAnimationsRef.current[id] = requestAnimationFrame(step);
          }
        };
        markerAnimationsRef.current[id] = requestAnimationFrame(step);
        // const driverDisplayName = driverInfo.driver || (trucksDataRef.current[id] && trucksDataRef.current[id].driverName) || "Driver";
        // const popupHtml = `
        //   <div style="text-align:center;min-width:160px">
        //     ${
        //       driverInfo.profile_image
        //         ? `<img src="${driverInfo.profile_image}" alt="${driverDisplayName}" style="width:48px;height:48px;border-radius:50%;margin-bottom:6px"/>`
        //         : ""
        //     }
        //     <h4 style="margin:4px 0">${driverDisplayName}</h4>
        //   </div>`;
        // marker.setPopupContent(popupHtml);
        
        // Add click handler to existing marker for admin users to open graph (only if not already added)
        if (userRole === 'admin' && !marker._graphHandlerAdded) {
          marker.off('click'); // Remove any existing click handlers
          marker.on('click', (e) => {
            console.log('🚛 Existing truck marker clicked for admin:', id);
            handleOpenGraph(id);
            // Prevent default popup behavior
            e.originalEvent.stopPropagation();
          });
          marker._graphHandlerAdded = true;
        }
      } else {
        const truckIcon = L.divIcon({
          className: "truck-marker",
          html: `<div style="width:32px;height:32px;background-color:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">🚛</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker(coords, { icon: truckIcon }).addTo(map);
        // const driverDisplayName2 = driverInfo.driver || (trucksDataRef.current[id] && trucksDataRef.current[id].driverName) || "Driver";
        // const popupHtml = `
        //   <div style="text-align:center;min-width:160px">
        //     ${
        //       driverInfo.profile_image
       // ? `<img src="${driverInfo.profile_image}" alt="${driverDisplayName2}" style="width:48px;height:48px;border-radius:50%;margin-bottom:6px"/>`
        //         : "🚛"
        //     }
        //     <h4 style="margin:4px 0">${driverDisplayName2}</h4>
        //   </div>`;
        // marker.bindPopup(popupHtml);
        
        // Add click handler to marker for admin users to open graph
        if (userRole === 'admin') {
          marker.on('click', (e) => {
            console.log('🚛 Truck marker clicked for admin:', id);
            handleOpenGraph(id);
            // Prevent default popup behavior
            e.originalEvent.stopPropagation();
          });
          marker._graphHandlerAdded = true;
        }
        
        truckMarkersRef.current[id] = marker;
      }

      // Get barangay for this location
      const barangay = await getBarangayFromCoordinates(Number(latitude), Number(longitude));

      // Update list data
      trucksDataRef.current[id] = {
        id,
        collector_id: row.collector_id || id, // Store collector_id for later use
        latitude: Number(latitude),
        longitude: Number(longitude),
        updatedAt: row.updated_at || row.inserted_at || new Date().toISOString(),
        driverName: driverInfo.driver || "Driver",
        profileImage: driverInfo.profile_image || null,
        color,
        barangay,
      };
      setTrucks(Object.values(trucksDataRef.current));
    };

    const removeMarker = (row) => {
      const id = row.collector_id || row.truck_id || row.id;
      if (!id) return;
      if (truckMarkersRef.current[id]) {
        map.removeLayer(truckMarkersRef.current[id]);
        delete truckMarkersRef.current[id];
      }
      delete trucksDataRef.current[id];
      setTrucks(Object.values(trucksDataRef.current));
    };

    // Initial fetch from Supabase TruckLocation
    (async () => {
      // Calculate the cutoff time for online trucks
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - OFFLINE_THRESHOLD_MINUTES);
      
      let query = supabase
        .from("trucklocation")
        .select("*")
        .order("updated_at", { ascending: false });

      // Always filter for active trucks only
      query = query.eq("status", "active");
      
      // Filter for trucks updated within the threshold (online trucks only)
      query = query.gte("updated_at", cutoffTime.toISOString());

      // Filter by collector_id if user is a collector
      if (userRole === 'collector' && collectorId) {
        query = query.eq("collector_id", collectorId);
        console.log('🔍 Filtering online active trucks for collector:', collectorId);
      } else if (userRole === 'admin') {
        console.log('🔍 Admin user - showing all online active trucks');
        // No additional filtering for admins (beyond active status and online threshold)
      } else {
        console.log('🔍 Unknown user role - showing all online active trucks');
        // Could add filtering logic here if needed
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        console.log(`📍 Loaded ${data.length} online active truck locations`);
        for (const row of data) {
          await upsertMarker(row);
        }
      } else {
        console.error('❌ Error loading truck locations:', error);
      }
    })();

    // Realtime subscription to TruckLocation
    let filterString = "status=eq.active";
    if (userRole === 'collector' && collectorId) {
      filterString += `,collector_id=eq.${collectorId}`;
    }

    const channel = supabase
      .channel("realtime:trucklocation")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trucklocation",
          filter: filterString
        },
        async (payload) => {
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
        }
      )
      .subscribe();

    // Polling fallback to keep updates smooth even if realtime is unavailable
    if (!pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        // Calculate the cutoff time for online trucks
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - OFFLINE_THRESHOLD_MINUTES);
        
        let query = supabase
          .from("trucklocation")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(200)
          .eq("status", "active") // Only poll for active trucks
          .gte("updated_at", cutoffTime.toISOString()); // Only poll for online trucks

        // Filter by collector_id if user is a collector
        if (userRole === 'collector' && collectorId) {
          query = query.eq("collector_id", collectorId);
        }

        const { data } = await query;
        if (Array.isArray(data)) {
          // Get all currently tracked truck IDs
          const trackedIds = new Set(Object.keys(truckMarkersRef.current));
          const onlineIds = new Set();
          
          // Update/add markers for online trucks
          for (const row of data) {
            const id = row.collector_id || row.truck_id || row.id || row.location_id;
            if (id) {
              onlineIds.add(id);
              await upsertMarker(row);
            }
          }
          
          // Remove markers for trucks that are now offline
          trackedIds.forEach(id => {
            if (!onlineIds.has(id)) {
              const truckData = trucksDataRef.current[id];
              if (truckData) {
                removeMarker({ collector_id: id, truck_id: id, id: id });
              }
            }
          });
        }
      }, 4000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const initializeMap = () => {
    if (mapRef.current) return;
    const mapInstance = L.map("map", {
      zoomControl: false, // Remove default zoom controls
      attributionControl: false, // Remove Leaflet attribution badge
    }).setView([11.0517, 123.9866], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '', // Empty attribution
    }).addTo(mapInstance);
    setMap(mapInstance);
    mapRef.current = mapInstance;
  };

  // Reverse geocode coordinates to get barangay
  const getBarangayFromCoordinates = async (latitude, longitude) => {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    
    // Check cache first
    if (barangayCache[cacheKey]) {
      return barangayCache[cacheKey];
    }

    try {
      // Use Nominatim (OpenStreetMap's geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'GWaste-Web-App' // Required by Nominatim
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      
      // Extract barangay from address components
      let barangay = 'Unknown Location';
      
      if (data.address) {
        // Try different possible field names for barangay
        barangay = data.address.village || 
                   data.address.suburb || 
                   data.address.neighbourhood ||
                   data.address.city_district ||
                   data.address.town ||
                   data.address.city ||
                   'Unknown Location';
      }

      // Cache the result
      setBarangayCache(prev => ({ ...prev, [cacheKey]: barangay }));
      
      return barangay;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return 'Unknown Location';
    }
  };

  // Fetch movement data and collections for a specific truck
  const fetchTruckMovementData = useCallback(async (truckId) => {
    if (!truckId) return;

    try {
      // Get the truck data from trucksDataRef to avoid dependency on trucks state
      const truck = trucksDataRef.current[truckId];
      if (!truck) {
        console.warn('Truck not found in trucksDataRef:', truckId);
        return;
      }

      // Get collector_id from truck data (already stored in trucksDataRef)
      let collectorId = truck.collector_id || truckId;
      
      // If we don't have collector_id, try to find it from trucklocation table
      if (!truck.collector_id) {
        // Build query - properly quote string values to avoid UUID parsing errors
        const { data: truckLocationData, error: locationError } = await supabase
          .from("trucklocation")
          .select("collector_id, location_id")
          .eq("status", "active")
          .or(`collector_id.eq."${truckId}",location_id.eq."${truckId}"`)
          .limit(1);
        
        if (!locationError && truckLocationData && truckLocationData.length > 0) {
          collectorId = truckLocationData[0].collector_id || truckId;
        }
      }
      
      if (!collectorId) {
        console.error("Could not determine collector_id for truck:", truckId);
        return;
      }

      // Fetch truck location history (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: movementHistory, error: movementError } = await supabase
        .from("trucklocation")
        .select("latitude, longitude, updated_at")
        .eq("collector_id", collectorId)
        .gte("updated_at", yesterday.toISOString())
        .order("updated_at", { ascending: true });

      if (movementError) {
        console.error("Error fetching movement history:", movementError);
      } else {
        // Process movement data for chart
        // Calculate time spent at each location (spikes when stopped, low when moving)
        const processedMovement = [];
        const STOPPED_THRESHOLD_METERS = 50; // Consider truck stopped if within 50 meters
        
        // Helper function to calculate distance between two coordinates (Haversine formula)
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
          const R = 6371000; // Earth's radius in meters
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c; // Distance in meters
        };

        if (movementHistory && movementHistory.length > 0) {
          let currentStopLocation = null;
          let accumulatedStopTime = 0; // in milliseconds

          movementHistory.forEach((point, index) => {
            const time = new Date(point.updated_at);
            const timestamp = time.getTime();
            
            if (index === 0) {
              // First point - initialize
              currentStopLocation = { lat: point.latitude, lon: point.longitude };
              processedMovement.push({
                time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                timestamp: timestamp,
                movement: 0, // Start at 0 (moving/low)
                latitude: point.latitude,
                longitude: point.longitude,
              });
            } else {
              const prevPoint = movementHistory[index - 1];
              const distance = calculateDistance(
                prevPoint.latitude,
                prevPoint.longitude,
                point.latitude,
                point.longitude
              );
              
              const timeDiff = timestamp - new Date(prevPoint.updated_at).getTime(); // milliseconds
              
              if (distance < STOPPED_THRESHOLD_METERS) {
                // Truck is stopped (at collection site)
                if (currentStopLocation) {
                  // Check if still at the same stop location
                  const stopDistance = calculateDistance(
                    currentStopLocation.lat,
                    currentStopLocation.lon,
                    point.latitude,
                    point.longitude
                  );
                  
                  if (stopDistance < STOPPED_THRESHOLD_METERS) {
                    // Still at same stop - accumulate time
                    accumulatedStopTime += timeDiff;
                  } else {
                    // Moved to a new stop location
                    currentStopLocation = { lat: point.latitude, lon: point.longitude };
                    accumulatedStopTime = timeDiff;
                  }
                } else {
                  // Starting a new stop
                  currentStopLocation = { lat: point.latitude, lon: point.longitude };
                  accumulatedStopTime = timeDiff;
                }
                
                // Convert accumulated time to minutes for display
                const timeSpentMinutes = accumulatedStopTime / (1000 * 60);
                processedMovement.push({
                  time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: timestamp,
                  movement: Math.max(timeSpentMinutes, 0.1), // Spike showing time spent (minimum 0.1 for visibility)
                  latitude: point.latitude,
                  longitude: point.longitude,
                });
              } else {
                // Truck is moving
                currentStopLocation = null;
                accumulatedStopTime = 0;
                processedMovement.push({
                  time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  timestamp: timestamp,
                  movement: 0, // Low value when moving
                  latitude: point.latitude,
                  longitude: point.longitude,
                });
              }
            }
          });
        }
        
        setMovementData(processedMovement);
      }

      // Fetch collections for this collector (last 24 hours)
      const { data: collections, error: collectionsError } = await supabase
        .from("collections")
        .select("collected_at, areas_collected, waste_type")
        .eq("collector_name", truck.driverName)
        .gte("collected_at", yesterday.toISOString())
        .order("collected_at", { ascending: true });

      if (collectionsError) {
        console.error("Error fetching collections:", collectionsError);
      } else {
        // Process collections data
        const processedCollections = (collections || []).map(collection => ({
          timestamp: new Date(collection.collected_at).getTime(),
          time: new Date(collection.collected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          areas: collection.areas_collected || [],
          wasteType: collection.waste_type || 'Unknown',
        }));
        setCollectionsData(processedCollections);
      }
    } catch (error) {
      console.error("Error fetching truck movement data:", error);
    }
  }, []); // Empty deps: uses refs and setState functions which are stable

  // Handle opening graph card
  const handleOpenGraph = useCallback((truckId) => {
    console.log('📊 Opening graph for truck:', truckId);
    console.log('📊 Available trucks:', trucks);
    console.log('📊 userRole:', userRole);

    const truck = trucks.find(t => t.id === truckId) || trucksDataRef.current[truckId];
    if (truck) {
      console.log('📊 Found truck data:', truck);
      setSelectedTruckForGraph(truck);
      setShowGraphCard(true);
      fetchTruckMovementData(truckId);
    } else {
      console.error('❌ Truck not found for graph:', truckId);
    }
  }, [trucks, userRole, fetchTruckMovementData]);

  // Make function globally available for popup buttons
  useEffect(() => {
    window.openTruckGraph = handleOpenGraph;
    return () => {
      delete window.openTruckGraph;
    };
  }, [handleOpenGraph]);

  // Handle fullscreen toggle using native Fullscreen API
  const toggleFullscreen = useCallback(() => {
    const container = document.querySelector('.view-map-container');
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
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen, toggleFullscreen]);

  return (
    <div className="view-map-container">
      {userRole !== 'admin' && (
        <PageHero
          eyebrow="Live tracking"
          title="Map"
          subtitle="Monitor truck locations in real time and inspect individual routes."
        />
      )}
      <div className="map-container">
        {/* Fullscreen Toggle Button */}
        {userRole === 'admin' && (
          <button
            className="map-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (ESC)" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        )}
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
                    <img src={t.profileImage} alt="Driver" className="map-popup-driver-image" />
                  ) : (
                    <span role="img" aria-label="truck">🚛</span>
                  )}
                  <strong>{t.driverName}</strong>
                </div>
                <div className="map-popup-coords">
                  <div><b>Lat:</b> {t.latitude.toFixed(5)}</div>
                  <div><b>Lng:</b> {t.longitude.toFixed(5)}</div>
                  <div><b>Last update:</b> {new Date(t.updatedAt).toLocaleString()}</div>
                </div>
                <div className="map-popup-actions">
                  <button className="detail-btn primary" onClick={() => {
                    const marker = truckMarkersRef.current[t.id];
                    if (marker) marker.openPopup();
                  }}>Open Popup</button>
                  <button className="detail-btn secondary" onClick={() => setSelectedTruckId(null)}>Close</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Graph Card Overlay - Only for Admin - Bottom Left Corner */}
      {userRole === 'admin' && showGraphCard && selectedTruckForGraph && (
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
                  <h3 className="graph-card-driver-name">{selectedTruckForGraph.driverName}</h3>
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
                    <span className="location-value">{selectedTruckForGraph.barangay || 'Loading...'}</span>
                  </div>
                </div>
                <div className="location-info-item">
                  <Clock size={14} className="location-icon" />
                  <div className="location-content">
                    <span className="location-label">Updated</span>
                    <span className="location-value">{new Date(selectedTruckForGraph.updatedAt).toLocaleTimeString()}</span>
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
                <LineChart data={movementData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="time"
                    stroke="#9aa79f"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#9aa79f"
                    label={{ value: 'Time Spent (minutes)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9aa79f', fontSize: '12px' } }}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e6eee4',
                      borderRadius: 8,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      fontSize: '12px'
                    }}
                    formatter={(value, name) => {
                      if (name === 'collection') return ['Collection Event', ''];
                      if (value === 0 || value < 0.1) {
                        return ['Moving', 'Truck in Transit'];
                      }
                      const minutes = Math.floor(value);
                      const seconds = Math.floor((value - minutes) * 60);
                      return [`${minutes}m ${seconds}s`, 'Time at Collection Site'];
                    }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="movement"
                    stroke="#4B8B3B"
                    strokeWidth={3}
                    dot={{ fill: '#4B8B3B', r: 3, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, stroke: '#4B8B3B', strokeWidth: 2, fill: '#fff' }}
                    connectNulls={false}
                  />
                  {/* Mark collection events with vertical lines */}
                  {collectionsData.map((collection, idx) => {
                    const matchingMovement = movementData.find(
                      m => Math.abs(m.timestamp - collection.timestamp) < 300000 // 5 minutes
                    );
                    if (matchingMovement) {
                      return (
                        <ReferenceLine
                          key={idx}
                          x={matchingMovement.time}
                          stroke="#e74c3c"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          label={{ value: '📦', position: 'top', fill: '#e74c3c', fontSize: '14px' }}
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
                  <p className="empty-state-text">No movement data available for the last 24 hours</p>
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
                          ? collection.areas.join(', ') 
                          : collection.areas || 'N/A'}
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