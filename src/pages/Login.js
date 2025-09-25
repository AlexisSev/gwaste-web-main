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
      // Basic validation
      if (!credentials.email || !credentials.password) {
        setError("Enter your email and password.");
        return;
      }

      // Sign in with Supabase Auth (manage users in Authentication tab)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (authError || !authData?.user) {
        const message = authError?.message || "Incorrect email or password.";
        setError(message);
        return;
      }

      // ✅ Successful login using Supabase Auth user
      const user = authData.user;
      onLogin(user.user_metadata?.name || user.email || "User", user.email);
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-bg">
      <div className="login-bg-centered">
        <div className="login-card">
          <h2 className="login-title">Welcome Back, Admin!</h2>
          <p className="login-subtitle">Ready to manage things?</p>

          {error && <div className="error-message">{error}</div>}

          <form className="login-form-modern" onSubmit={handleSubmit}>
            <div className="input-icon-group">
              <span className="input-icon"><FaUser /></span>
              <input
                type="email"
                name="email"
                placeholder="awesome@user.com"
                value={credentials.email}
                onChange={handleInputChange}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="input-icon-group">
              <span className="input-icon"><FaLock /></span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={credentials.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="login-form-links">
              <a href="#" className="forgot-link">Forgot your password?</a>
            </div>

            <button type="submit" className="login-btn-modern" disabled={loading}>
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
