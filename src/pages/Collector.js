/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { FaCamera, FaEdit, FaEye, FaEyeSlash, FaEnvelope, FaPhone } from 'react-icons/fa';
import "./Collector.css";
import PageHero from "../components/PageHero";

// Helper to remove all routes for a driver
// eslint-disable-next-line no-unused-vars
async function removeRoutesForDriver(driverName) {
  await supabase
    .from("routes")
    .delete()
    .eq("driver", driverName);
}

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
};

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
  const fileInputRef = useRef(null);

  // Load collectors from Supabase
  useEffect(() => {
    let ignore = false;
    const fetchCollectors = async () => {
      const { data, error } = await supabase
        .from("collectors")
        .select("*")
        .order("driver", { ascending: true });
      if (!error) setCollectors(data || []);
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
  const validate = () => {
    const errors = {};
    if (!form.firstName) errors.firstName = "First name required";
    if (!form.lastName) errors.lastName = "Last name required";
    if (!form.contact) errors.contact = "Contact number required";
    if (!form.password) errors.password = "Password required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handleAddCollector = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    if (!validate()) { setAddLoading(false); return; }
    
    try {
      // Fetch the latest collectors from Supabase for duplicate check
      const { data: latestCollectors } = await supabase.from("collectors").select("*");
      // Fetch all routes to check crew assignments
      const { data: allRoutes } = await supabase.from("routes").select("*");
      
      // Gather existing names by role (case-insensitive)
      const existingDriverNames = (latestCollectors || [])
        .map(c => (c.driver || '').toLowerCase().trim())
        .filter(Boolean);
      const existingCrewNames = (latestCollectors || [])
        .flatMap(c => (c.crew || []).map(member =>
          (member.firstName && member.lastName)
            ? (member.firstName + ' ' + member.lastName).toLowerCase().trim()
            : ''
        ))
        .filter(Boolean);
      
      // New driver name
      const newDriverName = (form.firstName + ' ' + form.lastName).toLowerCase();
      
      // New crew names
      const newCrewNames = form.crew
        .filter(c => c.firstName.trim() && c.lastName.trim())
        .map(c => (c.firstName + ' ' + c.lastName).toLowerCase());
      
      // Check duplicates with role separation to avoid false positives
      if (existingDriverNames.includes(newDriverName)) {
        setFormErrors({ driver: "This driver already exists." });
        setAddLoading(false);
        return;
      }
      if (newCrewNames.some(name => existingCrewNames.includes(name))) {
        setFormErrors({ crew: "One or more crew members already exist." });
        setAddLoading(false);
        return;
      }
      
      // Check if crew members are already assigned to routes
      const assignedCrewMembers = [];
      for (const route of allRoutes || []) {
        if (route.crew && Array.isArray(route.crew)) {
          for (const crewMember of route.crew) {
            const crewName = typeof crewMember === 'string' 
              ? crewMember.toLowerCase() 
              : (crewMember.firstName && crewMember.lastName 
                ? (crewMember.firstName + ' ' + crewMember.lastName).toLowerCase() 
                : '');
            
            if (newCrewNames.includes(crewName)) {
              assignedCrewMembers.push({
                name: crewName,
                route: route.route,
                driver: route.driver
              });
            }
          }
        }
      }
      
      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers.map(c => `${c.name} (Route ${c.route} - ${c.driver})`).join(', ');
        setFormErrors({ 
          crew: `The following crew members are already assigned to routes: ${crewList}` 
        });
        setAddLoading(false);
        return;
      }
      
      // If all validations pass, add the collector
      const { data, error } = await supabase
        .from("collectors")
        .insert([{
          firstName: form.firstName,
          lastName: form.lastName,
          contact: form.contact,
          password: form.password,
          driver: form.firstName + ' ' + form.lastName,
          crew: form.crew.filter((c) => c.firstName.trim() && c.lastName.trim()),
          status: 'active',
        }])
        .select(); // <-- Add this
      console.log("Insert result:", data, error);
      if (error) {
        setFormErrors({ submit: "Error adding collector: " + error.message });
      } else {
        // After successful add
        setSuccessModalOpen(true);
        closeAddModal();
        await fetchCollectors();
      }
    } catch (err) {
      setFormErrors({ submit: "Error adding collector" });
    }
    setAddLoading(false);
  };

  return (
    <div className="collector-mgmt-container">
      <PageHero
        eyebrow="Collections team"
        title="Collectors"
        subtitle="Manage driver profiles, crews, and route assignments."
        action={
          <div className="collector-hero-actions">
            <div className="collector-mgmt-status-toggle">
              <span
                className={activeTab === "active" ? "active" : "inactive"}
                onClick={() => setActiveTab("active")}
              >
                ● active
              </span>
              <span> • </span>
              <span
                className={activeTab === "inactive" ? "inactive active" : "inactive"}
                onClick={() => setActiveTab("inactive")}
              >
                ● inactive
              </span>
            </div>
            <button className="collector-mgmt-add-btn" onClick={openAddModal}>
              Add Collector
            </button>
          </div>
        }
      />
      <div className="collector-mgmt-actions">
        <input
          className="collector-mgmt-search"
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="collector-mgmt-grid">
        {drivers.map((collector) => {
          const fullName = collector.driver || `${collector.firstName || ""} ${collector.lastName || ""}`.trim() || "Unnamed collector";
          const roleLabel = collector.role || "Collection Driver";
          const department = collector.department || "Operations Team";
          const hired = formatDate(collector.created_at);
          const email = collector.email || "No email provided";
          const phone = collector.contact || "No contact number";

          return (
            <div className={`collector-card${collector.status === 'inactive' ? ' inactive' : ''}`} key={collector.id}>
              <div className="collector-card__header">
                <span className="collector-card__dot" aria-hidden="true" />
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
                    src={require('../Cooked.jpg')}
                    alt={collector.driver}
                    className="collector-img"
                    style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: '50%' }}
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
                    <FaEnvelope size={14} />
                  </span>
                  <span>{email}</span>
                </div>
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
        })}
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
                      style={{ width: '100%', paddingRight: 36 }}
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
                      <div key={idx} className="crew-chip" style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={c.firstName}
                          onChange={e => handleCrewChange(idx, 'firstName', e.target.value)}
                          aria-label={`Crew member ${idx + 1} first name`}
                          placeholder="First Name"
                          style={{ width: 90 }}
                        />
                        <input
                          type="text"
                          value={c.lastName}
                          onChange={e => handleCrewChange(idx, 'lastName', e.target.value)}
                          aria-label={`Crew member ${idx + 1} last name`}
                          placeholder="Last Name"
                          style={{ width: 90 }}
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
              <div className="modal-form-right">
                <div className="img-preview-container" style={{ position: 'relative' }}>
                  <div className="img-preview placeholder">
                    <FaCamera style={{ fontSize: '1.5rem', color: '#bbb' }} />
                    <span style={{ fontSize: '0.8rem', marginTop: '4px' }}>No Image</span>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      right: 115,
                      background: '#fff',
                      borderRadius: '50%',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      cursor: 'pointer',
                    }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <FaCamera style={{ fontSize: '0.95rem', color: '#4B8B3B' }} />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
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
            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              The collector has been added successfully.
            </div>
            <div style={{ textAlign: 'center' }}>
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
          <div className="collector-modal" style={{ maxWidth: 420, borderRadius: 20, boxShadow: '0 8px 32px rgba(56,109,44,0.13)', padding: 32 }}>
            <h2 style={{ color: '#386D2C', textAlign: 'center', marginBottom: 18 }}>Driver Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#f7f7f7', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(51,106,41,0.07)' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#386D2C', marginBottom: 6 }}>Driver Information</div>
                <div style={{ marginBottom: 6 }}><b>Name:</b> {detailsModal.collector.firstName} {detailsModal.collector.lastName}</div>
                <div style={{ marginBottom: 6 }}><b>Contact:</b> {detailsModal.collector.contact}</div>
                <div style={{ marginBottom: 6 }}><b>Status:</b> <span style={{ color: detailsModal.collector.status === 'inactive' ? '#dc3545' : '#386D2C', fontWeight: 600 }}>{detailsModal.collector.status}</span></div>
                <div style={{ marginBottom: 6 }}><b>Role:</b> Driver</div>
              </div>
              <div style={{ background: '#f7f7f7', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(51,106,41,0.07)' }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#386D2C', marginBottom: 6 }}>Crew Members</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detailsModal.collector.crew && detailsModal.collector.crew.map((c, i) => (
                    <li key={i} style={{ marginBottom: 4, fontSize: 15 }}><b>{c.firstName} {c.lastName}</b></li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                className="primary-btn"
                style={{ minWidth: 90 }}
                onClick={() => setDetailsModal({ open: false, collector: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Collector Modal */}
      {editModal.open && editModal.collector && (
        <div className="collector-modal-bg">
          <div className="collector-modal">
            <h2>Edit Driver & Crew</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  // Fetch all routes to check crew assignments
                  const { data: allRoutes } = await supabase.from("routes").select("*");
                  
                  // Get the updated crew names and intended driver name
                  const updatedCrewNames = (editModal.collector.crew || [])
                    .filter(c => c.firstName.trim() && c.lastName.trim())
                    .map(c => (c.firstName + ' ' + c.lastName).toLowerCase());
                  const intendedDriverName = (editModal.collector.firstName + ' ' + editModal.collector.lastName)
                    .toLowerCase()
                    .trim();
                  
                  // Check if crew members are already assigned to other routes
                  const assignedCrewMembers = [];
                  for (const route of allRoutes || []) {
                    if (route.crew && Array.isArray(route.crew)) {
                      for (const crewMember of route.crew) {
                        const crewName = typeof crewMember === 'string' 
                          ? crewMember.toLowerCase() 
                          : (crewMember.firstName && crewMember.lastName 
                            ? (crewMember.firstName + ' ' + crewMember.lastName).toLowerCase() 
                            : '');
                        
                        if (updatedCrewNames.includes(crewName)) {
                          // Allow if this crew is assigned to a route under the same driver being edited
                          const routeDriverName = (route.driver || '').toLowerCase().trim();
                          if (routeDriverName === intendedDriverName) {
                            continue;
                          }
                          assignedCrewMembers.push({
                            name: crewName,
                            route: route.route,
                            driver: route.driver
                          });
                        }
                      }
                    }
                  }
                  
                  // If crew members are already assigned, show error
                  if (assignedCrewMembers.length > 0) {
                    const crewList = assignedCrewMembers.map(c => `${c.name} (Route ${c.route} - ${c.driver})`).join(', ');
                    alert(`Cannot update: The following crew members are already assigned to routes: ${crewList}`);
                    return;
                  }
                  
                  await supabase.from("collectors").update({
                    status: editModal.collector.status,
                    crew: (editModal.collector.crew || []).filter((c) => c.firstName.trim() && c.lastName.trim()),
                    firstName: editModal.collector.firstName,
                    lastName: editModal.collector.lastName,
                    contact: editModal.collector.contact,
                    driver: editModal.collector.firstName + ' ' + editModal.collector.lastName,
                  }).eq("id", editModal.collector.id).select();
                  // After successful edit
                  setEditModal({ open: false, collector: null });
                  setEditSuccessModalOpen(true);
                } catch (err) {
                  alert("Error updating status: " + (err && err.message ? err.message : JSON.stringify(err)));
                }
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <label>Status</label>
                <select
                  value={editModal.collector.status}
                  onChange={e => setEditModal(modal => ({ ...modal, collector: { ...modal.collector, status: e.target.value } }))}
                  style={{ width: '100%', padding: 7, borderRadius: 7, marginTop: 4 }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>Contact Number</label>
                <input
                  type="text"
                  value={editModal.collector.contact || ''}
                  onChange={e => setEditModal(modal => ({ ...modal, collector: { ...modal.collector, contact: e.target.value } }))}
                  required
                  placeholder="Contact Number"
                  style={{ width: '100%', padding: 7, borderRadius: 7, marginTop: 4 }}
                />
              </div>
              <div className="modal-form-group">
                <label>Crew Members</label>
                <div className="crew-chips-container">
                  {(editModal.collector.crew || []).map((c, idx) => (
                    <div key={idx} className="crew-chip" style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={c.firstName}
                        onChange={e => setEditModal(modal => {
                          const crew = [...(modal.collector.crew || [])];
                          crew[idx].firstName = e.target.value;
                          return { ...modal, collector: { ...modal.collector, crew } };
                        })}
                        required={idx === 0}
                        aria-label={`Crew member ${idx + 1} first name`}
                        placeholder="First Name"
                        style={{ width: 90 }}
                      />
                      <input
                        type="text"
                        value={c.lastName}
                        onChange={e => setEditModal(modal => {
                          const crew = [...(modal.collector.crew || [])];
                          crew[idx].lastName = e.target.value;
                          return { ...modal, collector: { ...modal.collector, crew } };
                        })}
                        required={idx === 0}
                        aria-label={`Crew member ${idx + 1} last name`}
                        placeholder="Last Name"
                        style={{ width: 90 }}
                      />
                      {(editModal.collector.crew || []).length > 1 && (
                        <button
                          type="button"
                          className="chip-remove-btn"
                          aria-label={`Remove crew member ${idx + 1}`}
                          onClick={() => setEditModal(modal => {
                            const crew = [...(modal.collector.crew || [])];
                            crew.splice(idx, 1);
                            return { ...modal, collector: { ...modal.collector, crew } };
                          })}
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
                    onClick={() => setEditModal(modal => ({ ...modal, collector: { ...modal.collector, crew: [...(modal.collector.crew || []), { firstName: '', lastName: '' }] } }))}
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="submit" className="primary-btn">Save</button>
                <button type="button" className="secondary-btn" onClick={() => setEditModal({ open: false, collector: null })}>
                  Cancel
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
            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              The driver information has been updated successfully.
            </div>
            <div style={{ textAlign: 'center' }}>
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
