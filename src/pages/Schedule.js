import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Chip,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  OutlinedInput,
  Checkbox,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import "./Schedule.css";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";
import { useScheduleData } from "../hooks/useScheduleData";
import {
  emptyRoute,
  AREAS,
  WASTE_TYPES,
  FREQUENCIES,
  DAYS_OFF,
  ROUTE_PRESETS,
  formatTime12h,
  isAM,
  getMinEndTime,
  getUserFriendlyError,
  validateForm,
  getAvailableDrivers,
  getAvailableCrew,
  getAvailableRouteNumbers
} from "../utils/scheduleUtils";
import {
  validateScheduleConflicts,
  fetchRoutesForConflictCheck
} from "../services/scheduleConflictService";
import {
  normalizeFormData,
  buildNormalizedPayloadFromCleanData,
  getOperationContext
} from "../utils/scheduleDataUtils";
import { submitSchedule } from "../services/scheduleSubmissionService";
import { handleScheduleFormChange } from "../utils/formHandlers";

const Schedule = () => {
  const { routes, collectors, loading } = useScheduleData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null); // null for add, id for edit
  const [form, setForm] = useState(emptyRoute);
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalType, setSuccessModalType] = useState("add"); // "add" or "update"

  // Calculate available options for form
  const availableDrivers = getAvailableDrivers(collectors, routes, editId);
  const availableCrew = getAvailableCrew(collectors, routes, editId, form.crew);
  const availableRouteNumbers = getAvailableRouteNumbers(routes, editId, form.route);

  // Open add/edit modal
  const openAddModal = () => {
    setForm(emptyRoute);
    setEditId(null);
    setFormErrors({});
    setModalOpen(true);
  };
  const openEditModal = (route) => {
    // Normalize database fields (snake_case) to form fields (camelCase)
    const normalizedForm = { 
      ...route, 
      crew: [...(route.crew || [])], 
      areas: [...(route.areas || [])],
      endTime: route.end_time || route.endTime || "",
      dayOff: route.dayoff || route.dayOff || "",
    };
    console.log("📝 Opening edit modal for route:", route.id);
    console.log("📋 Normalized form data:", normalizedForm);
    setForm(normalizedForm);
    setEditId(route.id);
    setFormErrors({});
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyRoute);
    setEditId(null);
    setFormErrors({});
  };

  // Form field changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "crew" || name === "areas") {
      // Handle multi-select changes differently
      setForm((prev) => ({ ...prev, [name]: value }));
    } else {
      // Use the new form handler for other fields
      setForm((prev) => handleScheduleFormChange(prev, name, value, editId));
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🚀 handleSubmit called, editId:", editId);
    console.log("📝 Form data:", form);

    // Basic form validation
    const formErrorsObj = validateForm(form, routes, editId);
    const isValid = Object.keys(formErrorsObj).length === 0;
    setFormErrors(formErrorsObj);
    console.log("✅ Validation result:", isValid);
    if (!isValid) {
      console.log("❌ Validation failed, errors:", formErrorsObj);
      return;
    }

    try {
      // Fetch routes for conflict checking
      const { data: allRoutes, error: routesError } = await fetchRoutesForConflictCheck();

      if (routesError) {
        console.error("Error fetching routes for conflict check:", routesError);
        setSnackbar({
          open: true,
          message: getUserFriendlyError(routesError, "check conflicts"),
          severity: "error",
        });
        return;
      }

      // Check schedule conflicts
      const conflicts = validateScheduleConflicts(form, allRoutes, editId);
      if (conflicts.length > 0) {
        // Show the first conflict error
        const primaryConflict = conflicts[0];
        setSnackbar({
          open: true,
          message: primaryConflict.message,
          severity: "error",
        });
        return;
      }

      // Normalize and prepare data
      const normalizedForm = normalizeFormData(form);
      const payload = buildNormalizedPayloadFromCleanData(normalizedForm);

      // Submit schedule (insert or update)
      const result = await submitSchedule(payload, editId);

      if (!result.success) {
        setSnackbar({
          open: true,
          message: getUserFriendlyError(result.error, getOperationContext(editId)),
          severity: "error",
        });
        return;
      }

      // Success handling
      const operation = editId ? "update" : "add";
      setSuccessModalType(operation);
      setSuccessModalOpen(true);
      closeModal();

    } catch (err) {
      console.error("Unexpected error in handleSubmit:", err);
      const context = getOperationContext(editId);
      setSnackbar({
        open: true,
        message: getUserFriendlyError(err, context),
        severity: "error",
      });
    }
  };

  return (
    <div className="schedule-container">
      <PageHero
        eyebrow="Route planning"
        title="Schedule"
        subtitle="Plan and monitor each collection route and crew rotation."
      />
      {/* Add Schedule Button */}
      <div className="schedule-actions-bar">
        <button
          type="button"
          className="schedule-add-btn"
          onClick={openAddModal}
        >
          
          Add Schedule
        </button>
      </div>
      {/* Schedules Table */}
      <div className="schedule-table-container">
        <div className="schedule-table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Driver</th>
                <th>Crew</th>
                <th>Barangays</th>
                <th>Time</th>
                <th>Kind of Garbage</th>
                <th>Frequency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index}>
                    <td>
                      <Skeleton style={{ height: '20px', width: '40px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '120px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '180px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '200px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '140px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '100px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '20px', width: '100px' }} />
                    </td>
                    <td>
                      <Skeleton style={{ height: '36px', width: '80px', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : (
                routes.map((route) => (
                  <tr key={route.id}>
                    <td>{route.route}</td>
                    <td>{route.driver}</td>
                    <td>
                      {route.crew &&
                        route.crew
                          .filter(Boolean)
                          .map((member) =>
                            typeof member === "string"
                              ? member
                              : [member.firstName, member.lastName]
                                  .filter(Boolean)
                                  .join(" ")
                          )
                          .join(" • ")}
                    </td>
                    <td>
                      {route.areas && route.areas.filter(Boolean).join(" • ")}
                    </td>
                    <td className="schedule-table-time">
                      {formatTime12h(route.time)}
                      {route.end_time ? ` - ${formatTime12h(route.end_time)}` : ""}
                    </td>
                    <td>{route.type}</td>
                    <td>{route.frequency || route.frequency || "—"}</td>
                    <td>
                      <Button
                        variant="outlined"
                        size="small"
                        className="schedule-table-edit-btn"
                        onClick={() => openEditModal(route)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog 
        open={modalOpen} 
        onClose={closeModal}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {editId ? "Edit Route" : "Add New Route"}
          <IconButton
            aria-label="close"
            onClick={closeModal}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Route Number</InputLabel>
            <Select
              label="Route Number"
              name="route"
              value={form.route}
              onChange={handleFormChange}
              error={!!formErrors.route}
            >
              {availableRouteNumbers.map((num) => (
                <MenuItem key={num} value={num}>
                  {num}
                </MenuItem>
              ))}
            </Select>
            {formErrors.route && (
              <Typography color="error" variant="caption">
                {formErrors.route}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Driver</InputLabel>
            <Select
              label="Driver"
              name="driver"
              value={form.driver}
              onChange={handleFormChange}
              error={!!formErrors.driver}
              input={<OutlinedInput label="Driver" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected ? (
                    <Chip
                      key={selected}
                      label={selected}
                      size="small"
                      onDelete={() => setForm((prev) => ({ ...prev, driver: "" }))}
                    />
                  ) : null}
                </Box>
              )}
            >
              {availableDrivers.map((driver) => (
                <MenuItem key={driver} value={driver}>
                  {driver}
                </MenuItem>
              ))}
            </Select>
            {formErrors.driver && (
              <Typography color="error" variant="caption">
                {formErrors.driver}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Crew Members</InputLabel>
            <Select
              label="Crew Members"
              name="crew"
              multiple
              value={form.crew}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, crew: e.target.value }))
              }
              input={<OutlinedInput label="Crew Members" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.length > 0
                    ? selected.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          size="small"
                          onDelete={() =>
                            setForm((prev) => ({
                              ...prev,
                              crew: (prev.crew || []).filter((c) => c !== value),
                            }))
                          }
                        />
                      ))
                    : null}
                </Box>
              )}
            >
              {availableCrew.map((crew) => (
                <MenuItem key={crew} value={crew}>
                  <Checkbox checked={form.crew.indexOf(crew) > -1} />
                  {crew}
                </MenuItem>
              ))}
            </Select>
            {formErrors.crew && (
              <Typography color="error" variant="caption">
                {formErrors.crew}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Barangays</InputLabel>
            <Select
              label="Barangays"
              name="areas"
              multiple
              value={form.areas}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, areas: e.target.value }))
              }
              input={<OutlinedInput label="Barangays" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.length > 0
                    ? selected.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          size="small"
                          onDelete={() =>
                            setForm((prev) => ({
                              ...prev,
                              areas: (prev.areas || []).filter((a) => a !== value),
                            }))
                          }
                        />
                      ))
                    : null}
                </Box>
              )}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                  },
                },
              }}
            >
              <MenuItem
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e0e0e0",
                  backgroundColor: "#f5f5f5",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Close the dropdown by blurring the select
                    const selectElement = e.target.closest(".MuiSelect-select");
                    if (selectElement) {
                      selectElement.blur();
                    }
                  }}
                  sx={{ color: "#666" }}
                ></IconButton>
              </MenuItem>
              {AREAS.map((area) => (
                <MenuItem key={area} value={area}>
                  <Checkbox checked={form.areas.indexOf(area) > -1} />
                  {area}
                </MenuItem>
              ))}
            </Select>
            {formErrors.areas && (
              <Typography color="error" variant="caption">
                {formErrors.areas}
              </Typography>
            )}
          </FormControl>
          <TextField
            margin="dense"
            label="Collection Start Time"
            type="time"
            fullWidth
            variant="outlined"
            name="time"
            value={form.time}
            onChange={handleFormChange}
            error={!!formErrors.time}
            helperText={formErrors.time}
          />
          <TextField
            margin="dense"
            label="Collection End Time"
            type="time"
            fullWidth
            variant="outlined"
            name="endTime"
            value={form.endTime}
            onChange={handleFormChange}
            error={!!formErrors.endTime}
            helperText={
              formErrors.endTime || 
              (form.time && isAM(form.time))
            }
            inputProps={{ 
              min: getMinEndTime(form.time),
              max: "23:59"
            }}
            onFocus={(e) => {
              // If start time is AM, restrict end time to PM only
              if (form.time && isAM(form.time)) {
                e.target.min = "12:00";
              }
            }}
            onInput={(e) => {
              // Additional validation on input
              if (form.time && isAM(form.time) && isAM(e.target.value)) {
                e.target.value = "12:00";
                handleFormChange(e);
              }
            }}
          />
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Waste Type</InputLabel>
            <Select
              label="Waste Type"
              name="type"
              value={form.type}
              onChange={handleFormChange}
              error={!!formErrors.type}
            >
              {WASTE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
            {formErrors.type && (
              <Typography color="error" variant="caption">
                {formErrors.type}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Frequency</InputLabel>
            <Select
              label="Frequency"
              name="frequency"
              value={form.frequency}
              onChange={handleFormChange}
              error={!!formErrors.frequency}
            >
              {FREQUENCIES.map((freq) => (
                <MenuItem key={freq} value={freq}>
                  {freq}
                </MenuItem>
              ))}
            </Select>
            {formErrors.frequency && (
              <Typography color="error" variant="caption">
                {formErrors.frequency}
              </Typography>
            )}
          </FormControl>
          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>Day Off</InputLabel>
            <Select
              label="Day Off"
              name="dayOff"
              value={form.dayOff}
              onChange={handleFormChange}
              error={!!formErrors.dayOff}
            >
              {DAYS_OFF.map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </Select>
            {formErrors.dayOff && (
              <Typography color="error" variant="caption">
                {formErrors.dayOff}
              </Typography>
            )}
          </FormControl>
          {form.coordinates &&
            form.coordinates.length > 0 &&
            form.coordinates.map((coord, idx) => (
              <Box
                key={idx}
                sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}
              >
                <TextField
                  label="Latitude"
                  type="number"
                  value={
                    coord.latitude !== undefined
                      ? coord.latitude
                      : Array.isArray(coord)
                      ? coord[0]
                      : ""
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm((prev) => {
                      const coords = [...(prev.coordinates || [])];
                      if (
                        typeof coords[idx] === "object" &&
                        coords[idx] !== null &&
                        coords[idx].latitude !== undefined
                      ) {
                        coords[idx] = { ...coords[idx], latitude: val };
                      } else if (Array.isArray(coords[idx])) {
                        coords[idx] = [val, coords[idx][1]];
                      } else {
                        coords[idx] = [val, ""];
                      }
                      return { ...prev, coordinates: coords };
                    });
                  }}
                  size="small"
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  value={
                    coord.longitude !== undefined
                      ? coord.longitude
                      : Array.isArray(coord)
                      ? coord[1]
                      : ""
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm((prev) => {
                      const coords = [...(prev.coordinates || [])];
                      if (
                        typeof coords[idx] === "object" &&
                        coords[idx] !== null &&
                        coords[idx].longitude !== undefined
                      ) {
                        coords[idx] = { ...coords[idx], longitude: val };
                      } else if (Array.isArray(coords[idx])) {
                        coords[idx] = [coords[idx][0], val];
                      } else {
                        coords[idx] = ["", val];
                      }
                      return { ...prev, coordinates: coords };
                    });
                  }}
                  size="small"
                  sx={{ width: 120 }}
                />
                {form.coordinates.length > 1 && (
                  <Button
                    onClick={() => {
                      setForm((prev) => {
                        const coords = [...(prev.coordinates || [])];
                        coords.splice(idx, 1);
                        return { ...prev, coordinates: coords };
                      });
                    }}
                    color="error"
                    size="small"
                    sx={{ minWidth: 0, px: 1 }}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSubmit} color="primary" variant="contained">
            {loading ? (
              <CircularProgress size={24} />
            ) : editId ? (
              "Update"
            ) : (
              "Add"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      {successModalOpen && (
        <div className="collector-modal-bg">
          <div className="collector-modal">
            <h2>{successModalType === "update" ? "Schedule Updated!" : "Schedule Added!"}</h2>
            <div className="schedule-success-modal-content">
              {successModalType === "update" 
                ? "The schedule has been updated successfully."
                : "The schedule has been added successfully."}
            </div>
            <div className="schedule-success-modal-actions">
              <button
                className="primary-btn"
                onClick={() => setSuccessModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "center", horizontal: "center" }}
        sx={{
          "& .MuiSnackbar-root": {
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          },
        }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Schedule;
