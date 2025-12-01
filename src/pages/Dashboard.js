import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "./Dashboard.css";
import "../App.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import { FaCalendarAlt, FaRoute, FaUserTie, FaUsers, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart
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

function SummaryCard({ icon, label, value, color = '#336A29' }) {
  return (
    <div className="summary-card" style={{ '--summary-accent': color }}>
      <div className="summary-card__icon">
        {icon}
      </div>
      <div className="summary-card__meta">
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

const Dashboard = ({ onNavigate = () => {} }) => {
  const [routes, setRoutes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let isMounted = true;
    let isCleaningUp = false;

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
          console.log(`📊 Dashboard: Loaded ${data?.length || 0} collections`);
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

    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRoutes(),
        fetchCollections(),
        fetchReports()
      ]);
      if (isMounted) {
        setLoading(false);
      }
    };

    fetchAllData();

    // Set up real-time subscriptions
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
  const resolvedReports = reports.filter(r => r.status === 'resolved').length;
  const totalReportsCount = reports.length;

  const todayIso = new Date().toISOString().split('T')[0];
  const todayCollections = collections.filter(collection => {
    const date = collection.collected_date || collection.created_at?.split('T')[0];
    return date === todayIso;
  }).length;

  const spotlightStats = [
    { label: 'Active routes', value: uniqueRoutes.length, sub: 'Monitored' },
    { label: 'Drivers', value: uniqueDrivers, sub: 'On duty' },
    { label: 'Crew members', value: totalCrew, sub: 'Assigned' },
    { label: 'Collections today', value: todayCollections, sub: 'Logged' },
  ];

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

  // Calculate collections statistics for last 7 days
  const collectionsByDate = getCollectionsByDate();
  const last7DaysTotal = collectionsByDate.reduce((sum, day) => sum + day.collections, 0);
  const averagePerDay = last7DaysTotal > 0 ? (last7DaysTotal / 7).toFixed(1) : 0;
  const peakDay = collectionsByDate.reduce((max, day) => 
    day.collections > max.collections ? day : max, 
    { date: 'N/A', collections: 0 }
  );


  return (
    <div className="dashboard-content">
        <PageHero
          eyebrow="Operations overview"
          title="Dashboard"
          subtitle="Monitor routes, teams, and resident reports in one view."
        />

        <section className="dashboard-summary-grid">
          {loading ? (
            [...Array(6)].map((_, index) => (
              <div key={index} className="summary-card">
                <div className="summary-card__icon">
                  <Skeleton style={{ height: '32px', width: '32px', borderRadius: '8px' }} />
                </div>
                <div className="summary-card__meta">
                  <Skeleton style={{ height: '14px', width: '100px', marginBottom: '8px' }} />
                  <Skeleton style={{ height: '24px', width: '60px' }} />
                </div>
              </div>
            ))
          ) : (
            <>
              <SummaryCard icon={<FaCalendarAlt />} label="Total schedules" value={totalSchedules} color="#71C66B" />
              <SummaryCard icon={<FaRoute />} label="Routes" value={uniqueRoutes.length} color="#52A65E" />
              <SummaryCard icon={<FaUserTie />} label="Drivers" value={uniqueDrivers} color="#3F8F5D" />
              <SummaryCard icon={<FaUsers />} label="Crew members" value={totalCrew} color="#2F6B4A" />
              <SummaryCard icon={<FaCheckCircle />} label="Completed pickups" value={completedPickups} color="#1E9E63" />
              <SummaryCard icon={<FaExclamationCircle />} label="Pending reports" value={pendingReports} color="#E3B341" />
            </>
          )}
        </section>

        <section className="dashboard-panels-grid dashboard-panels-grid--primary">
          <div className="dashboard-panel dashboard-panel--wide">
            <div className="panel-header">
              <div>
                <h3>Collections (last 7 days)</h3>
              </div>
              {/* <button type="button" className="ghost-btn">View report</button> */}
            </div>
            {loading ? (
              <>
                <Skeleton style={{ height: '280px', width: '100%', borderRadius: '8px', marginBottom: '20px' }} />
                <div className="collections-stats">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="stat-item">
                      <Skeleton style={{ height: '16px', width: '16px', borderRadius: '4px' }} />
                      <div className="stat-content">
                        <Skeleton style={{ height: '12px', width: '60px', marginBottom: '8px' }} />
                        <Skeleton style={{ height: '20px', width: '40px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={getCollectionsByDate()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#9aa79f" />
                    <YAxis stroke="#9aa79f" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e6eee4',
                        borderRadius: 12,
                        boxShadow: '0 12px 24px rgba(31,61,42,0.08)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="collections"
                      stroke="#4B8B3B"
                      fill="#7cc66d"
                      fillOpacity={0.35}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                
                {/* Statistics with legends */}
                <div className="collections-stats">
                  <div className="stat-item">
                    <div className="stat-legend" style={{ backgroundColor: '#4B8B3B' }}></div>
                    <div className="stat-content">
                      <span className="stat-label">Total</span>
                      <strong className="stat-value">{last7DaysTotal}</strong>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-legend" style={{ backgroundColor: '#71C66B' }}></div>
                    <div className="stat-content">
                      <span className="stat-label">Today</span>
                      <strong className="stat-value">{todayCollections}</strong>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-legend" style={{ backgroundColor: '#52A65E' }}></div>
                    <div className="stat-content">
                      <span className="stat-label">Avg./day</span>
                      <strong className="stat-value">{averagePerDay}</strong>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-legend" style={{ backgroundColor: '#E3B341' }}></div>
                    <div className="stat-content">
                      <span className="stat-label">Peak</span>
                      <strong className="stat-value">
                        {peakDay.collections > 0 ? `${peakDay.collections} (${peakDay.date})` : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="dashboard-panel dashboard-panel--stacked">
            <div className="panel-header">
              <div>
                <h3>Team highlights</h3>
                <p>Live counters from the field</p>
              </div>
            </div>
            {loading ? (
              <>
                <div className="mini-stats-grid">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="mini-card">
                      <Skeleton style={{ height: '14px', width: '80px', marginBottom: '8px' }} />
                      <Skeleton style={{ height: '24px', width: '40px', marginBottom: '4px' }} />
                      <Skeleton style={{ height: '12px', width: '60px' }} />
                    </div>
                  ))}
                </div>
                <div className="progress-card">
                  {[...Array(2)].map((_, index) => (
                    <div key={index}>
                      <div className="progress-row">
                        <Skeleton style={{ height: '14px', width: '120px' }} />
                        <Skeleton style={{ height: '14px', width: '40px' }} />
                      </div>
                      <Skeleton style={{ height: '8px', width: '100%', borderRadius: '4px', marginBottom: '16px' }} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mini-stats-grid">
                  {spotlightStats.map(item => (
                    <div className="mini-card" key={item.label}>
                      <p>{item.label}</p>
                      <strong>{item.value}</strong>
                      <span>{item.sub}</span>
                    </div>
                  ))}
                </div>
                <div className="progress-card">
                  <div className="progress-row">
                    <div>
                      <p>Resolved reports</p>
                      <small>{resolvedReports} / {totalReportsCount || 0}</small>
                    </div>
                    <span>{totalReportsCount ? Math.round((resolvedReports / totalReportsCount) * 100) : 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${totalReportsCount ? (resolvedReports / totalReportsCount) * 100 : 0}%` }} />
                  </div>
                  <div className="progress-row">
                    <div>
                      <p>Pending reports</p>
                      <small>{pendingReports} items</small>
                    </div>
                    <span>{totalReportsCount ? Math.round((pendingReports / totalReportsCount) * 100) : 0}%</span>
                  </div>
                  <div className="progress-bar muted">
                    <span style={{ width: `${totalReportsCount ? (pendingReports / totalReportsCount) * 100 : 0}%` }} />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>


        <section className="dashboard-table-grid">
          <div className="data-card">
            <div className="data-card__header">
              <div>
                <h3>Schedules</h3>
                <p>Upcoming routes and crews</p>
              </div>
              {routes.length > 6 && (
                <button
                  type="button"
                  className="view-link"
                  onClick={() => onNavigate("Schedule")}
                >
                  View all
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Crew</th>
                    <th>Barangays</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(6)].map((_, index) => (
                      <tr key={index}>
                        <td><Skeleton style={{ height: '20px', width: '40px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '120px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '150px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '180px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '140px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '100px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '100px' }} /></td>
                      </tr>
                    ))
                  ) : (
                    routes.slice(0, 6).map(route => (
                      <tr key={route.id}>
                        <td>{route.route}</td>
                        <td>{route.driver}</td>
                        <td>{route.crew && route.crew.filter(Boolean).join(' • ')}</td>
                        <td>{route.areas && route.areas.filter(Boolean).join(' • ')}</td>
                        <td>{formatTime12h(route.time)}{route.end_time ? ` - ${formatTime12h(route.end_time)}` : ''}</td>
                        <td>{route.type}</td>
                        <td>{route.frequency}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-card">
            <div className="data-card__header">
              <div>
                <h3>Recent completed collections</h3>
                <p>Latest field submissions</p>
              </div>
              {collections.length > 5 && (
                <button
                  type="button"
                  className="view-link"
                  onClick={() => onNavigate("Reports")}
                >
                  View all
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Collector</th>
                    <th>Areas</th>
                    <th>Waste Type</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, index) => (
                      <tr key={index}>
                        <td><Skeleton style={{ height: '20px', width: '120px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '150px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '100px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '100px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '80px' }} /></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {collections.slice(0, 5).map(collection => (
                        <tr key={collection.id}>
                          <td>{collection.collector_name || 'Unknown'}</td>
                          <td>
                            {Array.isArray(collection.areas_collected)
                              ? collection.areas_collected.slice(0, 2).join(', ') +
                                (collection.areas_collected.length > 2 ? '...' : '')
                              : collection.areas_collected || 'N/A'}
                          </td>
                          <td>{collection.waste_type || 'N/A'}</td>
                          <td>
                            {collection.collected_date
                              ? new Date(collection.collected_date).toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td>
                            {collection.collected_at
                              ? new Date(collection.collected_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {collections.length === 0 && (
                        <tr>
                          <td colSpan="5" className="empty-row">No completed collections yet</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-card">
            <div className="data-card__header">
              <div>
                <h3>Recent reports</h3>
                <p>Community submissions</p>
              </div>
              {reports.length > 5 && (
                <button
                  type="button"
                  className="view-link"
                  onClick={() => onNavigate("Reports")}
                >
                  View all
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, index) => (
                      <tr key={index}>
                        <td><Skeleton style={{ height: '20px', width: '200px' }} /></td>
                        <td><Skeleton style={{ height: '24px', width: '80px', borderRadius: '12px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '150px' }} /></td>
                        <td><Skeleton style={{ height: '20px', width: '100px' }} /></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {reports.slice(0, 5).map(report => (
                        <tr key={report.id}>
                          <td className="truncate">{report.description || 'No description'}</td>
                          <td>
                            <span className={`status-pill ${report.status === 'resolved' ? 'resolved' : 'pending'}`}>
                              {report.status || 'pending'}
                            </span>
                          </td>
                          <td>{report.location || report.address || 'N/A'}</td>
                          <td>
                            {report.created_at
                              ? new Date(report.created_at).toLocaleDateString()
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {reports.length === 0 && (
                        <tr>
                          <td colSpan="4" className="empty-row">No reports yet</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
    </div>
  );
};

export default Dashboard;