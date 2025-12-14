/**
 * Utility functions for Schedule component calculations and processing
 */

import dayjs from "dayjs";

// Constants
export const emptyRoute = {
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

export const ROUTE_NUMBERS = ["1", "2", "3", "4", "5", "6"];

export const ROUTE_PRESETS = {
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

export const AREAS = [
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

export const WASTE_TYPES = ["Malata", "Dili Malata"];

export const FREQUENCIES = [
  "Daily",
  "Every Monday",
  "Every Tuesday",
  "Every Wednesday",
  "Every Thursday",
  "Every Friday",
  "Every Saturday",
];

export const DAYS_OFF = ["Saturday", "Sunday"];

// Route colors
export const ROUTE_COLORS = [
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

// Time formatting utility
export function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${ampm}`;
}

// Time validation helpers
export function isAM(timeStr) {
  if (!timeStr) return false;
  const hour = parseInt(timeStr.split(":")[0], 10);
  return hour < 12; // 00:00 - 11:59
}

export function getMinEndTime(startTime) {
  if (!startTime) return "12:00";
  if (isAM(startTime)) {
    // If collection starts in the morning, end time must be PM
    return "12:00";
  }
  // If starts in PM, end time must be later than or equal to start
  return startTime;
}

// Error handling
export function getUserFriendlyError(error, context = "operation") {
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

  // Context-specific messages
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

// Form validation
export function validateForm(form, routes, editId) {
  const errors = {};
  if (!form.route) errors.route = "Route number is required";

  // Convert crew and areas to arrays if they're strings
  const crewArray = Array.isArray(form.crew) ? form.crew : (form.crew ? [form.crew] : []);
  const areasArray = Array.isArray(form.areas) ? form.areas : (form.areas ? [form.areas] : []);

  if (!crewArray.length) {
    errors.crew = "At least one crew member is required";
  }
  if (!areasArray.length) {
    errors.areas = "At least one area is required";
  }
  if (!form.driver) errors.driver = "Driver is required";
  if (!form.time) errors.time = "Collection start time is required";
  if (!form.endTime) errors.endTime = "Collection end time is required";

  // Time validation: if start is AM, end must be PM
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

  // Check for driver conflicts
  if (form.driver && form.driver.trim()) {
    const driverName = form.driver.trim().toLowerCase();
    const conflictingDriverRoute = routes.find(
      (route) =>
        route.driver &&
        route.driver.trim().toLowerCase() === driverName &&
        (!editId || route.id !== editId)
    );
    if (conflictingDriverRoute) {
      errors.driver = `Driver "${form.driver}" is already assigned to Route ${conflictingDriverRoute.route}`;
    }
  }

  // Check for crew conflicts
  const assignedCrewMembers = [];
  const newCrewMembers = Array.isArray(form.crew) ? form.crew : (form.crew ? [form.crew] : []);
  for (const route of routes) {
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

  // If crew members are already assigned, add error
  if (assignedCrewMembers.length > 0) {
    const crewList = assignedCrewMembers
      .map((c) => `${c.name} (Route ${c.route})`)
      .join("");
    errors.crew = `Crew already assigned: ${crewList}`;
  }

  return errors;
}

// Calculate available drivers
export function getAvailableDrivers(collectors, routes, editId) {
  const allDrivers = collectors
    .filter((c) => c.status === "active")
    .map((c) => c.driver)
    .filter(Boolean);

  const assignedDriversOnOtherRoutes = new Set(
    routes
      .filter((r) => !editId || r.id !== editId)
      .map((r) => (r.driver || "").trim().toLowerCase())
      .filter(Boolean)
  );

  // Build a map of normalized names to original names for proper casing
  const driverNameMap = new Map();
  allDrivers.forEach((driver) => {
    const normalized = (driver || "").trim().toLowerCase();
    if (!driverNameMap.has(normalized)) {
      driverNameMap.set(normalized, driver);
    }
  });

  return Array.from(
    new Set(
      [
        ...allDrivers
          .map((d) => (d || "").trim().toLowerCase())
          .filter(Boolean)
          .filter((name) => !assignedDriversOnOtherRoutes.has(name)),
        // Always include currently selected driver so they remain visible
        editId && routes.find(r => r.id === editId)?.driver ?
          (routes.find(r => r.id === editId).driver || "").trim().toLowerCase() : null
      ].filter(Boolean)
    )
  ).map((normalized) => driverNameMap.get(normalized) || normalized);
}

// Calculate available crew
export function getAvailableCrew(collectors, routes, editId, currentFormCrew) {
  const allCrew = collectors.flatMap((c) =>
    (c.crew || []).map((member) =>
      typeof member === "string"
        ? member.trim()
        : [member.firstName, member.lastName].filter(Boolean).join(" ").trim()
    )
  );

  const assignedCrewOnOtherRoutes = new Set(
    routes
      .filter((r) => !editId || r.id !== editId)
      .flatMap((r) => (r.crew || []).map((m) => (m || "").trim().toLowerCase()))
      .filter(Boolean)
  );

  return Array.from(
    new Set([
      ...allCrew
        .map((m) => (m || "").trim().toLowerCase())
        .filter(Boolean)
        .filter((name) => !assignedCrewOnOtherRoutes.has(name)),
      ...(currentFormCrew || []).map((c) => (c || "").trim().toLowerCase()),
    ].filter(Boolean))
  );
}

// Calculate available route numbers
export function getAvailableRouteNumbers(routes, editId, currentRoute) {
  const assignedRouteNumbers = new Set(
    routes
      .filter((r) => !editId || r.id !== editId)
      .map((r) => String(r.route || "").trim())
      .filter(Boolean)
  );

  return Array.from(
    new Set([
      ...ROUTE_NUMBERS.filter((num) => !assignedRouteNumbers.has(num)),
      // Always include currently selected route number so it remains visible when editing
      currentRoute ? String(currentRoute).trim() : null,
    ].filter(Boolean))
  );
}
