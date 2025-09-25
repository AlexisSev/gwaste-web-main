import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Schedule from "./pages/Schedule";
import ViewMap from "./pages/ViewMap";
import Collector from "./pages/Collector";
import Reports from "./pages/Reports";
import History from "./pages/History";
import Login from "./pages/Login";
import LogoutModal from "./components/LogoutModal";
import "./App.css";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [adminName, setAdminName] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snapshot) => {
      const unresolved = snapshot.docs.filter(doc => doc.data().status === "unresolved").length;
      setUnresolvedCount(unresolved);
    });
    return () => unsub();
  }, []);

  const handleLogin = (name, email) => {
    setIsLoggedIn(true);
    setAdminName(name);
    setAdminEmail(email);
  };
  const handleLogout = () => {
    setShowLogoutModal(false);
    setIsLoggedIn(false);
  };

  const handleShowLogout = () => setShowLogoutModal(true);
  const handleCancelLogout = () => setShowLogoutModal(false);

  const renderPage = () => {
    switch (page) {
      case "Dashboard":
        return <Dashboard onNavigate={setPage} />;
      case "Schedule":
        return <Schedule />;
      case "ViewMap":
        return <ViewMap />;
      case "Collector":
        return <Collector />;
     
      case "Reports":
        return <Reports />;
      case "History":
        return <History />;
      case "Users":
        return <Users />;
      case "Settings":
        return <Settings adminName={adminName} adminEmail={adminEmail} />;
      default:
        return <Dashboard onNavigate={setPage} />;
    }
  };

  if (!isLoggedIn) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-container">
      <Sidebar onNavigate={setPage} onLogout={handleShowLogout} currentPage={page} />
      <div className="main-content main-content-padding">
        <Topbar onLogout={handleShowLogout} unresolvedCount={unresolvedCount} adminName={adminName} />
        <div className="page-content">{renderPage()}</div>
        <LogoutModal
          isOpen={showLogoutModal}
          onCancel={handleCancelLogout}
          onConfirm={handleLogout}
        />
      </div>
    </div>
  );
}

export default App;
