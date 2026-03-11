import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/wallet.css";

const API = "http://localhost:5000";

export default function Signup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ name: "", email: "", password: "" });
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Client-side validation ────────────────────────────────
  function validate() {
    if (!form.name.trim())
      return "Full name is required.";
    if (form.name.trim().length < 2)
      return "Name must be at least 2 characters.";
    if (!form.email.trim())
      return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "Please enter a valid email address.";
    if (!form.password)
      return "Password is required.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (!/[A-Za-z]/.test(form.password))
      return "Password must contain at least one letter.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/signup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:     form.name.trim(),
          email:    form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed"); return; }

      localStorage.setItem("cw_user_id",   data.user_id);
      localStorage.setItem("cw_user_name", data.name);
      navigate("/wallet");
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo mark */}
        <div className="auth-logo">
          <svg viewBox="0 0 40 40" fill="none" className="auth-logo-svg">
            <circle cx="20" cy="20" r="18" stroke="#00C853" strokeWidth="2.5"/>
            <path d="M12 26 C12 18 20 14 20 14 C20 14 28 18 28 26" stroke="#00C853" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="20" cy="27" r="3" fill="#00C853"/>
          </svg>
          <span className="auth-logo-text">CarbonWise</span>
        </div>

        <h1 className="auth-heading">Create account</h1>
        <p className="auth-sub">Track your carbon footprint, stay within budget.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Full name</label>
            <input
              type="text"
              placeholder="Aditya Kumar"
              value={form.name}
              onChange={set("name")}
              autoComplete="name"
              required
            />
          </div>

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Min. 6 characters, must include a letter"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              required
              minLength={6}
            />
            {form.password.length > 0 && form.password.length < 6 && (
              <span style={{fontSize:"0.75rem",color:"#ff9a6b",marginTop:"0.2rem"}}>
                {6 - form.password.length} more character{6 - form.password.length !== 1 ? "s" : ""} needed
              </span>
            )}
          </div>

          {error && <p className="auth-error">⚠ {error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}