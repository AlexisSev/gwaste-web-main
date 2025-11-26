import React, { useState, useEffect } from "react";
import "./Settings.css";
import ProfileImg from "../logo.svg";
import PageHero from "../components/PageHero";

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
      <PageHero
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your profile, login credentials, and notification preferences."
      />

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
              <label className="settings-btn green">
                Change photo
                <input type="file" accept="image/*" className="hidden-input" onChange={handleChangePhoto} />
              </label>
              <button className="settings-btn red" onClick={handleDeletePhoto}>Delete Photo</button>
            </div>
          </div>

          <div className="settings-profile-label">Profile name</div>
          <div className="settings-profile-name-placeholder">{profileName}</div>

          <div className="settings-profile-label">Email</div>
          <div className="settings-profile-name-placeholder">{profileEmail}</div>
        </div>
      )}

      {activeTab === 1 && (
        <form className="settings-account-section" onSubmit={handleChangePassword}>
          <label className="settings-profile-label">Current Password</label>
          <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="settings-input" />

          <label className="settings-profile-label">New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="settings-input" />

          <label className="settings-profile-label">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="settings-input" />

          <button className="settings-btn green" type="submit">Change Password</button>
        </form>
      )}

      {activeTab === 2 && (
        <form className="settings-account-section" onSubmit={handleChangeEmail}>
          <label className="settings-profile-label">New Email</label>
          <input type="email" value={changeEmail} onChange={e => setChangeEmail(e.target.value)} className="settings-input" />
          <button className="settings-btn green" type="submit">Change Email</button>
        </form>
      )}

      {activeTab === 3 && (
        <form className="settings-account-section" onSubmit={handleEditInfo}>
          <label className="settings-profile-label">Edit Name</label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="settings-input" />

          <label className="settings-profile-label">Edit Email</label>
          <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="settings-input" />

          <button className="settings-btn green" type="submit">Save Changes</button>
        </form>
      )}

      {message && <div className="settings-message">{message}</div>}
    </div>
  );
};

export default Settings;
