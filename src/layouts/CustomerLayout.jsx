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

  return (
    <div className="customer-layout">
      <header className="customer-header">
        <h2>CustomerDashboard</h2>

        <div className="customer-user">
          <span>{user?.email}</span>

          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="customer-body">
        <aside className="sidebar">
          <NavLink
            to="/customer"
            end
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/customer/booknow"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Booknow
          </NavLink>

          <NavLink
            to="/customer/mybookings"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            My Bookings
          </NavLink>

          <NavLink
            to="/customer/payments"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Payments
          </NavLink>

          <NavLink
            to="/customer/notification"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Notification
          </NavLink>

          <NavLink
            to="/customer/profile"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Profile
          </NavLink>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default CustomerLayout;
