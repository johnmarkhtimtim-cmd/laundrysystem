import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/StaffLayout.css";

function StaffLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      alert(error.message);
    }
  };

  const getInitial = () => {
    return user?.email?.charAt(0)?.toUpperCase() || "S";
  };

  return (
    <div className="staff-layout">
      {/* HEADER */}
      <header className="staff-header">
        <div className="brand-wrap">
          <div className="brand-logo">
            🧺
          </div>
          <div className="brand-info">
            <h2>LaundryMate</h2>
            <span>Staff Portal</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="staff-user">
            <div className="user-avatar">
              {getInitial()}
            </div>
            <div className="user-details">
              <strong>
                {user?.email || "Staff"}
              </strong>
              <span>
                {user?.name || "Staff Member"}
              </span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="staff-body">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {/* Dashboard */}
            <NavLink
              to="/staff"
              end
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">📊</span>
              <span>Dashboard</span>
            </NavLink>

            {/* Bookings */}
            <NavLink
              to="/staff/bookings"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">📅</span>
              <span>Bookings</span>
            </NavLink>

            {/* Tasks */}
            <NavLink
              to="/staff/tasks"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">✓</span>
              <span>Tasks</span>
            </NavLink>

            {/* Reports */}
            <NavLink
              to="/staff/reports"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">📈</span>
              <span>Reports</span>
            </NavLink>
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default StaffLayout;
