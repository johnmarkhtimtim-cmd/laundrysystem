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

  const navItems = [
    {
      path: "/customer",
      label: "Dashboard",
      icon: "▦",
      end: true,
    },
    {
      path: "/customer/booknow",
      label: "Book Now",
      icon: "+",
    },
    {
      path: "/customer/mybookings",
      label: "My Bookings",
      icon: "◫",
    },
    {
      path: "/customer/payments",
      label: "Payments",
      icon: "₱",
    },
    {
      path: "/customer/notification",
      label: "Notifications",
      icon: "♢",
      badge: 3,
    },
    {
      path: "/customer/profile",
      label: "Profile",
      icon: "♙",
    },
  ];

  return (
    <div className="customer-layout">

      {/* SIDEBAR */}
      <aside className="sidebar">

        {/* BRAND */}
        <div className="sidebar-brand">

          <div className="brand-logo">
            LM
          </div>

          <div className="brand-text">
            <h2>LaundryMate</h2>
            <span>Customer Portal</span>
          </div>

        </div>

        <div className="sidebar-divider"></div>

        {/* NAVIGATION */}
        <nav className="sidebar-nav">

          <p className="nav-title">
            CUSTOMER MENU
          </p>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >

              <span className="nav-icon">
                {item.icon}
              </span>

              <span className="nav-label">
                {item.label}
              </span>

              {item.badge && (
                <span className="nav-badge">
                  {item.badge}
                </span>
              )}

            </NavLink>
          ))}

        </nav>

        {/* SIDEBAR BOTTOM */}
        <div className="sidebar-bottom">

          <div className="help-card">

            <div className="help-icon">
              ?
            </div>

            <div>
              <strong>
                Need help?
              </strong>

              <span>
                Contact laundry support
              </span>
            </div>

          </div>

          <button
            className="logout-nav-btn"
            type="button"
            onClick={handleLogout}
          >
            <span>
              ↪
            </span>

            <span className="logout-text">
              Logout
            </span>
          </button>

        </div>

      </aside>


      {/* MAIN AREA */}
      <div className="customer-main">

        {/* HEADER */}
        <header className="customer-header">

          <div className="header-left">

            <div>
              <span className="header-label">
                CUSTOMER PORTAL
              </span>

              <h1>
                Welcome back
              </h1>
            </div>

          </div>


          <div className="header-right">

            {/* Notification */}
            <button
              className="notification-btn"
              type="button"
              onClick={() =>
                navigate("/customer/notification")
              }
            >
              <span>
                ♢
              </span>

              <i></i>
            </button>


            <div className="header-divider"></div>


            {/* User */}
            <div className="customer-user">

              <div className="user-avatar">
                {getInitial()}
              </div>

              <div className="user-info">

                <strong>
                  Customer
                </strong>

                <span>
                  {user?.email || "Customer"}
                </span>

              </div>

            </div>

          </div>

        </header>


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