/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./ResidentIssues.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";

const ResidentIssues = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [reports, setReports] = useState([]);
  const [residents, setResidents] = useState({});
  const [detailsModal, setDetailsModal] = useState({ open: false, report: null });
  const [imageModal, setImageModal] = useState({ open: false, image: null });
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
      try {
        setLoading(true);
        const searchParams = new URLSearchParams();
        if (activeTab !== 'all') searchParams.set('status', activeTab);
        if (search) searchParams.set('search', search);

        const queryString = searchParams.toString();
        const url = queryString ? `get-reports?${queryString}` : 'get-reports';

        const { data, error } = await supabase.functions.invoke(url);

        if (error) {
          console.error("Error fetching reports:", error);
        } else if (data?.success && isMounted) {
          setReports(data.data || []);
          // Create residents map from processed data
          const residentsMap = {};
          (data.data || []).forEach(report => {
            if (report.residentId) {
              residentsMap[report.residentId] = { id: report.residentId };
            }
          });
          setResidents(residentsMap);
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReports();

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
  }, [activeTab, search]);

  const filteredReports = reports.filter(
    (report) =>
      report.status === activeTab &&
      ((report.description || "").toLowerCase().includes(search.toLowerCase()) || !search)
  );

  const handleToggleStatus = async (report) => {
    const newStatus = report.status === "resolved" ? "pending" : "resolved";
    try {
      const { data, error } = await supabase.functions.invoke('update-report-status', {
        body: { id: report.id, status: newStatus }
      });

      if (error) {
        console.error("Error updating report status:", error);
      } else if (data?.success) {
        // Show success message when marking as resolved
        if (newStatus === "resolved") {
          setSuccessMessage("Report marked as resolved successfully!");
          // Auto-hide after 3 seconds
          setTimeout(() => {
            setSuccessMessage(null);
          }, 3000);
        }
      } else {
        console.error("Failed to update report status:", data?.error);
      }
    } catch (err) {
      console.error("Error updating report status:", err);
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
      {/* Success Toast Notification */}
      {successMessage && (
        <div className="success-toast">
          <div className="success-toast-content">
            <span className="success-icon">✓</span>
            <span className="success-message">{successMessage}</span>
            <button 
              className="success-toast-close" 
              onClick={() => setSuccessMessage(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <PageHero
        eyebrow="Community issues"
        title="Resident Reports"
        subtitle="Track pending and resolved submissions from residents."
      />

      {/* Search Bar */}
      <div className="reports-toolbar">
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="reports-actions-right">
          <div className="reports-tabs-container">
            <button
              type="button"
              className={`reports-tab ${activeTab === "pending" ? "pending" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending
            </button>
            <button
              type="button"
              className={`reports-tab ${activeTab === "resolved" ? "resolved" : ""}`}
              onClick={() => setActiveTab("resolved")}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      <div className="reports-table-container">
        {loading ? (
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
                {[...Array(5)].map((_, index) => (
                  <tr key={index}>
                    <td>
                      <Skeleton style={{ height: '24px', width: '80px', borderRadius: '20px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '60px', width: '60px', borderRadius: '6px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '16px', width: '200px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '16px', width: '120px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '16px', width: '150px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '16px', width: '140px' }} />
                    </td>
                    <td>
                      <div className="report-actions" style={{ padding: 0 }}>
                        <Skeleton style={{ height: '32px', width: '100px', borderRadius: '6px' }} />
                        <Skeleton style={{ height: '32px', width: '120px', borderRadius: '6px' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                      <div className="report-img-wrapper">
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
                        {report.status === "pending" && (
                          <button
                            className={`status-btn ${report.status}`}
                            onClick={() => handleToggleStatus(report)}
                          >
                            ✓ Mark Resolved
                          </button>
                        )}
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
          <div className="modal-shadcn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Report Details</h2>
              <button 
                className="modal-close-btn" 
                onClick={() => setDetailsModal({ open: false, report: null })}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="modal-detail-item">
                <span className="modal-label">Resident</span>
                <span className="modal-value">{getResidentName(detailsModal.report)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Description</span>
                <span className="modal-value">{detailsModal.report.description || "N/A"}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Address</span>
                <span className="modal-value">{getAddress(detailsModal.report)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Status</span>
                <span className={`modal-status-badge ${detailsModal.report.status}`}>
                  {detailsModal.report.status.charAt(0).toUpperCase() + detailsModal.report.status.slice(1)}
                </span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Timestamp</span>
                <span className="modal-value">{formatTimestamp(detailsModal.report.created_at || detailsModal.report.timestamp)}</span>
              </div>
              {getReportImages(detailsModal.report).length > 0 && (
                <div className="modal-images-section">
                  <span className="modal-label">Images</span>
                  <div className="modal-images">
                    {getReportImages(detailsModal.report).map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt="Report" 
                        className="modal-image-clickable"
                        onClick={() => setImageModal({ open: true, image: img })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="modal-close-button" 
                onClick={() => setDetailsModal({ open: false, report: null })}
              >
                Close
              </button>
            </div>
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

export default ResidentIssues;
