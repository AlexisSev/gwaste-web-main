
import React from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Map,
  UsersRound,
  AlertTriangle,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import "../App.css";

const navItems = [
  { key: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "Schedule", label: "Schedule", icon: CalendarDays },
  { key: "ViewMap", label: "Map", icon: Map },
  { key: "Collector", label: "Collector", icon: UsersRound },
  { key: "Reports", label: "Issues", icon: AlertTriangle, indicator: true },
  { key: "Settings", label: "Settings", icon: SettingsIcon },
];

const Sidebar = ({
  onNavigate,
  currentPage,
  onLogout,
  adminName = "",
  adminEmail = "",
}) => {
  const displayName = (adminName && adminName.trim()) || adminEmail || "Admin";
  const secondaryLabel =
    adminName && adminEmail && adminEmail !== adminName ? adminEmail : "";

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-mark">G</div>
        <div>
          <p>GWaste Admin</p>
          <small>Operations center</small>
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
              <Icon size={18} />
            </span>
            <span>{label}</span>
            {indicator && <span className="sidebar-indicator" />}
          </button>
        ))}
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
