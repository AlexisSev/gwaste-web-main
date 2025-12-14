/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import "./ResidentIssues.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import {
  fetchReportsData,
  fetchResidentsData,
  createResidentsLookup,
  setupReportsSubscription,
  cleanupReportsSubscription,
  updateReportStatus
} from "../services/residentIssueService";
import {
  formatReportTimestamp,
  getReportAddress,
  getReportImages,
  getReportResidentName,
  filterReports,
  getStatusUpdateMessage
} from "../utils/residentIssueUtils";

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
    let subscriptionChannel = null;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch reports and residents data
        const [reportsResult, residentsResult] = await Promise.all([
          fetchReportsData(),
          fetchResidentsData()
        ]);

        if (reportsResult.error) {
          console.error("Error fetching reports:", reportsResult.error);
        }
        if (residentsResult.error) {
          console.error("Error fetching residents:", residentsResult.error);
        }

        if (isMounted) {
          setReports(reportsResult.data || []);
          setResidents(createResidentsLookup(residentsResult.data));
        }
      } catch (err) {
        console.error("Unexpected error fetching data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Setup realtime subscription for reports
    subscriptionChannel = setupReportsSubscription(
      () => {
        // Refetch data when reports change
        fetchData();
      },
      (channel) => {
        subscriptionChannel = channel;
      }
    );

    return () => {
      isMounted = false;
      if (subscriptionChannel) {
        cleanupReportsSubscription(subscriptionChannel);
      }
    };
  }, []);

  const filteredReports = filterReports(reports, activeTab, search);

  const handleToggleStatus = async (report) => {
    try {
      const result = await updateReportStatus(report);

      if (result.success) {
        if (result.wasResolved) {
          setSuccessMessage(getStatusUpdateMessage(result.wasResolved));
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setSuccessMessage(null);
          }, 3000);
        }
      } else {
        console.error("Error updating report status:", result.error);
        // Could add error notification here if needed
      }
    } catch (err) {
      console.error("Unexpected error in handleToggleStatus:", err);
    }
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
                    <td>{getReportResidentName(report, residents)}</td>
                    <td>{getReportAddress(report, residents)}</td>
                    <td>{formatReportTimestamp(report.created_at || report.timestamp)}</td>
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
                <span className="modal-value">{getReportResidentName(detailsModal.report, residents)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Description</span>
                <span className="modal-value">{detailsModal.report.description || "N/A"}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Address</span>
                <span className="modal-value">{getReportAddress(detailsModal.report, residents)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Status</span>
                <span className={`modal-status-badge ${detailsModal.report.status}`}>
                  {detailsModal.report.status.charAt(0).toUpperCase() + detailsModal.report.status.slice(1)}
                </span>
              </div>
              <div className="modal-detail-item">
                <span className="modal-label">Timestamp</span>
                <span className="modal-value">{formatReportTimestamp(detailsModal.report.created_at || detailsModal.report.timestamp)}</span>
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
