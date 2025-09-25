import React from "react";
import Modal from "react-modal";
import { FaSignOutAlt } from "react-icons/fa";
import "../App.css";

Modal.setAppElement("#root");

const LogoutModal = ({ isOpen, onCancel, onConfirm }) => {
  return (
    <Modal
      isOpen={isOpen}
      className="modal logout-modal-card"
      overlayClassName="overlay"
      contentLabel="Logout Confirmation"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div className="logout-modal-content">
        <div className="logout-modal-icon">
          <FaSignOutAlt size={38} color="#e74c3c" />
        </div>
        <h2 id="logout-modal-title" className="logout-modal-title">Logout?</h2>
        <p className="logout-modal-message">Are you sure you want to log out of your account?</p>
        <div className="modal-buttons logout-modal-buttons">
          <button className="cancel-btn" onClick={onCancel} aria-label="Cancel logout">Cancel</button>
          <button className="logout-btn" onClick={onConfirm} aria-label="Confirm logout">Logout</button>
        </div>
      </div>
    </Modal>
  );
};

export default LogoutModal;
