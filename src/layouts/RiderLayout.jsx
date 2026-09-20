import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/RiderLayout.css";

function RiderLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || user?.firstName || "Rider";
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="rider-layout">
      <header className="rider-header">
        <div className="rider-brand">
          <span className="rider-brand-mark">🚲</span>
          <span><strong>LaundryMate</strong><small>Rider Portal</small></span>
        </div>
        <div className="rider-account"><span className="rider-avatar">{initial}</span><span>{displayName}</span></div>
      </header>
      <div className="rider-body">
        <aside className="rider-sidebar">
          <nav>
            <NavLink to="/rider" end>📍 <span>Dashboard</span></NavLink>
            <NavLink to="/rider/pickups">📦 <span>My Pickups</span></NavLink>
            <NavLink to="/rider/profile">👤 <span>My Profile</span></NavLink>
            <button type="button" onClick={handleLogout}>🚪 <span>Logout</span></button>
          </nav>
        </aside>
        <main className="rider-content"><Outlet /></main>
      </div>
    </div>
  );
}

export default RiderLayout;