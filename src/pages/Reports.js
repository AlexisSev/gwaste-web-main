import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy
} from "firebase/firestore";
import "./Reports.css";

const Reports = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [reports, setReports] = useState([]);
  const [residents, setResidents] = useState({});
  const [detailsModal, setDetailsModal] = useState({ open: false, report: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch reports
    const reportsQuery = query(collection(db, "reports"), orderBy("status"));
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      setLoading(false);
    });

    // Fetch residents
    const residentsQuery = collection(db, "residents");
    const unsubResidents = onSnapshot(residentsQuery, (snapshot) => {
      const residentsData = {};
      snapshot.docs.forEach((doc) => {
        residentsData[doc.id] = doc.data();
      });
      setResidents(residentsData);
    });

    return () => {
      unsubReports();
      unsubResidents();
    };
  }, []);

  const filteredReports = reports.filter(
    (report) =>
      report.status === activeTab &&
      ((report.description || "").toLowerCase().includes(search.toLowerCase()) || !search)
  );

  const handleToggleStatus = async (report) => {
    const newStatus = report.status === "resolved" ? "pending" : "resolved";
    await updateDoc(doc(db, "reports", report.id), { status: newStatus });
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getAddress = (report) => {
    // First try to get a readable address from the report
    if (report.address) return report.address;
    if (report.locationAddress) return report.locationAddress;
    if (report.streetAddress) return report.streetAddress;
    
    // If no readable address, show coordinates as fallback
    const location = report.location;
    if (!location || !location.latitude || !location.longitude) return "N/A";
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  };

  const getResidentName = (report) => {
    // Debug: log the report data to see what fields are available
    console.log('Report data:', report);
    console.log('Residents data:', residents);
    
    // Try multiple possible user ID fields
    const possibleUserIds = [report.userId, report.uid, report.residentId, report.submittedBy];
    
    for (const userId of possibleUserIds) {
      if (userId && residents[userId]) {
        console.log('Found resident:', residents[userId]);
        return residents[userId].fullName || `${residents[userId].firstName || ''} ${residents[userId].lastName || ''}`.trim();
      }
    }
    
    // Fallback to direct name fields in report
    return report.username || report.user || report.residentName || report.fullName || "Anonymous";
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>Issues</h1>
        <div className="reports-status-toggle">
          <span
            className={activeTab === "pending" ? "active" : "inactive"}
            onClick={() => setActiveTab("pending")}
          >
            ● pending
          </span>
          <span> • </span>
          <span
            className={activeTab === "resolved" ? "active" : "inactive"}
            onClick={() => setActiveTab("resolved")}
          >
            ● resolved
          </span>
        </div>
      </div>
      <div className="reports-actions">
        <input
          className="reports-search"
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="reports-grid">
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', width: '100%' }}>Loading...</div>
        ) : filteredReports.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', width: '100%' }}>No issues found.</div>
        ) : filteredReports.map((report) => (
          <div className="report-card" key={report.id}>
            <span className={`report-status-badge ${report.status}`}>● {report.status}</span>
            {report.images && report.images.length > 0 && (
              <div className="report-image">
                <img src={report.images[0]} alt="Report" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }} />
              </div>
            )}
            <div className="report-info">
              <div className="report-resident"><strong>Reported by:</strong> {getResidentName(report)}</div>
              <div className="report-description"><strong>Description:</strong> {report.description || "N/A"}</div>
              <div className="report-address"><strong>Address:</strong> {getAddress(report)}</div>
              <div className="report-timestamp"><strong>Time:</strong> {formatTimestamp(report.submittedAt?.seconds ? report.submittedAt.seconds * 1000 : report.timestamp)}</div>
            </div>
            <div className="report-view-details" onClick={() => setDetailsModal({ open: true, report })}>View Details</div>
            <div className="report-view-details" style={{ color: '#4b8b3b', fontWeight: 500, cursor: 'pointer', marginTop: 8 }} onClick={() => handleToggleStatus(report)}>
              Mark as {report.status === 'resolved' ? 'Pending' : 'Resolved'}
            </div>
          </div>
        ))}
      </div>
      {detailsModal.open && detailsModal.report && (
        <div className="collector-modal-bg">
          <div className="collector-modal">
            <h2>Report Details</h2>
            <div style={{ marginBottom: 16 }}>
              <b>Reported by:</b> {getResidentName(detailsModal.report)}<br />
              <b>Description:</b> {detailsModal.report.description || "N/A"}<br />
              <b>Address:</b> {getAddress(detailsModal.report)}<br />
              <b>Status:</b> {detailsModal.report.status}<br />
              <b>Timestamp:</b> {formatTimestamp(detailsModal.report.submittedAt?.seconds ? detailsModal.report.submittedAt.seconds * 1000 : detailsModal.report.timestamp)}<br />
              {detailsModal.report.images && detailsModal.report.images.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <b>Images:</b><br />
                  {detailsModal.report.images.map((image, index) => (
                    <img key={index} src={image} alt={`Report ${index + 1}`} style={{ width: '200px', height: '150px', objectFit: 'cover', margin: '5px', borderRadius: '4px' }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setDetailsModal({ open: false, report: null })}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 