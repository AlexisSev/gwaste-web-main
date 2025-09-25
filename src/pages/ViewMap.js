import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../supabaseClient";
import "./ViewMap.css";

// Fix for Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  // iconRetinaUrl: require("leaflet/dist/images/  marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const ViewMap = () => {
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);
  const truckMarkersRef = useRef({});
  const driverCacheRef = useRef({}); // Cache driver data by collector_id
  const trucksDataRef = useRef({}); // Latest trucks data keyed by id
  const [trucks, setTrucks] = useState([]); // all trucks for list view
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const markerAnimationsRef = useRef({});
  const pollingRef = useRef(null);

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

  useEffect(() => {
    if (!map) return;

    const upsertMarker = async (row) => {
      // Use collector_id as the stable identifier for marker and color
      const id = row.collector_id || row.truck_id || row.id || row.location_id;
      const latitude = row.latitude ?? row.lat;
      const longitude = row.longitude ?? row.lng;
      if (latitude == null || longitude == null || id == null) return;
      const coords = [latitude, longitude];
      const color = getColorForId(id);

      // Fetch driver info from Supabase collectors if not cached
      let driverInfo = driverCacheRef.current[id];
      if (!driverInfo) {
        try {
          const { data, error } = await supabase
            .from("collectors")
            .select("driver, firstName, lastName, profile_image, collector_ID, id")
            .or(`collector_ID.eq.${id},id.eq.${id}`)
            .limit(1)
            .single();
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
        const driverDisplayName = driverInfo.driver || (trucksDataRef.current[id] && trucksDataRef.current[id].driverName) || "Driver";
        const popupHtml = `
          <div style="text-align:center;min-width:160px">
            ${
              driverInfo.profile_image
                ? `<img src="${driverInfo.profile_image}" alt="${driverDisplayName}" style="width:48px;height:48px;border-radius:50%;margin-bottom:6px"/>`
                : ""
            }
            <h4 style="margin:4px 0">${driverDisplayName}</h4>
            <p style="margin:0;font-size:13px"><b>Lat:</b> ${Number(latitude).toFixed(5)}, <b>Lng:</b> ${Number(longitude).toFixed(5)}</p>
            <p style="margin:0;font-size:12px;color:#666">Last update: ${new Date(row.updated_at || row.inserted_at || Date.now()).toLocaleTimeString()}</p>
          </div>`;
        marker.setPopupContent(popupHtml);
      } else {
        const truckIcon = L.divIcon({
          className: "truck-marker",
          html: `<div style="width:32px;height:32px;background-color:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">🚛</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker(coords, { icon: truckIcon }).addTo(map);
        const driverDisplayName2 = driverInfo.driver || (trucksDataRef.current[id] && trucksDataRef.current[id].driverName) || "Driver";
        const popupHtml = `
          <div style="text-align:center;min-width:160px">
            ${
              driverInfo.profile_image
                ? `<img src="${driverInfo.profile_image}" alt="${driverDisplayName2}" style="width:48px;height:48px;border-radius:50%;margin-bottom:6px"/>`
                : "🚛"
            }
            <h4 style="margin:4px 0">${driverDisplayName2}</h4>
            <p style="margin:0;font-size:13px"><b>Lat:</b> ${Number(latitude).toFixed(5)}, <b>Lng:</b> ${Number(longitude).toFixed(5)}</p>
            <p style="margin:0;font-size:12px;color:#666">Last update: ${new Date(row.updated_at || row.inserted_at || Date.now()).toLocaleTimeString()}</p>
          </div>`;
        marker.bindPopup(popupHtml);
        truckMarkersRef.current[id] = marker;
      }

      // Update list data
      trucksDataRef.current[id] = {
        id,
        latitude: Number(latitude),
        longitude: Number(longitude),
        updatedAt: row.updated_at || row.inserted_at || new Date().toISOString(),
        driverName: driverInfo.driver || "Driver",
        profileImage: driverInfo.profile_image || null,
        color,
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
      const { data, error } = await supabase
        .from("TruckLocation")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          await upsertMarker(row);
        }
      }
    })();

    // Realtime subscription to TruckLocation
    const channel = supabase
      .channel("realtime:trucklocation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "TruckLocation" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            removeMarker(payload.old || {});
          } else {
            await upsertMarker(payload.new || {});
          }
        }
      )
      .subscribe();

    // Polling fallback to keep updates smooth even if realtime is unavailable
    if (!pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const { data } = await supabase
          .from("TruckLocation")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(200);
        if (Array.isArray(data)) {
          for (const row of data) {
            await upsertMarker(row);
          }
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
  }, [map]);

  const initializeMap = () => {
    if (mapRef.current) return;
    const mapInstance = L.map("map").setView([11.0517, 123.9866], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapInstance);
    setMap(mapInstance);
    mapRef.current = mapInstance;
  };

  return (
    <div className="view-map-container">
      <div className="map-container">
        <div id="map" className="osm-map"></div>
      </div>

      {/* Trucks overlay list */}
      <div className="map-overlay-legend trucks-overlay" style={{ pointerEvents: 'auto' }}>
        <h4>Trucks</h4>
        <div className="legend-items">
          {trucks.map((t) => (
            <div
              key={t.id}
              className="legend-item truck-item"
              onClick={() => {
                setSelectedTruckId(t.id);
                const marker = truckMarkersRef.current[t.id];
                if (marker) {
                  map.panTo([t.latitude, t.longitude]);
                  marker.openPopup();
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="legend-color" style={{ background: t.color || '#28a745' }}></div>
              <span className="truck-name">{t.driverName}</span>
            </div>
          ))}
          {trucks.length === 0 && <div className="legend-item empty"><span>No trucks online</span></div>}
        </div>
      </div>

      {/* Selected truck details */}
      {selectedTruckId && (
        <div className="map-overlay-info">
          {(() => {
            const t = trucks.find((x) => x.id === selectedTruckId);
            if (!t) return null;
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {t.profileImage ? (
                    <img src={t.profileImage} alt="Driver" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  ) : (
                    <span role="img" aria-label="truck">🚛</span>
                  )}
                  <strong>{t.driverName}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#333' }}>
                  <div><b>Lat:</b> {t.latitude.toFixed(5)}</div>
                  <div><b>Lng:</b> {t.longitude.toFixed(5)}</div>
                  <div><b>Last update:</b> {new Date(t.updatedAt).toLocaleString()}</div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
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
    </div>
  );
};

export default ViewMap;
