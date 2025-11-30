/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import "./Login.css";

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && isMounted) {
          onLogin(user.user_metadata?.name || user.email || "User", user.email);
        }
      } catch {
        // Ignore session lookup errors – user can still log in manually
      }
    };

    checkExistingSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user && isMounted) {
        onLogin(
          session.user.user_metadata?.name || session.user.email || "User",
          session.user.email
        );
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onLogin]);

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message || "Google sign-in failed. Try again.");
        setLoading(false);
      }
      // On success, Supabase will redirect; auth listener above will handle post-login
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

return (
  <div className="login-split-bg">
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
    />

    {/* RIGHT SIDE (Login Form Card) */}
    <div className="login-split-right">
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome back!</h1>
          <p>Access real-time updates, handle community reports, and manage system operations with ease.
          </p>
        </div>

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

          <div className="input-icon-group password-group">
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
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className="password-toggle-btn"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div className="login-form-links">
            <a href="#" className="forgot-link">Forgot password?</a>
          </div>

          <button type="submit" className="login-btn-modern" disabled={loading}>
            {loading ? "Logging In..." : "Log In"}
          </button>
        </form>

        <div className="login-divider">
          <span>or continue with</span>
        </div>

        <div className="login-social-icons">
          <button
            type="button"
            className="login-social-button"
            aria-label="Sign in with Google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <FaGoogle />
          </button>
        </div>

        
      </div>
    </div>
  </div>
);


};

export default Login;