import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";
import { subscribeToUserNotifications } from "../services/notificationService";
import { subscribeToCustomerPayments } from "../services/paymentService";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import ThemeToggleBar from "../components/ThemeToggleBar";

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
    () => typeof window !== "undefined" && window.innerWidth > 900
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const visibleUnreadNotifications = user?.uid ? unreadNotifications : 0;

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    let latestFirestore = [];
    let latestPayments = [];

    const recomputeUnread = () => {
      const savedReadStatus = JSON.parse(
        localStorage.getItem("laundrymateNotificationRead") || "{}"
      );

      const firestoreUnread = latestFirestore.filter(
        (item) => item.type !== "payment" && item.read !== true
      ).length;

      const paymentUnread = latestPayments.filter((payment, index) => {
        const paymentId =
          payment.payment_id ||
          payment.id ||
          `PAY-${String(index + 1).padStart(3, "0")}`;
        const notificationId = `payment-${paymentId}`;
        return savedReadStatus[notificationId] !== true;
      }).length;

      const bookings = JSON.parse(
        localStorage.getItem("laundrymateBookings") || "[]"
      );
      let localUnread = 0;
      bookings.forEach((booking, index) => {
        const bookingUserId =
          booking.customer_id || booking.customerId || booking.userId || booking.uid;
        if (bookingUserId && bookingUserId !== user.uid) return;

        const bookingId =
          booking.bookingId ||
          booking.id ||
          `LM-${String(index + 1).padStart(3, "0")}`;
        if (savedReadStatus[`booking-${bookingId}`] !== true) {
          localUnread += 1;
        }
        const pickupDate =
          booking.pickup_date || booking.pickupDate || booking.schedule || "";
        const pickupTime = booking.time || "";
        if (
          (pickupDate || pickupTime) &&
          savedReadStatus[`pickup-${bookingId}`] !== true
        ) {
          localUnread += 1;
        }
      });

      setUnreadNotifications(firestoreUnread + paymentUnread + localUnread);
    };

    const unsubNotifications = subscribeToUserNotifications(
      user.uid,
      (items) => {
        latestFirestore = items;
        recomputeUnread();
      },
      (error) => console.error("Customer sidebar notifications:", error)
    );

    const unsubPayments = subscribeToCustomerPayments(
      user.uid,
      (payments) => {
        latestPayments = payments;
        recomputeUnread();
      },
      (error) => console.error("Customer sidebar payments:", error)
    );

    window.addEventListener("laundrymateBookingUpdated", recomputeUnread);
    window.addEventListener("laundrymatePaymentUpdated", recomputeUnread);
    window.addEventListener("laundrymateNotificationUpdated", recomputeUnread);
    window.addEventListener("storage", recomputeUnread);

    return () => {
      unsubNotifications?.();
      unsubPayments?.();
      window.removeEventListener("laundrymateBookingUpdated", recomputeUnread);
      window.removeEventListener("laundrymatePaymentUpdated", recomputeUnread);
      window.removeEventListener(
        "laundrymateNotificationUpdated",
        recomputeUnread
      );
      window.removeEventListener("storage", recomputeUnread);
    };
  }, [user?.uid]);

  useEffect(() => {
    const collapseSidebarForViewport = () => {
      if (window.innerWidth <= 900) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
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
    if (window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      navigate("/", { replace: true });
      await logout();
    } catch (error) {
      alert(error.message);
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div
      className={`customer-layout ${
        sidebarOpen ? "sidebar-open" : "sidebar-closed"
      }`}
    >
      <ThemeToggleBar />
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
            {visibleUnreadNotifications > 0 && (
              <span className="notification-dot"></span>
            )}
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

              {unreadNotifications > 0 && (
                <span className="nav-badge">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
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
              onClick={() => setShowLogoutModal(true)}
              title="Logout"
              disabled={loggingOut}
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

      <LogoutConfirmModal
        open={showLogoutModal}
        loading={loggingOut}
        title="Log out?"
        message="Are you sure you want to log out of your LaundryMate account?"
        onCancel={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
        onConfirm={confirmLogout}
      />
    </div>
  );
}

export default CustomerLayout;
