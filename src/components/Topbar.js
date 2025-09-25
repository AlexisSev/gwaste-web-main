import React from "react";
import "../App.css";
import logo from "../Profile.jpg";
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useState } from "react";

const Topbar = ({ unresolvedCount, adminName = 'Admin' }) => {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div className="topbar custom-topbar">
      <div className="topbar-left">
        <img src={logo} alt="G-Waste Logo" className="topbar-logo" style={{ height: 38, marginRight: 18 }} />
        <div>
          <div className="topbar-welcome">Welcome,</div>
          <div className="topbar-username">{adminName}</div>
        </div>
      </div>
      <div className="topbar-center">
        <div className="topbar-search-container">
          <SearchIcon className="topbar-search-icon" />
          <input
            className="topbar-search"
            type="text"
            placeholder="Find something"
          />
        </div>
      </div>
      <div className="topbar-right">
        <HelpOutlineIcon className="topbar-icon" style={{ cursor: 'pointer' }} onClick={() => setHelpOpen(true)} />
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <NotificationsNoneIcon className="topbar-icon" />
          {unresolvedCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#e74c3c',
              color: '#fff',
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              padding: '0 5px',
              zIndex: 2,
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)'
            }}>{unresolvedCount}</span>
          )}
        </div>
      </div>
      {helpOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: 32,
            maxWidth: 420,
            width: '90vw',
            boxShadow: '0 8px 32px rgba(51,106,41,0.13)',
            position: 'relative',
          }}>
            <h2 style={{ color: '#386D2C', marginBottom: 18 }}>Help & Quick Tips</h2>
            <ul style={{ color: '#222', fontSize: 16, lineHeight: 1.7, marginBottom: 18 }}>
              <li>To <b>add a collector</b>, click the <b>Add Collector</b> button and fill out the form.</li>
              <li>To <b>edit a driver or crew</b>, click the <b>Edit</b> button on the collector card.</li>
              <li>To <b>view details</b> of a collector, click <b>View Details</b> on their card.</li>
              <li>Use the <b>search bar</b> to quickly find collectors by name.</li>
              <li>Check the <b>Dashboard</b> for total drivers, crew, and route stats.</li>
              <li>Go to <b>Settings</b> to update your profile or change your password.</li>
              <li>Need more help? Contact your system administrator.</li>
            </ul>
            <button
              style={{
                background: '#4B8B3B',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 28px',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
                marginTop: 8,
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Topbar;
