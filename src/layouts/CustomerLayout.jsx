import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import "../styles/CustomerLayout.css";

function CustomerLayout() {
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
    return user?.email?.charAt(0)?.toUpperCase() || "U";
  };

  return (
    <div className="customer-layout">

      {/* HEADER */}
      <header className="customer-header">

        <div className="brand-wrap">
          <div className="brand-logo">
            🧺
          </div>

          <div className="brand-info">
            <h2>LaundryMate</h2>
            <span>Customer Portal</span>
          </div>
        </div>


        <div className="header-actions">

          {/* Notification */}
          <button
            className="notification-btn"
            type="button"
            onClick={() => navigate("/customer/notification")}
          >
            🔔
            <span className="notification-badge">3</span>
          </button>


          {/* User */}
          <div className="customer-user">

            <div className="user-avatar">
              {getInitial()}
            </div>

            <div className="user-details">
              <strong>
                {user?.email || "Customer"}
              </strong>

              <span>
                Customer
              </span>
            </div>

          </div>

        </div>

      </header>


      {/* BODY */}
      <div className="customer-body">

        {/* SIDEBAR */}
        <aside className="sidebar">

         


          <nav className="sidebar-nav">

            {/* Dashboard */}
            <NavLink
              to="/customer"
              end
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                🏠
              </span>

              <span>
                Dashboard
              </span>
            </NavLink>


            {/* Book Now */}
            <NavLink
              to="/customer/booknow"
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                ＋
              </span>

              <span>
                Book Now
              </span>
            </NavLink>


            {/* My Booking */}
            <NavLink
              to="/customer/mybookings"
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                🧺
              </span>

              <span>
                My Bookings
              </span>
            </NavLink>


            {/* Payment */}
            <NavLink
              to="/customer/payments"
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                ₱
              </span>

              <span>
                Payments
              </span>
            </NavLink>


            {/* Notifications */}
            <NavLink
              to="/customer/notification"
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                🔔
              </span>

              <span>
                Notifications
              </span>

              <span className="nav-badge">
                3
              </span>
            </NavLink>


            {/* My Profile */}
            <NavLink
              to="/customer/profile"
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-icon">
                👤
              </span>

              <span>
                Profile
              </span>
            </NavLink>

          </nav>


          {/* LOGOUT */}
          <div className="logout-container">

            <button
              className="logout-nav-btn"
              type="button"
              onClick={handleLogout}
            >
              <span className="nav-icon">
                ⇥
              </span>

              <span>
                Logout
              </span>
            </button>

          </div>

        </aside>


        {/* PAGE CONTENT */}
        <main className="content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
}

export default CustomerLayout;