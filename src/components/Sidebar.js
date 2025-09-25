import React from "react";
import {
  FaTachometerAlt,
  FaCalendarAlt,
  FaMap,
  FaUserTie,
  FaChartBar,
  FaExclamationTriangle,
  FaCog,
  FaSignOutAlt,
} from "react-icons/fa";
import "../App.css";

const Sidebar = ({ onNavigate, currentPage, onLogout }) => {
  return (
    <div className="sidebar custom-sidebar">
      <div className="sidebar-logo-section">
        <span className="sidebar-logo-text">G-Waste</span>
      </div>
      <div className="sidebar-menu-section">
        <div className="sidebar-menu-group">
          {/* <span className="sidebar-menu-label">Main</span> */}
          <ul className="nav-links custom-nav-links">
            <li
              onClick={() => onNavigate("Dashboard")}
              className={currentPage === "Dashboard" ? "active" : ""}
            >
              <FaTachometerAlt /> Dashboard
            </li>
            <li
              onClick={() => onNavigate("Schedule")}
              className={currentPage === "Schedule" ? "active" : ""}
            >
              <FaCalendarAlt /> Schedule
            </li>
            <li
              onClick={() => onNavigate("ViewMap")}
              className={currentPage === "ViewMap" ? "active" : ""}
            >
              <FaMap /> Map
            </li>
            <li
              onClick={() => onNavigate("Collector")}
              className={currentPage === "Collector" ? "active" : ""}
            >
              <FaUserTie /> Collector
            </li>
            <li
              onClick={() => onNavigate("Reports")}
              className={currentPage === "Reports" ? "active" : ""}
            >
              <FaExclamationTriangle /> Issues
              <span className="sidebar-badge"></span>
            </li>
            <li
              onClick={() => onNavigate("Settings")}
              className={currentPage === "Settings" ? "active" : ""}
            >
              <FaCog /> Settings
            </li>
            <li
              onClick={onLogout}
              className="logout-link"
              style={{ color: '#e74c3c', marginTop: '2rem', cursor: 'pointer' }}
            >
              <FaSignOutAlt style={{ marginRight: 10 }} /> Logout
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
