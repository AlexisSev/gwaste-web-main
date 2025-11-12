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
    const reportsQuery = query(collection(db, "reports"), orderBy("status"));
    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setReports(data);
      setLoading(false);
    });

    const residentsQuery = collection(db, "residents");
    const unsubResidents = onSnapshot(residentsQuery, (snapshot) => {
      const data = {};
      snapshot.docs.forEach((doc) => {
        data[doc.id] = doc.data();
      });
      setResidents(data);
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
    if (report.address) return report.address;
    if (report.locationAddress) return report.locationAddress;
    if (report.streetAddress) return report.streetAddress;
    const loc = report.location;
    return loc ? `${loc.latitude?.toFixed(5)}, ${loc.longitude?.toFixed(5)}` : "N/A";
  };

  const getResidentName = (report) => {
    const ids = [report.userId, report.uid, report.residentId, report.submittedBy];
    for (const id of ids) {
      if (id && residents[id]) {
        return residents[id].fullName || `${residents[id].firstName || ""} ${residents[id].lastName || ""}`.trim();
      }
    }
    return report.username || report.user || report.residentName || report.fullName || "Anonymous";
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Resident Reports</h1>
        <div className="reports-tab-toggle">
          <button
            className={activeTab === "pending" ? "active" : ""}
            onClick={() => setActiveTab("pending")}
          >
            Pending
          </button>
          <button
            className={activeTab === "resolved" ? "active" : ""}
            onClick={() => setActiveTab("resolved")}
          >
            Resolved
          </button>
        </div>
      </div>

      <div className="reports-toolbar">
        <input
          type="text"
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="reports-grid">
        {loading ? (
          <p className="reports-empty">Loading reports...</p>
        ) : filteredReports.length === 0 ? (
          <p className="reports-empty">No {activeTab} reports found.</p>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="report-card">
              {report.images?.length > 0 && (
                <img
                  src={report.images[0]}
                  alt="Report"
                  className="report-thumbnail"
                />
              )}

              <div className="report-details">
                <h3>{report.description || "No description"}</h3>
                <p><strong>Resident:</strong> {getResidentName(report)}</p>
                <p><strong>Address:</strong> {getAddress(report)}</p>
                <p><strong>Time:</strong> {formatTimestamp(report.submittedAt?.seconds ? report.submittedAt.seconds * 1000 : report.timestamp)}</p>
              </div>

              <div className="report-actions">
                <button
                  className="view-btn"
                  onClick={() => setDetailsModal({ open: true, report })}
                >
                  View Details
                </button>
                <button
                  className={`status-btn ${report.status}`}
                  onClick={() => handleToggleStatus(report)}
                >
                  Mark as {report.status === "resolved" ? "Pending" : "Resolved"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {detailsModal.open && (
        <div className="modal-overlay" onClick={() => setDetailsModal({ open: false, report: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Report Details</h2>
            <p><strong>Resident:</strong> {getResidentName(detailsModal.report)}</p>
            <p><strong>Description:</strong> {detailsModal.report.description || "N/A"}</p>
            <p><strong>Address:</strong> {getAddress(detailsModal.report)}</p>
            <p><strong>Status:</strong> {detailsModal.report.status}</p>
            <p><strong>Timestamp:</strong> {formatTimestamp(detailsModal.report.timestamp)}</p>
            {detailsModal.report.images?.length > 0 && (
              <div className="modal-images">
                {detailsModal.report.images.map((img, idx) => (
                  <img key={idx} src={img} alt="Report" />
                ))}
              </div>
            )}
            <button className="close-btn" onClick={() => setDetailsModal({ open: false, report: null })}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
