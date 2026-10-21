import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";

import {
  Menu,
  LayoutDashboard,
  CalendarPlus,
  ShoppingBag,
  Bell,
  User,
  CreditCard,
  LogOut,
} from "lucide-react";

import "../styles/CustomerLayout.css";

function CustomerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 700
  );

  useEffect(() => {
    const collapseSidebarForViewport = () => {
      if (window.innerWidth <= 700) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", collapseSidebarForViewport);
    return () => {
      window.removeEventListener("resize", collapseSidebarForViewport);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((previous) => !previous);
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth <= 700) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div
      className={`customer-layout ${
        sidebarOpen ? "sidebar-open" : "sidebar-closed"
      }`}
    >
      {/* =====================================
          HEADER
      ===================================== */}
      <header className="customer-header">

        <div className="customer-header-left">

          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu size={22} />
          </button>

          <div className="customer-title">
            <div>
              <h2>LaundryMate</h2>
              <span>Customer Portal</span>
            </div>
          </div>

        </div>

        {/* HEADER RIGHT */}
        <div className="customer-header-right">

          <button
            type="button"
            className="notification-button"
            title="Notifications"
            onClick={() => navigate("/customer/notification")}
          >
            <Bell size={19} />
            <span className="notification-dot"></span>
          </button>

          <div className="header-divider"></div>

          <div className="customer-user">

            <div className="user-avatar">
              {user?.firstName?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="user-info">
              <strong>
                {user?.firstName} {user?.lastName}
              </strong>

              <span>
                Customer
              </span>
            </div>

          </div>

        </div>

      </header>


      {/* =====================================
          CUSTOMER BODY
      ===================================== */}
      <div className="customer-body">

        {/* =====================================
            SIDEBAR
        ===================================== */}
        <aside className="sidebar">

          {/* BRAND */}
          <div className="sidebar-brand">

            <div className="brand-logo">
              LM
            </div>

            <div className="brand-text">
              <h2>LaundryMate</h2>
              <span>LAUNDRY BOOKING SYSTEM</span>
            </div>

          </div>


          {/* DIVIDER */}
          <div className="sidebar-divider"></div>


          {/* =====================================
              MAIN
          ===================================== */}
          <div className="sidebar-section">

            <div className="sidebar-section-title">
              MAIN
            </div>

            <NavLink
              to="/customer"
              end
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="Dashboard"
            >
              <span className="nav-icon">
                <LayoutDashboard size={18} />
              </span>

              <span className="nav-text">
                Dashboard
              </span>
            </NavLink>

          </div>


          {/* =====================================
              LAUNDRY
          ===================================== */}
          <div className="sidebar-section">

            <div className="sidebar-section-title">
              LAUNDRY
            </div>

            <NavLink
              to="/customer/booknow"
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="Book Now"
            >
              <span className="nav-icon">
                <CalendarPlus size={18} />
              </span>

              <span className="nav-text">
                Book Now
              </span>
            </NavLink>


            <NavLink
              to="/customer/mybookings"
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="My Orders"
            >
              <span className="nav-icon">
                <ShoppingBag size={18} />
              </span>

              <span className="nav-text">
                My Bookings
              </span>
            </NavLink>

          </div>


          {/* =====================================
              ACCOUNT
          ===================================== */}
          <div className="sidebar-section">

            <div className="sidebar-section-title">
              ACCOUNT
            </div>

            <NavLink
              to="/customer/transactions"
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="Transactions"
            >
              <span className="nav-icon">
                <CreditCard size={18} />
              </span>

              <span className="nav-text">
                Transactions
              </span>
            </NavLink>


            <NavLink
              to="/customer/notification"
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="Notifications"
            >
              <span className="nav-icon">
                <Bell size={18} />
              </span>

              <span className="nav-text">
                Notifications
              </span>

              <span className="nav-badge">
                3
              </span>
            </NavLink>


            <NavLink
              to="/customer/profile"
              onClick={closeSidebarOnMobile}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              title="Profile"
            >
              <span className="nav-icon">
                <User size={18} />
              </span>

              <span className="nav-text">
                Profile
              </span>
            </NavLink>

          </div>


          {/* =====================================
              SIDEBAR BOTTOM
          ===================================== */}
          <div className="sidebar-bottom">

            <div className="help-card">

              <div className="help-icon">
                ?
              </div>

              <div>
                <strong>Need help?</strong>
                <span>Contact LaundryMate</span>
              </div>

            </div>


            <button
              type="button"
              className="logout-nav-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={17} />

              <span className="logout-text">
                Logout
              </span>
            </button>

          </div>

        </aside>


        {/* =====================================
            MOBILE OVERLAY
        ===================================== */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={toggleSidebar}
          />
        )}


        {/* =====================================
            MAIN CONTENT
        ===================================== */}
        <main className="customer-content">
          <div className="customer-content-wrapper">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
}

export default CustomerLayout;
