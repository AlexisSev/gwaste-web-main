import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./Dashboard.css";
import "../App.css";
import { FaCalendarAlt, FaRoute, FaUserTie, FaUsers, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';

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
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="dashboard-card"
      style={{
        flex: 1,
        minWidth: 280,
        background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)`,
        color: darkText ? '#336A29' : '#fff',
        borderRadius: 20,
        padding: 32,
        boxShadow: isHovered
          ? '0 12px 32px rgba(51,106,41,0.25), 0 8px 16px rgba(51,106,41,0.15)'
          : '0 4px 16px rgba(51,106,41,0.12), 0 2px 8px rgba(51,106,41,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 0,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: isHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        border: `1px solid ${color}33`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)`,
        transform: isHovered ? 'translateX(100%)' : 'translateX(-100%)',
        transition: 'transform 0.6s ease',
        pointerEvents: 'none'
      }} />

      {/* Floating particles effect */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: 4,
        height: 4,
        background: 'rgba(255,255,255,0.6)',
        borderRadius: '50%',
        animation: isHovered ? 'float 3s ease-in-out infinite' : 'none',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }} />
      <div style={{
        position: 'absolute',
        top: '60%',
        right: '25%',
        width: 3,
        height: 3,
        background: 'rgba(255,255,255,0.4)',
        borderRadius: '50%',
        animation: isHovered ? 'float 4s ease-in-out infinite reverse' : 'none',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }} />

      <div style={{
        background: darkText
          ? 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.15) 100%)',
        borderRadius: '50%',
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        fontSize: 28,
        boxShadow: isHovered
          ? '0 8px 24px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.1)'
          : '0 4px 12px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.05)',
        transition: 'all 0.3s ease',
        transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
        border: `2px solid ${darkText ? 'rgba(51,106,41,0.2)' : 'rgba(255,255,255,0.3)'}`
      }}>
        {icon}
      </div>

      <div style={{
        fontSize: 16,
        fontWeight: 600,
        opacity: 0.9,
        marginBottom: 8,
        letterSpacing: '0.5px',
        textAlign: 'center'
      }}>
        {label}
      </div>

      <div style={{
        fontSize: 36,
        fontWeight: 900,
        marginTop: 4,
        textShadow: darkText ? 'none' : '0 2px 4px rgba(0,0,0,0.3)',
        letterSpacing: '-0.5px'
      }}>
        {value}
      </div>

      {/* Animated border effect */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${color}AA, ${color}FF, ${color}AA)`,
        transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'center',
        transition: 'transform 0.4s ease',
        borderRadius: '0 0 20px 20px'
      }} />
    </div>
  );
}

const Dashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [reports, setReports] = useState([]);
  useEffect(() => {
    let isMounted = true;

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

        if (isMounted) {
          setRoutes(data || []);
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
      }
    };

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

        if (isMounted) {
          setCollections(data || []);
        }
      } catch (err) {
        console.error("Error fetching collections:", err);
      }
    };

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

        if (isMounted) {
          setReports(data || []);
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
    };

    fetchRoutes();
    fetchCollections();
    fetchReports();

    // Set up real-time subscriptions
    const routesChannel = supabase
      .channel("routes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routes" },
        () => fetchRoutes()
      )
      .subscribe();

    const collectionsChannel = supabase
      .channel("collections-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        () => fetchCollections()
      )
      .subscribe();

    const reportsChannel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => fetchReports()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(routesChannel);
      supabase.removeChannel(collectionsChannel);
      supabase.removeChannel(reportsChannel);
    };
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

  // Calculate completed pickups (total collections)
  const completedPickups = collections.length;

  // Calculate reports statistics
  const pendingReports = reports.filter(r => r.status === 'pending').length;

  // Analytics data processing
  const getCollectionsByDate = () => {
    const last7Days = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days[dateStr] = 0;
    }

    collections.forEach(collection => {
      const date = collection.collected_date || collection.created_at?.split('T')[0];
      if (date && last7Days.hasOwnProperty(date)) {
        last7Days[date]++;
      }
    });

    return Object.entries(last7Days).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      collections: count
    }));
  };

  const getReportsByStatus = () => {
    const statusCounts = reports.reduce((acc, report) => {
      const status = report.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: status === 'resolved' ? '#28a745' : status === 'pending' ? '#ffc107' : '#6c757d'
    }));
  };

  const getWasteTypesDistribution = () => {
    const wasteCounts = collections.reduce((acc, collection) => {
      const type = collection.waste_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const colors = ['#336A29', '#4B8B3B', '#6CBF47', '#A3C76D', '#e74c3c', '#f39c12'];
    return Object.entries(wasteCounts).map(([type, count], index) => ({
      name: type,
      value: count,
      color: colors[index % colors.length]
    }));
  };

  const getCollectionsByHour = () => {
    const hourCounts = {};
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }

    collections.forEach(collection => {
      const date = collection.collected_at || collection.created_at;
      if (date) {
        const hour = new Date(date).getHours();
        hourCounts[hour]++;
      }
    });

    return Object.entries(hourCounts).map(([hour, count]) => ({
      hour: `${hour}:00`,
      collections: count
    }));
  };

  return (
    <div style={{ background: '#f7f7f9', minHeight: '100vh', padding: 0 }}>
      <div className="dashboard" style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: 32,
        animation: 'fadeInUp 0.8s ease-out'
      }}>
        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 32,
          animation: 'slideInLeft 0.6s ease-out 0.2s both'
        }}>
          <SummaryCard icon={<FaCalendarAlt />} label="Total Schedules" value={totalSchedules} color="#336A29" />
          <SummaryCard icon={<FaRoute />} label="Total Routes" value={uniqueRoutes.length} color="#4B8B3B" />
          <SummaryCard icon={<FaUserTie />} label="Total Drivers" value={uniqueDrivers} color="#6CBF47" />
          <SummaryCard icon={<FaUsers />} label="Total Crew" value={totalCrew} color="#A3C76D" darkText />
          <SummaryCard icon={<FaCheckCircle />} label="Completed Pickups" value={completedPickups} color="#28a745" />
          <SummaryCard icon={<FaExclamationCircle />} label="Pending Reports" value={pendingReports} color="#f39c12" darkText />
        </div>

        {/* Analytics Charts Section */}
        <div style={{
          marginBottom: 32,
          animation: 'slideInRight 0.6s ease-out 0.4s both'
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#336A29',
            marginBottom: 20,
            textAlign: 'center'
          }}>
            📊 Analytics Overview
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 24,
            marginBottom: 24
          }}>
            {/* Collections Over Time */}
            <div style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 24,
              minHeight: 300
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#336A29',
                marginBottom: 16,
                textAlign: 'center'
              }}>
                Collections (Last 7 Days)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={getCollectionsByDate()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collections"
                    stroke="#336A29"
                    fill="#336A29"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Reports Status Distribution */}
            <div style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 24,
              minHeight: 300
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#336A29',
                marginBottom: 16,
                textAlign: 'center'
              }}>
                Reports Status
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={getReportsByStatus()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getReportsByStatus().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 24
          }}>
            {/* Waste Types Distribution */}
            <div style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 24,
              minHeight: 300
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#336A29',
                marginBottom: 16,
                textAlign: 'center'
              }}>
                Waste Types Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={getWasteTypesDistribution()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#666" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="value" fill="#336A29" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Collections by Hour */}
            <div style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 24,
              minHeight: 300
            }}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#336A29',
                marginBottom: 16,
                textAlign: 'center'
              }}>
                Collections by Hour
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={getCollectionsByHour()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="collections"
                    stroke="#4B8B3B"
                    strokeWidth={3}
                    dot={{ fill: '#4B8B3B', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#4B8B3B', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Dashboard Tables Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 24,
          marginBottom: 32,
          animation: 'slideInUp 0.6s ease-out 0.6s both'
        }}>
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
                <button 
                  style={{ 
                    color: '#336A29', 
                    fontWeight: 600, 
                    fontSize: 15, 
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => window.location.href = '/schedule'}
                >
                  View All
                </button>
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
                      <td style={{ padding: 8 }}>{formatTime12h(route.time)}{route.end_time ? ` - ${formatTime12h(route.end_time)}` : ''}</td>
                      <td style={{ padding: 8 }}>{route.type}</td>
                      <td style={{ padding: 8 }}>{route.frequency}</td>
                      <td style={{ padding: 8 }}>{route.dayoff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Completed Collections Section */}
          <div
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 0,
              marginBottom: 24,
              overflow: 'hidden',
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
              Recent Completed Collections
              {collections.length > 5 && (
                <button
                  style={{
                    color: '#336A29',
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => window.location.href = '/reports'}
                >
                  View All
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 14,
                color: '#222',
                minWidth: 600
              }}>
                <thead>
                  <tr style={{
                    background: '#f7f7d9',
                    color: '#336A29',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Collector</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Areas</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Waste Type</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Date</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.slice(0, 5).map((collection, idx) => (
                    <tr
                      key={collection.id}
                      style={{
                        background: idx % 2 === 0 ? '#fafbfa' : '#f3f6f3',
                        transition: 'background 0.2s',
                      }}
                    >
                      <td style={{ padding: 10, fontWeight: 500 }}>
                        {collection.collector_name || 'Unknown'}
                      </td>
                      <td style={{ padding: 10 }}>
                        {Array.isArray(collection.areas_collected)
                          ? collection.areas_collected.slice(0, 2).join(', ') +
                            (collection.areas_collected.length > 2 ? '...' : '')
                          : collection.areas_collected || 'N/A'
                        }
                      </td>
                      <td style={{ padding: 10 }}>{collection.waste_type || 'N/A'}</td>
                      <td style={{ padding: 10 }}>
                        {collection.collected_date
                          ? new Date(collection.collected_date).toLocaleDateString()
                          : 'N/A'
                        }
                      </td>
                      <td style={{ padding: 10 }}>
                        {collection.collected_at
                          ? new Date(collection.collected_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                  {collections.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#666',
                        fontSize: 16
                      }}>
                        No completed collections yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Reports Section */}
          <div
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 2px 8px rgba(51,106,41,0.07)',
              padding: 0,
              marginBottom: 24,
              overflow: 'hidden',
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
              Recent Reports
              {reports.length > 5 && (
                <button
                  style={{
                    color: '#336A29',
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => window.location.href = '/reports'}
                >
                  View All
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 14,
                color: '#222',
                minWidth: 600
              }}>
                <thead>
                  <tr style={{
                    background: '#f7f7d9',
                    color: '#336A29',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Description</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Status</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Location</th>
                    <th style={{ padding: 10, borderBottom: '2px solid #e0e0e0' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 5).map((report, idx) => (
                    <tr
                      key={report.id}
                      style={{
                        background: idx % 2 === 0 ? '#fafbfa' : '#f3f6f3',
                        transition: 'background 0.2s',
                      }}
                    >
                      <td style={{ padding: 10, maxWidth: 200 }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {report.description || 'No description'}
                        </div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: report.status === 'resolved' ? '#d4edda' : '#fff3cd',
                          color: report.status === 'resolved' ? '#155724' : '#856404'
                        }}>
                          {report.status || 'pending'}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>
                        {report.location || report.address || 'N/A'}
                      </td>
                      <td style={{ padding: 10 }}>
                        {report.created_at
                          ? new Date(report.created_at).toLocaleDateString()
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#666',
                        fontSize: 16
                      }}>
                        No reports yet
                      </td>
                    </tr>
                  )}
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
