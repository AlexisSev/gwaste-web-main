
import React, { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Map,
  UsersRound,
  AlertTriangle,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Brain,
  LogOut,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import "../App.css";

const navItems = [
  { key: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "Schedule", label: "Schedule", icon: CalendarDays },
  { key: "MapTracking", label: "Map", icon: Map },
  { key: "Collector", label: "Collector", icon: UsersRound },
];

// Reports & Insights submenu items
const reportsItems = [
  { key: "Reports", label: "Issues", icon: AlertTriangle, indicator: true },
  { key: "History", label: "History", icon: HistoryIcon },
  // { key: "RoutePerformanceAI", label: "Prediction", icon: Brain },
  { key: "WastePrediction", label: "Waste AI", icon: Brain },
];

const Sidebar = ({
  onNavigate,
  currentPage,
  onLogout,
  adminName = "",
  adminEmail = "",
  unresolvedCount = 0,
}) => {
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const displayName = (adminName && adminName.trim()) || adminEmail || "Admin";
  const secondaryLabel =
    adminName && adminEmail && adminEmail !== adminName ? adminEmail : "";

  // Check if any reports item is active
  const isReportsActive = reportsItems.some(item => item.key === currentPage);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-mark">
          <img src="/logo.png" alt="G-Waste Logo" className="sidebar-logo-img" />
        </div>
        <div>
          <p>{displayName}</p>
          <small>{adminEmail}</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ key, label, icon: Icon, indicator }) => (
          <button
            key={key}
            type="button"
            className={`sidebar-link ${currentPage === key ? "active" : ""}`}
            onClick={() => onNavigate(key)}
          >
            <span className="sidebar-link__icon">
              <Icon size={16} />
            </span>
            <span>{label}</span>
            {indicator && <span className="sidebar-indicator" />}
          </button>
        ))}

        {/* Reports & Insights Collapsible Section */}
        <div className="sidebar-group">
          <button
            type="button"
            className={`sidebar-group-header ${isReportsActive ? "active" : ""}`}
            onClick={() => setIsReportsOpen(!isReportsOpen)}
          >
            <span className="sidebar-link__icon">
              <FileText size={16} />
            </span>
            <span>Reports & Insights</span>
            <span className="sidebar-group-chevron">
              {isReportsOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
          </button>
          
          {isReportsOpen && (
            <div className="sidebar-group-content">
              {reportsItems.map(({ key, label, icon: Icon, indicator }) => (
                <button
                  key={key}
                  type="button"
                  className={`sidebar-link sidebar-link--nested ${
                    currentPage === key ? "active" : ""
                  }`}
                  onClick={() => onNavigate(key)}
                >
                  <span className="sidebar-link__icon">
                    <Icon size={18} />
                  </span>
                  <span>{label}</span>
                  {key === "Reports" && unresolvedCount > 0 ? (
                    <span className="sidebar-badge">{unresolvedCount}</span>
                  ) : indicator && <span className="sidebar-indicator" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          type="button"
          className={`sidebar-link ${currentPage === "Settings" ? "active" : ""}`}
          onClick={() => onNavigate("Settings")}
        >
          <span className="sidebar-link__icon">
            <SettingsIcon size={16} />
          </span>
          <span>Settings</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div>
            <p>{displayName}</p>
            {secondaryLabel && <span>{secondaryLabel}</span>}
          </div>
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;