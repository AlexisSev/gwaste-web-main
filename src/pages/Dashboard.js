import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import "./Dashboard.css";
import "../App.css";
import { FaCalendarAlt, FaRoute, FaUserTie, FaUsers, FaExclamationCircle, FaTimesCircle } from 'react-icons/fa';

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${ampm}`;
}

function SummaryCard({ icon, label, value, color, darkText }) {
  return (
    <div
      className="dashboard-card"
      style={{
        flex: 1,
        minWidth: 220,
        background: color,
        color: darkText ? '#336A29' : '#fff',
        borderRadius: 18,
        padding: 28,
        boxShadow: '0 2px 8px rgba(51,106,41,0.10)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 0,
        cursor: 'pointer'
      }}
    >
      <div style={{
        background: darkText ? '#fff' : 'rgba(255,255,255,0.15)',
        borderRadius: '50%',
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        fontSize: 24
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>{value}</div>
    </div>
  );
}

const Dashboard = () => {
  const [routes, setRoutes] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "routes"), orderBy("route"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRoutes(data);
    });
    return () => unsub();
  }, []);

  // Summary data
  const totalSchedules = routes.length;
  const uniqueDrivers = new Set(routes.map(r => r.driver)).size;
  // Helper to get unique routes by route number
  const uniqueRoutes = Object.values(
    routes.reduce((acc, route) => {
      if (!acc[route.route]) acc[route.route] = route;
      return acc;
    }, {})
  );
  // For totalCrew, count unique crew members across all uniqueRoutes
  const crewNames = uniqueRoutes.flatMap(r =>
    (r.crew || []).map(member =>
      typeof member === "string"
        ? member.trim()
        : [member.firstName, member.lastName].filter(Boolean).join(" ").trim()
    )
  ).filter(Boolean);
  const totalCrew = new Set(crewNames).size;
  const malataCount = routes.filter(r => r.type === 'Malata').length;
  const diliMalataCount = routes.filter(r => r.type === 'Dili Malata').length;

  return (
    <div style={{ background: '#f7f7f9', minHeight: '100vh', padding: 0 }}>
      <div className="dashboard" style={{ maxWidth: 1400, margin: '0 auto', padding: 32 }}>
        {/* Summary Cards */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
          <SummaryCard icon={<FaCalendarAlt />} label="Total Schedules" value={totalSchedules} color="#336A29" />
          <SummaryCard icon={<FaRoute />} label="Total Routes" value={uniqueRoutes.length} color="#4B8B3B" />
          <SummaryCard icon={<FaUserTie />} label="Total Drivers" value={uniqueDrivers} color="#6CBF47" />
          <SummaryCard icon={<FaUsers />} label="Total Crew" value={totalCrew} color="#A3C76D" darkText />
          <SummaryCard icon={<FaExclamationCircle />} label="Report" value={0} color="#f7b731" darkText />
          <SummaryCard icon={<FaTimesCircle />} label="Missed Pickups" value={0} color="#e74c3c" />
        </div>
        {/* Remove the Waste Type Breakdown card and its logic */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
          {/* Only the schedule table remains here */}
          <div
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 0,
              marginBottom: 24,
              overflow: 'hidden',
              marginTop: 0
            }}
          >
            <div style={{
              fontWeight: 700,
              fontSize: 18,
              color: '#336A29',
              padding: '15px 15px 15px 15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              Schedules
              {routes.length > 6 && (
                <a href="#" style={{ color: '#336A29', fontWeight: 600, fontSize: 15, textDecoration: 'underline' }}>View All</a>
              )}
            </div>
            <div style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 15,
                color: '#222',
                minWidth: 800
              }}>
                <thead>
                  <tr style={{
                    background: '#f7f7d9',
                    color: '#336A29',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Route</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Driver</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Crew</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Barangays</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Time</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Type</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Frequency</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Day Off</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.slice(0, 6).map((route, idx) => (
                    <tr
                      key={route.id}
                      style={{
                        background: idx % 2 === 0 ? '#fafbfa' : '#f3f6f3',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = '#eafbe6')}
                      onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fafbfa' : '#f3f6f3')}
                    >
                      <td style={{ padding: 8 }}>{route.route}</td>
                      <td style={{ padding: 8 }}>{route.driver}</td>
                      <td style={{ padding: 8 }}>{route.crew && route.crew.filter(Boolean).join(' • ')}</td>
                      <td style={{ padding: 8 }}>{route.areas && route.areas.filter(Boolean).join(' • ')}</td>
                      <td style={{ padding: 8 }}>{formatTime12h(route.time)}{route.endTime ? ` - ${formatTime12h(route.endTime)}` : ''}</td>
                      <td style={{ padding: 8 }}>{route.type}</td>
                      <td style={{ padding: 8 }}>{route.frequency}</td>
                      <td style={{ padding: 8 }}>{route.dayOff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
