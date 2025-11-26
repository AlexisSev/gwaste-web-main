/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Reports.css";
import PageHero from "../components/PageHero";

const Reports = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [reports, setReports] = useState([]);
  const [residents, setResidents] = useState({});
  const [detailsModal, setDetailsModal] = useState({ open: false, report: null });
  const [imageModal, setImageModal] = useState({ open: false, image: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      try {
        setLoading(true);
        const { data: reportsData, error: reportsError } = await supabase
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false });

        if (reportsError) {
          console.error("Error fetching reports:", reportsError);
        } else if (isMounted) {
          setReports(reportsData || []);
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchResidents = async () => {
      try {
        const { data: residentsData, error: residentsError } = await supabase
          .from("residents")
          .select("*");
        if (residentsError) {
          console.error("Error fetching residents:", residentsError);
        } else if (isMounted) {
          const map = {};
          (residentsData || []).forEach((r) => {
            map[r.id] = r;
          });
          setResidents(map);
        }
      } catch (err) {
        console.error("Error fetching residents:", err);
      }
    };

    fetchReports();
    fetchResidents();

    // Realtime subscription to reports table changes
    const channel = supabase
      .channel("reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        (payload) => {
          // Simple approach: refetch on any change
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const filteredReports = reports.filter(
    (report) =>
      report.status === activeTab &&
      ((report.description || "").toLowerCase().includes(search.toLowerCase()) || !search)
  );

  const handleToggleStatus = async (report) => {
    const newStatus = report.status === "resolved" ? "pending" : "resolved";
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) console.error("Error updating report status:", error);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getAddress = (report) => {
    if (!report) return "Not specified";

    // First try to get address from residents table if we have a resident ID
    const residentId = report.resident_id || report.residentId || report.userId || report.uid || report.submittedBy;
    if (residentId && residents[residentId]) {
      const resident = residents[residentId];
      // Use correct field name from database schema
      const residentAddress = resident.resident_address;
      if (residentAddress && typeof residentAddress === 'string' && residentAddress.trim()) {
        const trimmed = residentAddress.trim();
        return trimmed.length > 50 ? trimmed.substring(0, 47) + "..." : trimmed;
      }
    }

    // Try various address fields from the report
    const address = report.location || report.address || report.location_address || report.resident_address;

    if (address && typeof address === 'string' && address.trim()) {
      // Limit address length for table display
      const trimmed = address.trim();
      return trimmed.length > 50 ? trimmed.substring(0, 47) + "..." : trimmed;
    }

    return "Not specified";
  };

  const getReportImages = (report) => {
    if (!report) return [];

    // Check for different possible image field names and formats
    let images = [];

    // Check for images_base64 field (your actual database field)
    if (report.images_base64) {
      if (Array.isArray(report.images_base64)) {
        images = report.images_base64;
      } else if (typeof report.images_base64 === 'string') {
        images = [report.images_base64];
      } else if (typeof report.images_base64 === 'object') {
        // Handle JSONB object format
        const base64Data = report.images_base64;
        if (base64Data.images && Array.isArray(base64Data.images)) {
          images = base64Data.images;
        } else if (base64Data.image) {
          images = [base64Data.image];
        } else if (base64Data.data) {
          images = [base64Data.data];
        }
      }
    }
    // Check if images field exists as array
    else if (report.images && Array.isArray(report.images)) {
      images = report.images;
    }
    // Check if image field exists as array
    else if (report.image && Array.isArray(report.image)) {
      images = report.image;
    }
    // Check if images field exists as single string
    else if (report.images && typeof report.images === 'string') {
      images = [report.images];
    }
    // Check if image field exists as single string
    else if (report.image && typeof report.image === 'string') {
      images = [report.image];
    }
    // Check for photo field
    else if (report.photo && typeof report.photo === 'string') {
      images = [report.photo];
    }
    // Check for picture field
    else if (report.picture && typeof report.picture === 'string') {
      images = [report.picture];
    }
    // Check for photo_url field
    else if (report.photo_url && typeof report.photo_url === 'string') {
      images = [report.photo_url];
    }
    // Check for image_url field
    else if (report.image_url && typeof report.image_url === 'string') {
      images = [report.image_url];
    }
    // Check for base64 images (data:image/...)
    else if (report.image_base64 && typeof report.image_base64 === 'string') {
      images = [report.image_base64];
    }

    // Filter out empty/null values and validate URLs/base64
    const filteredImages = images.filter(img => {
      if (!img || typeof img !== 'string') return false;
      const trimmed = img.trim();
      if (!trimmed) return false;

      // Check if it's a valid URL, base64 data, or relative path
      return trimmed.startsWith('http') || trimmed.startsWith('data:image/') || trimmed.startsWith('/');
    });

    // Debug logging (remove this after confirming it works)
    if (filteredImages.length === 0 && images.length > 0) {
      console.log('Report images found but filtered out:', report.id, images);
    }

    return filteredImages;
  };

  const getResidentName = (report) => {
    if (!report) return "Anonymous";

    // First try to get from residents table using various ID fields
    const id = report.resident_id || report.residentId || report.userId || report.uid || report.submittedBy;
    if (id && residents[id]) {
      const r = residents[id];
      // Use correct field names from database schema
      const fullName = r.full_name || `${r.first_name || ""} ${r.last_name || ""}`.trim();
      if (fullName && fullName.trim()) return fullName.trim();
      if (r.name) return r.name;
      if (r.email) return r.email;
    }


    // Fallback to report fields
    const residentName = report.resident_name || report.residentName || report.username || report.user;
    if (residentName) return residentName;

    // Last resort - try to extract from description or use Anonymous
    return report.submitted_by || "Anonymous";
  };

  return (
    <div className="reports-page">
      <PageHero
        eyebrow="Community issues"
        title="Resident Reports"
        subtitle="Track pending and resolved submissions from residents."
        action={
          <div className="reports-tab-toggle">
            <span
              className={activeTab === "pending" ? "active" : "inactive"}
              onClick={() => setActiveTab("pending")}
            >
              ● pending
            </span>
            <span> • </span>
            <span
              className={activeTab === "resolved" ? "inactive active" : "inactive"}
              onClick={() => setActiveTab("resolved")}
            >
              ● resolved
            </span>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="reports-toolbar">
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="reports-table-container">
        {loading ? (
          <div className="reports-loading">Loading reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="reports-empty">No {activeTab} issues found.</div>
        ) : (
          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Image</th>
                  <th>Description</th>
                  <th>Resident</th>
                  <th>Address</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <span className={`report-status-badge ${report.status}`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div
                        className="report-img-wrapper"
                        onClick={() => getReportImages(report).length > 0 && setImageModal({ open: true, image: getReportImages(report)[0] })}
                      >
                        {getReportImages(report).length > 0 ? (
                          <img src={getReportImages(report)[0]} alt="Report" className="report-img" />
                        ) : (
                          <div className="report-img placeholder">No Image</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="report-description">
                        {report.description || "No description"}
                      </div>
                    </td>
                    <td>{getResidentName(report)}</td>
                    <td>{getAddress(report)}</td>
                    <td>{formatTimestamp(report.created_at || report.timestamp)}</td>
                    <td>
                      <div className="report-actions">
                        <button
                          className="report-view-details"
                          onClick={() => setDetailsModal({ open: true, report })}
                        >
                          View Details
                        </button>
                        <button
                          className={`status-btn ${report.status}`}
                          onClick={() => handleToggleStatus(report)}
                        >
                          {report.status === "resolved" ? "⏳ Mark Pending" : "✓ Mark Resolved"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <p><strong>Timestamp:</strong> {formatTimestamp(detailsModal.report.created_at || detailsModal.report.timestamp)}</p>
            {getReportImages(detailsModal.report).length > 0 && (
              <div className="modal-images">
                {getReportImages(detailsModal.report).map((img, idx) => (
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

      {/* Image Modal */}
      {imageModal.open && (
        <div className="modal-overlay" onClick={() => setImageModal({ open: false, image: null })}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-modal-close"
              onClick={() => setImageModal({ open: false, image: null })}
            >
              ×
            </button>
            <img src={imageModal.image} alt="Report" className="image-modal-content" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
