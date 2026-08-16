import { useState, useEffect } from "react";
import "../styles/Login.css";
import { login } from "../services/authService";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserData } from "../services/userService";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await login(email, password);
      const userData = await getUserData(userCredential.user.uid);

      console.log(userData);

      if (!userData) {
        alert("User profile not found.");
        return;
      }

      alert("Login Successful!");

      if (userData.role === "admin") {
        navigate("/admin");
      } else if (userData.role === "customer") {
        navigate("/customer");
      } else {
        alert("Invalid user role.");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const redirectUser = async () => {
      if (!user) return;

      try {
        const userData = await getUserData(user.uid);

        if (!userData) return;

        if (userData.role === "admin") {
          navigate("/admin", { replace: true });
        } else if (userData.role === "customer") {
          navigate("/customer", { replace: true });
        }
      } catch (error) {
        console.error("Error checking user role:", error);
      }
    };

    redirectUser();
  }, [user, navigate]);

  return (
    <div className="login-container">

      {/* Background Decorations */}
      <div className="bubble bubble-1"></div>
      <div className="bubble bubble-2"></div>
      <div className="bubble bubble-3"></div>

      <div className="login-wrapper">

        {/* LEFT SIDE */}
        <div className="login-brand">
          <div className="brand-content">

            <div className="brand-logo">
              <span>🧺</span>
            </div>

            <h1>Laundry<span>Mate</span></h1>

            <h2>Smart Laundry Management</h2>

            <p>
              Manage your laundry bookings, track orders,
              and enjoy a simple and convenient laundry experience.
            </p>

            <div className="brand-features">
              <div className="feature">
                <span>✓</span>
                <p>Easy Online Booking</p>
              </div>

              <div className="feature">
                <span>✓</span>
                <p>Real-Time Order Tracking</p>
              </div>

              <div className="feature">
                <span>✓</span>
                <p>Secure Online Payment</p>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="login-card">

          <div className="login-header">
            <div className="mobile-logo">🧺</div>

            <h2>Welcome Back!</h2>

            <p>
              Sign in to your LaundryMate account
            </p>
          </div>

          <form onSubmit={handleLogin}>

            {/* EMAIL */}
            <div className="input-group">

              <label htmlFor="email">Email Address</label>

              <div className="input-wrapper">

                <span className="input-icon">✉</span>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

              </div>
            </div>

            {/* PASSWORD */}
            <div className="input-group">

              <label htmlFor="password">Password</label>

              <div className="input-wrapper">

                <span className="input-icon">🔒</span>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>

              </div>
            </div>

            {/* OPTIONS */}
            <div className="login-options">

              <label className="remember">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={() => alert("Password reset feature coming soon.")}
              >
                Forgot Password?
              </button>

            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <span className="arrow">→</span>
                </>
              )}
            </button>

          </form>

          <div className="login-footer">
            <p>
              LaundryMate System
            </p>

            <span>
              Clean clothes. Easy booking. Better service.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

export default Login;