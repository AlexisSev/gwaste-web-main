import React, { useState } from "react";
import "./Settings.css";
import ProfileImg from "../logo.svg";
import { useEffect } from "react";

const tabs = [
  { label: "Account" },
  { label: "Change Password" },
  { label: "Change Email" },
  { label: "Edit Info" },
];

const Settings = ({ adminName = '', adminEmail = '' }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [profileName, setProfileName] = useState(adminName);
  const [profileEmail, setProfileEmail] = useState(adminEmail);
  const [profileImg, setProfileImg] = useState(localStorage.getItem('profileImg') || ProfileImg);
  const [editName, setEditName] = useState(adminName);
  const [editEmail, setEditEmail] = useState(adminEmail);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeEmail, setChangeEmail] = useState(adminEmail);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setProfileImg(localStorage.getItem('profileImg') || ProfileImg);
  }, []);

  const handleChangePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfileImg(ev.target.result);
      localStorage.setItem('profileImg', ev.target.result);
    };
    reader.readAsDataURL(file);
  };
  const handleDeletePhoto = () => {
    setProfileImg(ProfileImg);
    localStorage.removeItem('profileImg');
  };

  const handleEditInfo = (e) => {
    e.preventDefault();
    setProfileName(editName);
    setProfileEmail(editEmail);
    setMessage('Profile info updated!');
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }
    setMessage('Password changed! (Simulated)');
  };

  const handleChangeEmail = (e) => {
    e.preventDefault();
    if (!changeEmail) {
      setMessage('Please enter a new email.');
      return;
    }
    setProfileEmail(changeEmail);
    setMessage('Email changed! (Simulated)');
  };

  return (
    <div className="settings-container">
      <h1 className="settings-title">Settings</h1>
      <div className="settings-tabs">
        {tabs.map((tab, idx) => (
          <button
            key={tab.label}
            className={`settings-tab${activeTab === idx ? " active" : ""}`}
            onClick={() => { setActiveTab(idx); setMessage(''); }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 0 && (
        <div className="settings-account-section">
          <div className="settings-profile-label">Profile Picture</div>
          <div className="settings-profile-row">
            <img src={profileImg} alt="Profile" className="settings-profile-img" />
            <div className="settings-profile-btns">
              <label className="settings-btn green" style={{ cursor: 'pointer' }}>
                Change photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChangePhoto} />
              </label>
              <button className="settings-btn red" onClick={handleDeletePhoto}>Delete Photo</button>
            </div>
          </div>
          <div className="settings-profile-label" style={{ marginTop: 32 }}>Profile name</div>
          <div className="settings-profile-name-placeholder">{profileName}</div>
          <div className="settings-profile-label" style={{ marginTop: 18 }}>Email</div>
          <div className="settings-profile-name-placeholder">{profileEmail}</div>
        </div>
      )}
      {activeTab === 1 && (
        <form className="settings-account-section" onSubmit={handleChangePassword}>
          <div className="settings-profile-label">Current Password</div>
          <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 12 }} />
          <div className="settings-profile-label">New Password</div>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 12 }} />
          <div className="settings-profile-label">Confirm New Password</div>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 18 }} />
          <button className="settings-btn green" type="submit">Change Password</button>
        </form>
      )}
      {activeTab === 2 && (
        <form className="settings-account-section" onSubmit={handleChangeEmail}>
          <div className="settings-profile-label">New Email</div>
          <input type="email" value={changeEmail} onChange={e => setChangeEmail(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 18 }} />
          <button className="settings-btn green" type="submit">Change Email</button>
        </form>
      )}
      {activeTab === 3 && (
        <form className="settings-account-section" onSubmit={handleEditInfo}>
          <div className="settings-profile-label">Edit Name</div>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 12 }} />
          <div className="settings-profile-label">Edit Email</div>
          <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="settings-profile-name-placeholder" style={{ height: 38, marginBottom: 18 }} />
          <button className="settings-btn green" type="submit">Save Changes</button>
        </form>
      )}
      {message && <div style={{ marginTop: 24, color: '#386D2C', fontWeight: 600 }}>{message}</div>}
    </div>
  );
};

export default Settings;