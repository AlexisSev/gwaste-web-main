/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import "./Login.css";

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!credentials.email || !credentials.password) {
        setError("Enter your email and password.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (authError || !authData?.user) {
        const message = authError?.message || "Incorrect email or password.";
        setError(message);
        return;
      }

      const user = authData.user;
      onLogin(user.user_metadata?.name || user.email || "User", user.email);
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="login-split-bg" style={{ display: "flex", minHeight: "100vh" }}>
    <div
      className="login-split-left"
      style={{
        flex: 1,
        backgroundImage: "url('/loginpic.png')", 
        backgroundSize: "cover",                 
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: "brightness(0.95)",              
      }}
    >
    </div>

    {/* RIGHT SIDE (Login Form Card) */}
    <div className="login-split-right">
      <div className="login-card">
        <h2 className="login-title">Log in</h2>
        <p className="login-subtitle">Access your admin dashboard</p>

        {error && <div className="error-message">{error}</div>}

        <form className="login-form-modern" onSubmit={handleSubmit}>
          <div className="input-icon-group">
            <span className="input-icon"><FaUser /></span>
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={credentials.email}
              onChange={handleInputChange}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

    <div className="input-icon-group" style={{ position: "relative" }}>
        <span
          className="input-icon"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#2e7d6b",
          }}
        >
          <FaLock />
        </span>

      <input
        type={showPassword ? "text" : "password"}
        name="password"
        placeholder="Password"
        value={credentials.password}
        onChange={handleInputChange}
        required
        disabled={loading}
        autoComplete="current-password"
        style={{
          width: "100%",
          padding: "10px 40px 10px 36px", // space for icons
          borderRadius: "8px",
          outline: "none",
        }}
      />

      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        disabled={loading}
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#555",
        }}
      >
        {showPassword ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>


          <button type="submit" className="login-btn-modern" disabled={loading}>
            {loading ? "Logging In..." : "Log In"}
          </button>
        </form>

        {/* Divider
        <p style={{ fontSize: "0.9rem", color: "#777", margin: "12px 0" }}>
          or log in with
        </p> */}

        {/* Social Icons
        <div className="login-social-icons">
          <a href="#"><i className="fab fa-google"></i></a>
          <a href="#"><i className="fab fa-facebook-f"></i></a>
          <a href="#"><i className="fab fa-github"></i></a>
        </div> */}

       
      </div>
    </div>
  </div>
);


};

export default Login;