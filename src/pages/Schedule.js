import React, { useState, useEffect } from "react";
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
import dayjs from "dayjs";
import "./Schedule.css";
import { supabase } from "../supabaseClient";
import PageHero from "../components/PageHero";
import { Skeleton } from "../components/ui/skeleton";

const emptyRoute = {
  route: "",
  driver: "",
  crew: [],
  areas: [],
  time: "",
  endTime: "",
  type: "",
  frequency: "",
  dayOff: "",
};

const ROUTE_NUMBERS = ["1", "2", "3", "4", "5", "6"];
// Predefined schedules by route for autofill when adding a new schedule
const ROUTE_PRESETS = {
  "1": {
    crew: [
      "Agostine Estrera Jr",
      "Roberto Del Carmen",
      "Joey Cantay",
    ],
    areas: ["Don Pedro", "Polambato", "Cayang", "TayTayan", "Cogon"],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Sunday",
  },
  "2": {
    crew: [
      "Ricky Francisco",
      "Rex Desuyo",
      "Carlito Tampus",
    ],
    areas: [
      "Sto. Nino",
      "Sudlonon",
      "Lourdes",
      "Carbon",
      "Pandan",
      "Bungtod",
    ],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Sunday",
  },
  "3": {
    crew: [
      "Noli Dahunan",
      "Anthony Remulta",
      "Dominador Antopina",
    ],
    areas: [
      "ARAPAL Farm",
      "Bungtod (Maharat & Laray)",
      "Dakit (Highway & Provincial Rd)",
      "Malingin Highway",
    ],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Sunday",
  },
  "4": {
    crew: [
      "Joel Ursal Sr",
      "Radne Bedrijo",
      "Jermin Andrade",
    ],
    areas: [
      "A/B Cogon",
      "Siocon",
      "Odlot",
      "Marangong",
      "Libertad",
      "Guadalupe",
    ],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Saturday",
  },
  "5": {
    crew: [
      "Winful Catampatan",
      "Orgie Menoria",
      "Wilmor Viray",
    ],
    areas: [
      "Public Market",
      "Cantecson",
      "Sambag",
      "Sto. Rosario",
      "San Vicente",
      "LPC",
    ],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Saturday",
  },
  "6": {
    crew: [
      "Arnel Casiano",
      "Marjun Ylanan",
      "Jade Silad",
    ],
    areas: [
      "Gairan",
      "Nailon",
    ],
    time: "07:00",
    endTime: "15:00",
    type: "Dili Malata",
    frequency: "Daily",
    dayOff: "Saturday",
  },
};
const AREAS = [
  "Gairan",
  "Don Pedro",
  "Polambato",
  "Cayang",
  "TayTayan",
  "Cogon",
  "Sto. Nino",
  "Sudlonon",
  "Lourdes",
  "Carbon",
  "Pandan",
  "Bungtod",
  "ARAPAL Farm",
  "Bungtod (Maharat & Laray)",
  "Dakit (Highway & Provincial Rd)",
  "Malingin Highway",
  "A/B Cogon",
  "Siocon",
  "Odlot",
  "Marangong",
  "Libertad",
  "Guadalupe",
];
const WASTE_TYPES = ["Malata", "Dili Malata"];
const FREQUENCIES = [
  "Daily",
  "Every Monday",
  "Every Tuesday",
  "Every Wednesday",
  "Every Thursday",
  "Every Friday",
  "Every Saturday",
];
const DAYS_OFF = ["Saturday", "Sunday"];

// const DAYS = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT', 'SUN'];

// Color palette for routes
const ROUTE_COLORS = [
  "#28a745", // green
  "#007bff", // blue
  "#ffc107", // yellow
  "#6f42c1", // purple
  "#e83e8c", // pink
  "#fd7e14", // orange
  "#17a2b8", // teal
  "#dc3545", // red
  "#20c997", // cyan
  "#343a40", // dark gray
];

// Helper to format time as 12-hour with AM/PM
function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${ampm}`;
}

// Helpers for time validation
function isAM(timeStr) {
  if (!timeStr) return false;
  const hour = parseInt(timeStr.split(":")[0], 10);
  return hour < 12; // 00:00 - 11:59
}

function getMinEndTime(startTime) {
  if (!startTime) return "12:00";
  if (isAM(startTime)) {
    // If collection starts in the morning, end time must be PM
    return "12:00";
  }
  // If starts in PM, end time must be later than or equal to start
  return startTime;
}

// Helper function to convert technical errors to user-friendly messages
function getUserFriendlyError(error, context = "operation") {
  if (!error) return "Something went wrong. Please try again.";
  
  // Extract error message
  let errorMessage = "";
  if (typeof error === "string") {
    errorMessage = error.toLowerCase();
  } else if (error?.message) {
    errorMessage = error.message.toLowerCase();
  } else {
    errorMessage = String(error).toLowerCase();
  }

  // Network/connection errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("failed to fetch")
  ) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }

  // Authentication/permission errors
  if (
    errorMessage.includes("auth") ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("forbidden") ||
    errorMessage.includes("row-level security")
  ) {
    return "You don't have permission to perform this action. Please log in again or contact your administrator.";
  }

  // Duplicate/unique constraint errors
  if (
    errorMessage.includes("duplicate") ||
    errorMessage.includes("unique") ||
    errorMessage.includes("already exists") ||
    errorMessage.includes("violates unique constraint")
  ) {
    if (context.includes("route")) {
      return "This route number is already in use. Please select a different route number.";
    }
    return "This item already exists. Please use a different value.";
  }

  // Not found errors
  if (
    errorMessage.includes("not found") ||
    errorMessage.includes("does not exist")
  ) {
    return "The requested schedule could not be found. It may have been deleted.";
  }

  // Foreign key/constraint errors
  if (
    errorMessage.includes("foreign key") ||
    errorMessage.includes("constraint") ||
    errorMessage.includes("violates foreign key")
  ) {
    return "This action cannot be completed because the schedule is linked to other data. Please remove the links first.";
  }

  // Validation errors
  if (
    errorMessage.includes("required") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("validation")
  ) {
    return "Please check your input and make sure all required fields are filled correctly.";
  }

  // Timeout errors
  if (errorMessage.includes("timeout")) {
    return "The request took too long. Please try again.";
  }

  // Database errors
  if (errorMessage.includes("postgres") || errorMessage.includes("database")) {
    if (context.includes("add") || context.includes("insert")) {
      return "Unable to save the schedule. Please check your input and try again.";
    }
    if (context.includes("update") || context.includes("edit")) {
      return "Unable to update the schedule. Please try again.";
    }
    return "Unable to complete the operation. Please try again in a moment.";
  }

  // Default context-specific messages
  if (context.includes("add") || context.includes("insert")) {
    return "Unable to add the schedule. Please check your input and try again.";
  }
  if (context.includes("update") || context.includes("edit")) {
    return "Unable to update the schedule. Please try again.";
  }
  if (context.includes("fetch") || context.includes("load")) {
    return "Unable to load data. Please refresh the page.";
  }

  // Generic fallback
  return "Something went wrong. Please try again.";
}

const Schedule = () => {
  const [routes, setRoutes] = useState([]);
  const [, setSelectedRoute] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null); // null for add, id for edit
  const [form, setForm] = useState(emptyRoute);
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [loading, setLoading] = useState(true);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoRoute] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalType, setSuccessModalType] = useState("add"); // "add" or "update"

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      try {
        const { data, error } = await supabase
          .from("routes")
          .select("*")
          .order("route");

        if (error) {
          console.error("Error fetching routes:", error);
          setSnackbar({
            open: true,
            message: getUserFriendlyError(error, "load schedules"),
            severity: "error",
          });
          setLoading(false);
          return;
        }

        if (isMounted) {
          setRoutes(data || []);
          // Always set selectedRoute to the first route if none is selected or if the selected route was deleted
          if (data && data.length > 0) {
            setSelectedRoute((prev) =>
              prev && data.some((r) => r.id === prev) ? prev : data[0].id
            );
          } else {
            setSelectedRoute(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in fetchRoutes:", error);
        if (isMounted) {
          setSnackbar({
            open: true,
            message: getUserFriendlyError(error, "load schedules"),
            severity: "error",
          });
          setLoading(false);
        }
      }
    };

    fetchRoutes();

    // Set up real-time subscription
    const channel = supabase
      .channel("routes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "routes" },
        () => fetchRoutes()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line
  }, []); // selectedRoute is intentionally not included to avoid infinite loop

  const [collectors, setCollectors] = useState([]);
  useEffect(() => {
    let isMounted = true;
    const fetchCollectors = async () => {
      const { data, error } = await supabase
        .from("collectors")
        .select("*")
        .order("driver", { ascending: true });
      if (!error && isMounted) {
        setCollectors(data || []);
      }
    };
    fetchCollectors();
    const channel = supabase
      .channel("collectors-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collectors" },
        () => fetchCollectors()
      )
      .subscribe();
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Get all drivers and all crew from collectors
  const allDrivers = collectors
    .filter((c) => c.status === "active")
    .map((c) => c.driver)
    .filter(Boolean);
  const allCrew = collectors.flatMap((c) =>
    (c.crew || []).map((member) =>
      typeof member === "string"
        ? member
        : [member.firstName, member.lastName].filter(Boolean).join(" ")
    )
  );

  // Compute available crew options: hide those already assigned to other routes
  const normalizeCrewName = (member) =>
    typeof member === "string"
      ? member.trim()
      : [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim();

  const assignedCrewOnOtherRoutes = new Set(
    (routes || [])
      .filter((r) => !editId || r.id !== editId)
      .flatMap((r) => (r.crew || []).map((m) => normalizeCrewName(m)))
      .filter(Boolean)
  );

  const availableCrewOptions = Array.from(
    new Set(
      [
        ...((allCrew || [])
          .map((m) => normalizeCrewName(m))
          .filter(Boolean)
          // Hide crew already assigned to other routes when adding a new route
          // For edit mode, still hide crew assigned to other routes but allow the ones already on this route via union below
          .filter((name) => !assignedCrewOnOtherRoutes.has(name))),
        // Always include currently selected crew so they remain visible
        ...((form.crew || []).filter(Boolean)),
      ]
    )
  );

  // Compute available driver options: hide those already assigned to other routes
  const normalizeDriverName = (driver) => (driver || "").trim().toLowerCase();

  const assignedDriversOnOtherRoutes = new Set(
    (routes || [])
      .filter((r) => !editId || r.id !== editId)
      .map((r) => normalizeDriverName(r.driver))
      .filter(Boolean)
  );

  // Build a map of normalized names to original names for proper casing
  const driverNameMap = new Map();
  allDrivers.forEach((driver) => {
    const normalized = normalizeDriverName(driver);
    if (!driverNameMap.has(normalized)) {
      driverNameMap.set(normalized, driver);
    }
  });

  const availableDriverOptions = Array.from(
    new Set(
      [
        ...((allDrivers || [])
          .map((d) => normalizeDriverName(d))
          .filter(Boolean)
          // Hide drivers already assigned to other routes when adding a new route
          // For edit mode, still hide drivers assigned to other routes but allow the one already on this route via union below
          .filter((name) => !assignedDriversOnOtherRoutes.has(name))),
        // Always include currently selected driver so they remain visible
        ...(form.driver ? [normalizeDriverName(form.driver)] : []),
      ]
    )
  )
    .map((normalized) => {
      // Find the original driver name (with proper casing) from the map or use form.driver as fallback
      return driverNameMap.get(normalized) || form.driver;
    })
    .filter(Boolean);

  // Compute available route numbers: hide those already assigned to other routes
  const assignedRouteNumbers = new Set(
    (routes || [])
      .filter((r) => !editId || r.id !== editId)
      .map((r) => String(r.route || "").trim())
      .filter(Boolean)
  );

  const availableRouteNumbers = Array.from(
    new Set(
      [
        ...ROUTE_NUMBERS.filter((num) => !assignedRouteNumbers.has(num)),
        // Always include currently selected route number so it remains visible when editing
        ...(form.route ? [form.route] : []),
      ]
    )
  );

  // Form validation
  const validate = () => {
    const errors = {};
    if (!form.route) errors.route = "Route number is required";
    if (!form.driver) errors.driver = "Driver is required";
    const crewArray = Array.isArray(form.crew) ? form.crew : [];
    if (!crewArray.filter((c) => {
      const crewStr = typeof c === "string" ? c : (c?.firstName && c?.lastName ? `${c.firstName} ${c.lastName}` : String(c));
      return crewStr.trim();
    }).length) {
      errors.crew = "At least one crew member";
    }
    const areasArray = Array.isArray(form.areas) ? form.areas : [];
    if (!areasArray.filter((a) => {
      const areaStr = typeof a === "string" ? a : String(a);
      return areaStr.trim();
    }).length) {
      errors.areas = "At least one area";
    }
    if (!form.time) errors.time = "Collection start time is required";
    if (!form.endTime) errors.endTime = "Collection end time is required";
    // Additional time validation: if start is AM, end must be PM
    if (form.time && form.endTime) {
      const [sh, sm] = form.time.split(":").map((n) => parseInt(n, 10));
      const [eh, em] = form.endTime.split(":").map((n) => parseInt(n, 10));
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (isAM(form.time) && endMinutes < 12 * 60) {
        errors.endTime = "End time must be in the afternoon (PM).";
      }
      if (endMinutes <= startMinutes) {
        errors.endTime = "End time must be after start time.";
      }
    }
    if (!form.type) errors.type = "Waste type is required";
    if (!form.frequency) errors.frequency = "Frequency is required";
    if (!form.dayOff) errors.dayOff = "Day off is required";
    if (form.date && dayjs(form.date).isBefore(dayjs(), "day")) {
      errors.date = "Cannot add a schedule for a past date.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
    if (name === "route") {
      setForm((prev) => {
        const next = { ...prev, route: value };
        // Only auto-fill when adding a new schedule (not editing)
        if (!editId && ROUTE_PRESETS[value]) {
          const p = ROUTE_PRESETS[value];
          next.crew = [...p.crew];
          next.areas = [...p.areas];
          next.time = p.time;
          next.endTime = p.endTime;
          next.type = p.type;
          next.frequency = p.frequency;
          next.dayOff = p.dayOff;
        }
        return next;
      });
      return;
    }
    if (name === "time") {
      setForm((prev) => {
        const next = { ...prev, time: value };
        // If start time is AM, auto-bump end time to 12:00 PM when missing or AM
        if (isAM(value)) {
          const shouldBump = !prev.endTime || isAM(prev.endTime);
          if (shouldBump) {
            next.endTime = "12:00";
          }
        } else if (prev.endTime) {
          // If start is PM and end exists but is earlier, align end to start
          const [sh, sm] = value.split(":").map((n) => parseInt(n, 10));
          const [eh, em] = prev.endTime.split(":").map((n) => parseInt(n, 10));
          const startMinutes = sh * 60 + sm;
          const endMinutes = eh * 60 + em;
          if (endMinutes < startMinutes) {
            next.endTime = value;
          }
        }
        return next;
      });
      return;
    }
    if (name === "endTime") {
      // Prevent AM selection when start time is AM
      if (form.time && isAM(form.time) && isAM(value)) {
        // Don't update the end time if trying to set AM when start is AM
        return;
      }
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🚀 handleSubmit called, editId:", editId);
    console.log("📝 Form data:", form);
    const isValid = validate();
    console.log("✅ Validation result:", isValid);
    if (!isValid) {
      console.log("❌ Validation failed, errors:", formErrors);
      return;
    }

    try {
      // Check for crew assignment conflicts
      const { data: allRoutes, error: routesError } = await supabase
        .from("routes")
        .select("*");

      if (routesError) {
        console.error("Error fetching routes for conflict check:", routesError);
        setSnackbar({
          open: true,
          message: getUserFriendlyError(routesError, "check conflicts"),
          severity: "error",
        });
        return;
      }

      let newCrewMembers = form.crew || [];
      if (typeof newCrewMembers === "string") {
        newCrewMembers = newCrewMembers.split(",").map((c) => c.trim());
      }
      newCrewMembers = newCrewMembers.filter((c) => c); // removes blanks
      // Prevent assigning same driver to multiple routes (unless editing same record)
      const driverName = (form.driver || "").trim().toLowerCase();
      if (driverName) {
        const conflictingDriverRoute = allRoutes.find(
          (route) =>
            route.driver &&
            route.driver.trim().toLowerCase() === driverName &&
            (!editId || route.id !== editId)
        );
        if (conflictingDriverRoute) {
          setSnackbar({
            open: true,
            message: `Driver "${form.driver}" is already assigned to Route ${conflictingDriverRoute.route}. Please select a different driver or edit that route instead.`,
            severity: "error",
          });
          return;
        }
      }

      // Check if any crew members are already assigned to other routes
      const assignedCrewMembers = [];
      for (const route of allRoutes) {
        // Skip the current route if editing
        if (editId && route.id === editId) continue;

        if (route.crew && Array.isArray(route.crew)) {
          for (const routeCrewMember of route.crew) {
            for (const newCrewMember of newCrewMembers) {
              if (routeCrewMember === newCrewMember) {
                assignedCrewMembers.push({
                  name: newCrewMember,
                  route: route.route,
                  driver: route.driver,
                });
              }
            }
          }
        }
      }

      // If crew members are already assigned, show error
      if (assignedCrewMembers.length > 0) {
        const crewList = assignedCrewMembers
          .map((c) => `${c.name} (Route ${c.route})`)
          .join("");
        setSnackbar({
          open: true,
          message: `Crew already assigned: ${crewList}`,
          severity: "error",
        });
        return;
      }

      // Always ensure coordinates is an array
      let coords = Array.isArray(form.coordinates) ? form.coordinates : [];
      // If only one coordinate, duplicate it
      if (coords.length === 1) {
        coords = [coords[0], coords[0]];
      }
      // Clean crew and areas to remove empty/whitespace-only entries
      const cleanedCrew = (Array.isArray(form.crew) ? form.crew : [])
        .map((c) => (typeof c === "string" ? c.trim() : c))
        .filter((c) => (typeof c === "string" ? c.length > 0 : !!c));
      const cleanedAreas = (Array.isArray(form.areas) ? form.areas : [])
        .map((a) => (typeof a === "string" ? a.trim() : a))
        .filter((a) => (typeof a === "string" ? a.length > 0 : !!a));

      // Build payload, only including defined values
      const normalizedPayload = {};
      if (form.route !== undefined) normalizedPayload.route = form.route || null;
      if (form.driver !== undefined) normalizedPayload.driver = form.driver || null;
      if (form.type !== undefined) normalizedPayload.type = form.type || "";
      if (form.time !== undefined) normalizedPayload.time = form.time || "";
      if (form.endTime !== undefined || form.end_time !== undefined) {
        normalizedPayload.end_time = form.endTime || form.end_time || "";
      }
      if (form.frequency !== undefined) normalizedPayload.frequency = form.frequency || "";
      if (cleanedAreas !== undefined) normalizedPayload.areas = cleanedAreas;
      if (coords !== undefined) normalizedPayload.coordinates = coords;
      if (cleanedCrew !== undefined) normalizedPayload.crew = cleanedCrew;
      if (form.dayOff !== undefined || form.dayoff !== undefined) {
        normalizedPayload.dayoff = form.dayOff || form.dayoff || "";
      }
      if (form.color !== undefined && form.color) {
        normalizedPayload.color = form.color;
      }
      if (editId) {
        console.log("🔄 Updating route with ID:", editId);
        console.log("📦 Payload:", normalizedPayload);
        
        // Update without select to avoid RLS issues with SELECT after UPDATE
        const { error: updateError } = await supabase
          .from("routes")
          .update(normalizedPayload)
          .eq("id", editId);

        if (updateError) {
          console.error("❌ Error updating route:", updateError);
          setSnackbar({
            open: true,
            message: getUserFriendlyError(updateError, "update schedule"),
            severity: "error",
          });
          return;
        }

        console.log("✅ Update query executed successfully");
        
        // Close the edit modal immediately
        closeModal();
        
        // Show success modal immediately
        setSuccessModalType("update");
        setSuccessModalOpen(true);
        
        // Optimistically update the local state
        setRoutes((prevRoutes) =>
          prevRoutes.map((route) =>
            route.id === editId ? { ...route, ...normalizedPayload } : route
          )
        );
        
        // Refetch routes in the background to ensure data consistency
        supabase
          .from("routes")
          .select("*")
          .order("route")
          .then(({ data: refreshedRoutes, error: refreshError }) => {
            if (refreshError) {
              console.error("⚠️ Error refreshing routes after update:", refreshError);
              // Silently fail - user already sees success, data will sync on next page load
              return;
            }
            
            if (refreshedRoutes) {
              setRoutes(refreshedRoutes);
              console.log("🔄 Routes refreshed successfully:", refreshedRoutes.length);
            }
          });
      } else {
        // Assign a color based on route number or random if not available
        let color = ROUTE_COLORS[parseInt(form.route, 10) - 1];
        if (!color) {
          color = ROUTE_COLORS[Math.floor(Math.random() * ROUTE_COLORS.length)];
        }
        const routeWithColor = { ...normalizedPayload, color };

        const { error: insertError } = await supabase
          .from("routes")
          .insert([routeWithColor]);

        if (insertError) {
          console.error("Error adding route:", insertError);
          setSnackbar({
            open: true,
            message: getUserFriendlyError(insertError, "add schedule"),
            severity: "error",
          });
          return;
        }

        setSuccessModalType("add");
        setSuccessModalOpen(true); // Show success modal
        closeModal();
      }
    } catch (err) {
      console.error("Unexpected error in handleSubmit:", err);
      const context = editId ? "update schedule" : "add schedule";
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
              {availableDriverOptions.map((driver) => (
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
              {availableCrewOptions.map((crew) => (
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
      <Dialog open={infoModalOpen} onClose={() => setInfoModalOpen(false)}>
        <DialogTitle>Schedule Info</DialogTitle>
        <DialogContent>
          {infoRoute && (
            <>
              <Typography>
                <b>Route:</b> {infoRoute.route}
              </Typography>
              <Typography>
                <b>Driver:</b> {infoRoute.driver}
              </Typography>
              <Typography>
                <b>Crew:</b> {infoRoute.crew && infoRoute.crew.join(", ")}
              </Typography>
              <Typography>
                <b>Areas:</b> {infoRoute.areas && infoRoute.areas.join(", ")}
              </Typography>
              <Typography>
                <b>Collection Time:</b> {infoRoute.time}
              </Typography>
              <Typography>
                <b>Waste Type:</b> {infoRoute.type}
              </Typography>
              <Typography>
                <b>Frequency:</b> {infoRoute.frequency}
              </Typography>
              <Typography>
                <b>Day Off:</b> {infoRoute.dayOff}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoModalOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
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