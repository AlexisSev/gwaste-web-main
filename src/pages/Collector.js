/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaCamera, FaEdit, FaEye, FaEyeSlash, FaEnvelope, FaPhone } from 'react-icons/fa';
import "./Collector.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import {
  validateNewCollector,
  validateCollectorUpdate,
  fetchCollectorsForConflictCheck,
  fetchRoutesForCollectorConflictCheck
} from "../services/collectorConflictService";
import {
  processCollectorFormData,
  processCollectorUpdateData,
  formatCollectorName,
  resolveCollectorImage,
  formatCollectorDate,
  validateCollectorForm,
  isCollectorFormValid,
  getCollectorSuccessMessage,
  getCollectorSuccessContent
} from "../utils/collectorDataUtils";
import defaultProfileImage from "../Cooked.jpg";
import { createNewCollector, updateExistingCollector } from "../services/collectorSubmissionService";

const Collector = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [collectors, setCollectors] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    collector: null,
  });
  const [editModal, setEditModal] = useState({ open: false, collector: null });
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    contact: "",
    password: "",
    crew: [{ firstName: "", lastName: "" }],
  });
  const [formErrors, setFormErrors] = useState({});
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editSuccessModalOpen, setEditSuccessModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Load collectors from Supabase
  useEffect(() => {
    let ignore = false;
    const fetchCollectors = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("collectors")
        .select("*")
        .order("driver", { ascending: true });
      if (!error && !ignore) {
        setCollectors(data || []);
      }
      if (!ignore) {
        setLoading(false);
      }
    }
    fetchCollectors();
    // Optionally, you can use Supabase Realtime for live updates
    const channel = supabase
      .channel('collectors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collectors' }, payload => {
        fetchCollectors();
      })
      .subscribe();
    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCollectors = (collectors || []).filter(
    (collector) =>
      collector.status === activeTab &&
      (collector.driver?.toLowerCase().includes(search.toLowerCase()) ||
        !search)
  );

  // Only show drivers in the main grid
  const drivers = (filteredCollectors || []).filter((c) => c.driver);

  // Add Collector Modal logic
  const openAddModal = () => {
    setForm({ firstName: "", lastName: "", contact: "", password: "", crew: [{ firstName: "", lastName: "" }] });
    setFormErrors({});
    setAddModalOpen(true);
  };
  const closeAddModal = () => {
    setAddModalOpen(false);
    setForm({ firstName: "", lastName: "", contact: "", password: "", crew: [{ firstName: "", lastName: "" }] });
    setFormErrors({});
  };
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleCrewChange = (idx, field, value) => {
    setForm((prev) => {
      const crew = [...prev.crew];
      crew[idx][field] = value;
      return { ...prev, crew };
    });
  };
  const addCrewField = () => {
    setForm((prev) => ({ ...prev, crew: [...prev.crew, { firstName: "", lastName: "" }] }));
  };
  const removeCrewField = (idx) => {
    setForm((prev) => {
      const crew = [...prev.crew];
      crew.splice(idx, 1);
      return { ...prev, crew };
    });
  };
  const handleAddCollector = async (e) => {
    e.preventDefault();
    setAddLoading(true);

    // Basic form validation
    const errors = validateCollectorForm(form);
    if (!isCollectorFormValid(errors)) {
      setFormErrors(errors);
      setAddLoading(false);
      return;
    }

    try {
      // Fetch data for conflict checking
      const { data: latestCollectors } = await fetchCollectorsForConflictCheck();
      const { data: allRoutes } = await fetchRoutesForCollectorConflictCheck();

      if (!latestCollectors || !allRoutes) {
        setFormErrors({ submit: "Error fetching data for validation" });
        setAddLoading(false);
        return;
      }

      // Check for conflicts and duplicates
      const conflicts = validateNewCollector(form, latestCollectors, allRoutes);
      if (conflicts.length > 0) {
        // Set the first conflict as an error
        const primaryConflict = conflicts[0];
        setFormErrors({ [primaryConflict.type]: primaryConflict.message });
        setAddLoading(false);
        return;
      }

      // Process and submit the collector
      const processedData = processCollectorFormData(form);
      const result = await createNewCollector(processedData);

      if (!result.success) {
        setFormErrors({ submit: `Error adding collector: ${result.error.message || JSON.stringify(result.error)}` });
      } else {
        // Success
        setSuccessModalOpen(true);
        closeAddModal();
      }
    } catch (err) {
      setFormErrors({ submit: `Error adding collector: ${err.message || JSON.stringify(err)}` });
    }

    setAddLoading(false);
  };

  return (
    <div className="collector-mgmt-container">
      <PageHero
        eyebrow="Collections team"
        title="Collectors"
        subtitle="Manage driver profiles, crews, and route assignments."
      />
      <div className="collector-mgmt-actions">
        <input
          className="collector-mgmt-search"
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="collector-actions-right">
          <div className="collector-tabs-container">
            <button
              type="button"
              className={`collector-tab ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active
            </button>
            <button
              type="button"
              className={`collector-tab ${activeTab === "inactive" ? "inactive" : ""}`}
              onClick={() => setActiveTab("inactive")}
            >
              Inactive
            </button>
          </div>
          <button className="collector-mgmt-add-btn" onClick={openAddModal}>
            Add Collector
          </button>
        </div>
      </div>
      <div className="collector-mgmt-grid">
        {loading ? (
          [...Array(6)].map((_, index) => (
            <div key={index} className="collector-card">
              <div className="collector-card__header">
                <Skeleton style={{ height: '24px', width: '80px', borderRadius: '12px' }} />
                <Skeleton style={{ height: '32px', width: '80px', borderRadius: '6px' }} />
              </div>

              <div className="collector-card__identity">
                <div className="collector-img-wrapper">
                  <Skeleton style={{ height: '80px', width: '80px', borderRadius: '50%' }} />
                </div>
                <div className="collector-info">
                  <Skeleton style={{ height: '20px', width: '150px', marginBottom: '8px' }} />
                  <Skeleton style={{ height: '16px', width: '120px' }} />
                </div>
              </div>

              <div className="collector-card__meta">
                <div>
                  <Skeleton style={{ height: '12px', width: '80px', marginBottom: '4px' }} />
                  <Skeleton style={{ height: '16px', width: '100px' }} />
                </div>
                <div>
                  <Skeleton style={{ height: '12px', width: '80px', marginBottom: '4px' }} />
                  <Skeleton style={{ height: '16px', width: '100px' }} />
                </div>
              </div>

              <div className="collector-card__contact">
                <div className="contact-line">
                  <Skeleton style={{ height: '14px', width: '14px', borderRadius: '2px', marginRight: '8px' }} />
                  <Skeleton style={{ height: '16px', width: '120px' }} />
                </div>
              </div>

              <Skeleton style={{ height: '40px', width: '100%', borderRadius: '8px', marginTop: '16px' }} />
            </div>
          ))
        ) : (
          drivers.map((collector) => {
          const fullName = collector.driver || `${collector.firstName || ""} ${collector.lastName || ""}`.trim() || "Unnamed collector";
          const roleLabel = collector.role || "Collection Driver";
          const department = collector.department || "Operations Team";
          const hired = formatCollectorDate(collector.created_at);
          const phone = collector.contact || "No contact number";

          return (
            <div className={`collector-card${collector.status === 'inactive' ? ' inactive' : ''}`} key={collector.id}>
              <div className="collector-card__header">
                <span className={`collector-status-badge${collector.status === 'inactive' ? ' inactive' : ''}`}>
                  {collector.status}
                </span>
                <button
                  type="button"
                  className="collector-edit-btn"
                  onClick={() => setEditModal({ open: true, collector })}
                >
                  <FaEdit />
                  Edit
                </button>
              </div>

              <div className="collector-card__identity">
                <div className="collector-img-wrapper">
                  <img
                    src={resolveCollectorImage(collector)}
                    alt={collector.driver}
                    className="collector-img"
                  />
                </div>
                <div className="collector-info">
                  <div className="collector-name">{fullName}</div>
                  <div className="collector-role">{roleLabel}</div>
                </div>
              </div>

              <div className="collector-card__meta">
                <div>
                  <p className="collector-meta-label">Department</p>
                  <p className="collector-meta-value">{department}</p>
                </div>
                <div>
                  <p className="collector-meta-label">Date Hired</p>
                  <p className="collector-meta-value">{hired}</p>
                </div>
              </div>

              <div className="collector-card__contact">
                <div className="contact-line">
                  <span className="contact-icon">
                    <FaPhone size={14} />
                  </span>
                  <span>{phone}</span>
                </div>
              </div>

              <button
                type="button"
                className="collector-view-details"
                onClick={() => setDetailsModal({ open: true, collector })}
              >
                View Details
              </button>
            </div>
          );
        })
        )}
      </div>
      {/* Add Collector Modal */}
      {addModalOpen && (
        <div className="collector-modal-bg redesigned-modal-bg">
          <div className="collector-modal redesigned-modal">
            <div className="modal-header">
              <h2>Add Collector</h2>
              <button
                className="modal-close-btn"
                aria-label="Close Add Collector Modal"
                type="button"
                onClick={closeAddModal}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddCollector} className="modal-form-grid">
              <div className="modal-form-left">
                <div className="modal-form-group">
                  <label htmlFor="firstName-input">First Name</label>
                  <input
                    id="firstName-input"
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleFormChange}
                    required
                    aria-required="true"
                    aria-invalid={!!formErrors.firstName}
                    className={formErrors.firstName ? "input-error" : ""}
                  />
                  {formErrors.firstName && (
                    <div className="form-error" role="alert">
                      <span aria-hidden="true">⚠️</span> {formErrors.firstName}
                    </div>
                  )}
                </div>
                <div className="modal-form-group">
                  <label htmlFor="lastName-input">Last Name</label>
                  <input
                    id="lastName-input"
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    required
                    aria-required="true"
                    aria-invalid={!!formErrors.lastName}
                    className={formErrors.lastName ? "input-error" : ""}
                  />
                  {formErrors.lastName && (
                    <div className="form-error" role="alert">
                      <span aria-hidden="true">⚠️</span> {formErrors.lastName}
                    </div>
                  )}
                </div>
                <div className="modal-form-group">
                  <label htmlFor="contact-input">Contact Number</label>
                  <input
                    id="contact-input"
                    type="text"
                    name="contact"
                    value={form.contact}
                    onChange={handleFormChange}
                    required
                    aria-required="true"
                    aria-invalid={!!formErrors.contact}
                    className={formErrors.contact ? "input-error" : ""}
                  />
                  {formErrors.contact && (
                    <div className="form-error" role="alert">
                      <span aria-hidden="true">⚠️</span> {formErrors.contact}
                    </div>
                  )}
                </div>
                <div className="modal-form-group">
                  <label htmlFor="password-input">Password</label>
                  <div className="password-input-group">
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleFormChange}
                      required
                      aria-required="true"
                      aria-invalid={!!formErrors.password}
                      className={formErrors.password ? "input-error" : ""}
                    />
                    <span
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={0}
                      role="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </span>
                  </div>
                  {formErrors.password && (
                    <div className="form-error" role="alert">
                      <span aria-hidden="true">⚠️</span> {formErrors.password}
                    </div>
                  )}
                </div>
                {formErrors.driver && (
                  <div className="form-error" role="alert">
                    <span aria-hidden="true">⚠️</span> {formErrors.driver}
                  </div>
                )}
                <div className="modal-form-group">
                  <label>Crew Members</label>
                  <div className="crew-chips-container">
                    {(form.crew || []).map((c, idx) => (
                      <div key={idx} className="crew-chip">
                        <input
                          type="text"
                          value={c.firstName}
                          onChange={e => handleCrewChange(idx, 'firstName', e.target.value)}
                          aria-label={`Crew member ${idx + 1} first name`}
                          placeholder="First Name"
                          className="crew-chip-input"
                        />
                        <input
                          type="text"
                          value={c.lastName}
                          onChange={e => handleCrewChange(idx, 'lastName', e.target.value)}
                          aria-label={`Crew member ${idx + 1} last name`}
                          placeholder="Last Name"
                          className="crew-chip-input"
                        />
                        {(form.crew || []).length > 1 && (
                          <button
                            type="button"
                            className="chip-remove-btn"
                            aria-label={`Remove crew member ${idx + 1}`}
                            onClick={() => removeCrewField(idx)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="chip-add-btn"
                      aria-label="Add crew member"
                      onClick={addCrewField}
                    >
                      + Add
                    </button>
                  </div>
                  {formErrors.crew && (
                    <div className="form-error" role="alert">
                      <span aria-hidden="true">⚠️</span> {formErrors.crew}
                    </div>
                  )}
                </div>
              </div>
              {/* <div className="modal-form-right">
                <div className="img-preview-container">
                  <div className="img-preview placeholder">
                    <FaCamera className="img-preview-placeholder-icon" />
                    <span className="img-preview-placeholder-text">No Image</span>
                  </div>
                  <div
                    className="img-upload-button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <FaCamera className="img-upload-button-icon" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden-file-input"
                  />
                </div>
              </div> */}
              {formErrors.submit && (
                <div className="form-error form-error-submit" role="alert">
                  <span aria-hidden="true">⚠️</span> {formErrors.submit}
                </div>
              )}
              <div className="modal-form-actions">
                <button type="submit" className="primary-btn" disabled={addLoading}>Add</button>
                <button type="button" className="secondary-btn" onClick={closeAddModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Success Modal */}
      {successModalOpen && (
        <div className="collector-modal-bg">
          <div className="collector-modal">
            <h2>Collector Added!</h2>
            <div className="success-modal-content">
              The collector has been added successfully.
            </div>
            <div className="success-modal-actions">
              <button className="primary-btn" onClick={() => setSuccessModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Details Modal */}
      {detailsModal.open && detailsModal.collector && (
        <div className="collector-modal-bg">
          <div className="collector-modal redesigned-modal details-modal-wrapper">
            <div className="modal-header details-modal-header">
              <div className="details-modal-header-content">
                <div className="collector-img-wrapper details-modal-img-wrapper">
                  <img
                    src={resolveCollectorImage(detailsModal.collector)}
                    alt={detailsModal.collector.driver}
                    className="collector-img details-modal-img"
                  />
              </div>
                <div>
                  <p className="eyebrow-label">Driver profile</p>
                  <h2 className="details-modal-title">
                    {detailsModal.collector.firstName} {detailsModal.collector.lastName}
                  </h2>
                  <span className={`collector-status-badge${detailsModal.collector.status === "inactive" ? " inactive" : ""}`}>
                    {detailsModal.collector.status}
                  </span>
              </div>
            </div>
              <button
                className="modal-close-btn"
                aria-label="Close profile modal"
                type="button"
                onClick={() => setDetailsModal({ open: false, collector: null })}
              >
                ×
              </button>
            </div>

            <div className="details-modal-body">
              <div className="details-modal-crew-section">
                <p className="collector-meta-label details-modal-crew-label">
                  Crew members
                </p>
                {(detailsModal.collector.crew || []).length === 0 ? (
                  <p className="collector-meta-value">No crew assigned</p>
                ) : (
                  <ul className="details-modal-crew-list">
                    {detailsModal.collector.crew.map((c, i) => (
                      <li key={i}>
                        <strong>
                          {c.firstName} {c.lastName}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="details-modal-footer">
              <button className="secondary-btn" onClick={() => setDetailsModal({ open: false, collector: null })}>
                Close
              </button>
              <button className="primary-btn" onClick={() => setEditModal({ open: true, collector: detailsModal.collector })}>
                Edit profile
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Collector Modal */}
      {editModal.open && editModal.collector && (
        <div className="collector-modal-bg">
          <div className="collector-modal redesigned-modal edit-modal-wrapper">
            <div className="modal-header edit-modal-header">
              <div>
                <p className="eyebrow-label">Update collector</p>
                <h2 className="edit-modal-title">{`${editModal.collector.firstName} ${editModal.collector.lastName}`}</h2>
              </div>
              <button
                className="modal-close-btn"
                aria-label="Close Edit Collector Modal"
                type="button"
                onClick={() => setEditModal({ open: false, collector: null })}
              >
                ×
              </button>
            </div>

            <form
              className="modal-form-grid redesigned-edit-form edit-modal-form"
              onSubmit={async (e) => {
                e.preventDefault();

                try {
                  // Fetch routes for conflict checking
                  const { data: allRoutes } = await fetchRoutesForCollectorConflictCheck();

                  if (!allRoutes) {
                    alert("Error fetching data for validation");
                    return;
                  }

                  // Check for conflicts in the update
                  const conflicts = validateCollectorUpdate(editModal.collector, allRoutes);
                  if (conflicts.length > 0) {
                    const crewList = conflicts[0].assignedCrewMembers
                      .map(c => `${c.name} (Route ${c.route} - ${c.driver})`)
                      .join(', ');
                    alert(`Cannot update: The following crew members are already assigned to routes: ${crewList}`);
                    return;
                  }

                  // Process update data and submit
                  const updateData = processCollectorUpdateData(editModal.collector);
                  const result = await updateExistingCollector(editModal.collector.id, updateData);

                  if (!result.success) {
                    alert(`Error updating collector: ${result.error.message || JSON.stringify(result.error)}`);
                  } else {
                    // Success
                    setEditModal({ open: false, collector: null });
                    setEditSuccessModalOpen(true);
                  }
                } catch (err) {
                  alert(`Error updating collector: ${err.message || JSON.stringify(err)}`);
                }
              }}
            >
              <div className="modal-form-left">
                <div className="modal-form-group">
                <label>Status</label>
                <select
                  value={editModal.collector.status}
                    onChange={(e) =>
                      setEditModal((modal) => ({
                        ...modal,
                        collector: { ...modal.collector, status: e.target.value },
                      }))
                    }
                    className="collector-select"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

                <div className="modal-form-group">
                <label>Contact Number</label>
                <input
                  type="text"
                    value={editModal.collector.contact || ""}
                    onChange={(e) =>
                      setEditModal((modal) => ({
                        ...modal,
                        collector: { ...modal.collector, contact: e.target.value },
                      }))
                    }
                  required
                  placeholder="Contact Number"
                />
              </div>

              <div className="modal-form-group">
                  <label>Driver Name</label>
                  <div className="modal-name-grid">
                    <input
                      type="text"
                      value={editModal.collector.firstName || ""}
                      onChange={(e) =>
                        setEditModal((modal) => ({
                          ...modal,
                          collector: { ...modal.collector, firstName: e.target.value },
                        }))
                      }
                      placeholder="First name"
                      required
                    />
                    <input
                      type="text"
                      value={editModal.collector.lastName || ""}
                      onChange={(e) =>
                        setEditModal((modal) => ({
                          ...modal,
                          collector: { ...modal.collector, lastName: e.target.value },
                        }))
                      }
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-form-right">
                <label className="modal-form-group">Crew Members</label>
                <div className="crew-chips-container modern edit-modal-crew-container">
                  {(editModal.collector.crew || []).map((c, idx) => (
                    <div key={idx} className="crew-chip modern edit-modal-crew-chip">
                      <input
                        type="text"
                        value={c.firstName}
                        onChange={(e) =>
                          setEditModal((modal) => {
                          const crew = [...(modal.collector.crew || [])];
                          crew[idx].firstName = e.target.value;
                          return { ...modal, collector: { ...modal.collector, crew } };
                          })
                        }
                        placeholder="First Name"
                      />
                      <input
                        type="text"
                        value={c.lastName}
                        onChange={(e) =>
                          setEditModal((modal) => {
                          const crew = [...(modal.collector.crew || [])];
                          crew[idx].lastName = e.target.value;
                          return { ...modal, collector: { ...modal.collector, crew } };
                          })
                        }
                        placeholder="Last Name"
                      />
                      {(editModal.collector.crew || []).length > 1 && (
                        <button
                          type="button"
                          className="chip-remove-btn"
                          aria-label={`Remove crew member ${idx + 1}`}
                          onClick={() =>
                            setEditModal((modal) => {
                            const crew = [...(modal.collector.crew || [])];
                            crew.splice(idx, 1);
                            return { ...modal, collector: { ...modal.collector, crew } };
                            })
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="chip-add-btn"
                    aria-label="Add crew member"
                    onClick={() =>
                      setEditModal((modal) => ({
                        ...modal,
                        collector: {
                          ...modal.collector,
                          crew: [...(modal.collector.crew || []), { firstName: "", lastName: "" }],
                        },
                      }))
                    }
                  >
                    + Add crew
                  </button>
                </div>
              </div>

              <div className="modal-form-actions edit-modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setEditModal({ open: false, collector: null })}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Success Modal */}
      {editSuccessModalOpen && (
        <div className="collector-modal-bg">
          <div className="collector-modal">
            <h2>Driver Updated!</h2>
            <div className="success-modal-content">
              The driver information has been updated successfully.
            </div>
            <div className="success-modal-actions">
              <button className="primary-btn" onClick={() => setEditSuccessModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collector;
