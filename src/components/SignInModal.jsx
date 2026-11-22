import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import {
  login,
  logout,
  getNavigationPathByRole,
  resetPassword,
} from "../services/authService";
import { getUserData } from "../services/userService";
import { getRememberMePreference } from "../services/sessionService";
import { useAuth } from "../context/AuthContext";
import "../styles/SignInModal.css";

function SignInModal({ open, onClose }) {
  if (!open) return null;
  return <SignInModalContent onClose={onClose} />;
}

function SignInModalContent({ onClose }) {
  const navigate = useNavigate();
  const { sessionExpired, clearSessionExpired } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [loading, setLoading] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [error, setError] = useState(() =>
    sessionExpired
      ? "Your session expired due to inactivity. Please sign in again."
      : ""
  );
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading && !resetLoading) {
        if (showForgotPassword) {
          setShowForgotPassword(false);
          return;
        }
        if (showPrivacyNotice) {
          setShowPrivacyNotice(false);
          return;
        }
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, loading, resetLoading, showForgotPassword, showPrivacyNotice]);

  useEffect(() => {
    if (sessionExpired) {
      clearSessionExpired?.();
    }
  }, [sessionExpired, clearSessionExpired]);

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetMessage("");
    setResetError("");
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    if (resetLoading) return;
    setShowForgotPassword(false);
    setResetMessage("");
    setResetError("");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetMessage("");
    setResetError("");

    if (!resetEmail.trim()) {
      setResetError("Email cannot be blank.");
      return;
    }

    try {
      setResetLoading(true);
      await resetPassword(resetEmail);
      setResetMessage(
        "Password reset email sent. Check your inbox (and spam folder) for a link to set a new password.",
      );
    } catch (err) {
      const code = err?.code;
      let message = "Unable to send reset email. Please try again.";

      if (code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (code === "auth/user-not-found") {
        setResetMessage(
          "If an account exists for that email, a password reset link has been sent.",
        );
        return;
      } else if (code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait a moment and try again.";
      } else if (err?.message) {
        message = err.message;
      }

      setResetError(message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const errors = {};
    if (!email.trim()) errors.email = "Email cannot be blank.";
    if (!password) errors.password = "Password cannot be blank.";

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!privacyConsent) {
      setError("You must agree to the Data Privacy Notice before signing in.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await login(email.trim(), password, rememberMe);
      const userData = await getUserData(userCredential.user.uid);

      if (!userData) {
        await logout();
        setError("User profile not found. Please contact administrator.");
        return;
      }

      if (userData.status === "Archived" || userData.status === "Inactive") {
        await logout();
        setError(
          userData.status === "Archived"
            ? "This account has been archived. Please contact the administrator."
            : "This account is inactive. Please contact the administrator."
        );
        return;
      }

      const path = getNavigationPathByRole(userData.role);

      if (!path) {
        setError(
          "Invalid user role: " +
            (userData.role || "undefined") +
            ". Please contact administrator.",
        );
        return;
      }

      onClose();
      navigate(path);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="signin-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="signin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
      >
        <button
          type="button"
          className="signin-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close sign in"
        >
          ×
        </button>

        <div className="signin-header">
          <h2 id="signin-title">Welcome back</h2>
          <p>Sign in to your LaundryMate account</p>
        </div>

        <form className="signin-form" onSubmit={handleLogin}>
          <div className="signin-field">
            <label htmlFor="signin-email">Email Address</label>
            <input
              id="signin-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.email;
                  return next;
                });
                setError("");
              }}
              autoComplete="email"
              disabled={loading}
              className={fieldErrors.email ? "input-error" : ""}
              required
            />
            {fieldErrors.email && (
              <span className="signin-field-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className="signin-field">
            <label htmlFor="signin-password">Password</label>
            <div className="signin-password-wrap">
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                  setError("");
                }}
                autoComplete="current-password"
                disabled={loading}
                className={fieldErrors.password ? "input-error" : ""}
                required
              />
              <button
                type="button"
                className="signin-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="signin-field-error">{fieldErrors.password}</span>
            )}
          </div>

          <div className="signin-options">
            <label className="signin-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="signin-forgot"
              onClick={openForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <div className="signin-privacy">
            <label className="signin-privacy-check">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => {
                  setPrivacyConsent(e.target.checked);
                  setError("");
                }}
                disabled={loading}
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  className="signin-privacy-link"
                  onClick={() => setShowPrivacyNotice(true)}
                  disabled={loading}
                >
                  Data Privacy Notice
                </button>
                .
              </span>
            </label>
          </div>

          {error && (
            <div className="signin-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="signin-submit"
            disabled={loading || !privacyConsent}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="signin-register">
            Don&apos;t have an account?{" "}
            <Link to="/register" onClick={onClose}>
              Register
            </Link>
          </p>
        </form>
      </div>

      {showPrivacyNotice && (
        <div className="signin-sub-overlay">
          <div className="signin-sub-modal" role="dialog" aria-modal="true">
            <div className="signin-sub-header">
              <h3>Data Privacy Notice</h3>
              <button
                type="button"
                className="signin-close"
                onClick={() => setShowPrivacyNotice(false)}
                aria-label="Close privacy notice"
              >
                ×
              </button>
            </div>
            <div className="signin-sub-body">
              <h4>Data Privacy Act of 2012</h4>
              <p>
                In accordance with the Data Privacy Act of 2012 (Republic Act
                No. 10173), we respect your right to privacy and are committed
                to protecting your personal information.
              </p>
              <h4>Information We Collect</h4>
              <p>
                We collect and process your name, email address, phone number,
                address, and booking and transaction details.
              </p>
              <h4>Purpose of Collection</h4>
              <p>
                Your information is used to authenticate your identity, manage
                your account, provide our laundry services, process
                transactions, communicate with you, and maintain the security of
                the system.
              </p>
            </div>
            <div className="signin-sub-footer">
              <button
                type="button"
                className="signin-submit"
                onClick={() => {
                  setPrivacyConsent(true);
                  setShowPrivacyNotice(false);
                  setError("");
                }}
              >
                I Understand and Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {showForgotPassword && (
        <div className="signin-sub-overlay">
          <div className="signin-sub-modal" role="dialog" aria-modal="true">
            <div className="signin-sub-header">
              <h3>Reset Password</h3>
              <button
                type="button"
                className="signin-close"
                onClick={closeForgotPassword}
                disabled={resetLoading}
                aria-label="Close reset password"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleForgotPassword}>
              <div className="signin-sub-body">
                <p>
                  Enter the email linked to your LaundryMate account. We will
                  send you a password reset link.
                </p>
                <div className="signin-field">
                  <label htmlFor="reset-email">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoComplete="email"
                    disabled={resetLoading}
                    required
                  />
                </div>
                {resetMessage && (
                  <p className="signin-success" role="status">
                    {resetMessage}
                  </p>
                )}
                {resetError && (
                  <p className="signin-error" role="alert">
                    {resetError}
                  </p>
                )}
              </div>
              <div className="signin-sub-footer signin-reset-actions">
                <button
                  type="button"
                  className="signin-cancel"
                  onClick={closeForgotPassword}
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="signin-submit"
                  disabled={resetLoading || !resetEmail.trim()}
                >
                  {resetLoading ? "Sending..." : "Send Reset Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignInModal;
