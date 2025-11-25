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
import PredictionDb from "./pages/PredictionDb";
import LogoutModal from "./components/LogoutModal";
import "./App.css";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { supabase } from "./supabaseClient";

function App() {
  const [page, setPage] = useState("Dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [collectionNotifications, setCollectionNotifications] = useState([]);
  const [adminName, setAdminName] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snapshot) => {
      const unresolved = snapshot.docs.filter(doc => doc.data().status === "unresolved").length;
      setUnresolvedCount(unresolved);
    });
    return () => unsub();
  }, []);

  // Collection notifications listener
  useEffect(() => {
    let isMounted = true;

    console.log("Setting up collection notifications listener...");


    const channel = supabase
      .channel("collections-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "collections" },
        (payload) => {
          console.log("Realtime event received:", payload);
          if (!isMounted) return;

          const newCollection = payload.new;
          console.log("New collection recorded:", newCollection);

          // Create notification
          const notification = {
            id: Date.now(),
            type: "collection",
            title: "Garbage Collection Completed",
            message: `${newCollection.collector_name || "A collector"} completed waste collection`,
            timestamp: new Date(),
            data: newCollection,
            read: false
          };

          setCollectionNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep only last 10

          // Optional: Show browser notification if permission granted
          if (Notification.permission === "granted") {
            new Notification("G-Waste Collection", {
              body: `${newCollection.collector_name || "A collector"} completed waste collection`,
              icon: "/favicon.ico"
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to collections changes");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Failed to subscribe to collections changes");
        }
      });

    return () => {
      isMounted = false;
      // console.log("Cleaning up collection notifications listener");
      supabase.removeChannel(channel);
    };
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
      case "PredictionDb":
        return <PredictionDb />;
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
        <Topbar
          onLogout={handleShowLogout}
          unresolvedCount={unresolvedCount}
          collectionNotifications={collectionNotifications}
          adminName={adminName}
        />
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
