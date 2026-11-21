import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import {
  Bell,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import ThemeToggleBar from "../components/ThemeToggleBar";
import { subscribeToStaffBookings } from "../services/bookingService";
import { subscribeToUserNotifications } from "../services/notificationService";
import { subscribeToAllPayments } from "../services/paymentService";
import "../styles/StaffLayout.css";

const MOBILE_BREAKPOINT = 900;

function formatBadgeCount(count) {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function StaffLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingBookings, setPendingBookings] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth > MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubBookings = subscribeToStaffBookings(
      user.uid,
      (bookings) => {
        setPendingBookings(
          bookings.filter(
            (booking) =>
              String(booking.status || booking.bookingStatus || "").toLowerCase() ===
              "pending",
          ).length,
        );
      },
      (error) => console.error("Staff sidebar bookings:", error),
      false,
    );

    const unsubPayments = subscribeToAllPayments(
      (payments) => {
        setPendingPayments(
          payments.filter((payment) => payment.payment_status === "Pending").length,
        );
      },
      (error) => console.error("Staff sidebar payments:", error),
    );

    const unsubNotifications = subscribeToUserNotifications(
      user.uid,
      (notifications) => {
        setUnreadNotifications(
          notifications.filter((item) => item.read !== true).length,
        );
      },
      (error) => console.error("Staff sidebar notifications:", error),
    );

    return () => {
      unsubBookings?.();
      unsubPayments?.();
      unsubNotifications?.();
    };
  }, [user?.uid]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
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

  const rawDisplayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    user?.displayName ||
    "";
  const displayName =
    (rawDisplayName.includes("@")
      ? rawDisplayName.split("@")[0]
      : rawDisplayName) ||
    user?.email?.split("@")[0] ||
    "Staff";

  const getInitial = () => displayName.charAt(0).toUpperCase() || "S";

  const pendingBookingsBadge = formatBadgeCount(pendingBookings);
  const pendingPaymentsBadge = formatBadgeCount(pendingPayments);
  const unreadBadge = formatBadgeCount(unreadNotifications);

  return (
    <div
      className={`staff-layout ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
    >
      <ThemeToggleBar />
      <header className="staff-header">
        <div className="brand-wrap">
          <button
            type="button"
            className="staff-menu-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <Menu size={21} />
          </button>
          <div className="brand-logo">🧺</div>
          <div className="brand-info">
            <h2>LaundryMate</h2>
            <span>Staff Portal</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="staff-header-notice"
            onClick={() => navigate("/staff/notifications")}
            aria-label="Open notifications"
            title="Notifications"
          >
            <Bell size={19} />
            {unreadBadge && <i>{unreadBadge}</i>}
          </button>

          <div className="staff-user">
            <div className="user-avatar">{getInitial()}</div>
            <div className="user-details">
              <strong>{displayName}</strong>
              <span>{user?.email || "Staff Member"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="staff-body">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <p className="sidebar-section-title">Main</p>
              <NavLink
                to="/staff"
                end
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={closeSidebarOnMobile}
              >
                <span className="nav-icon">
                  <LayoutDashboard size={18} />
                </span>
                <span className="nav-text">Dashboard</span>
              </NavLink>
            </div>

            <div className="sidebar-section">
              <p className="sidebar-section-title">Operations</p>
              <NavLink
                to="/staff/bookings"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={closeSidebarOnMobile}
              >
                <span className="nav-icon">
                  <ClipboardList size={18} />
                </span>
                <span className="nav-text">Transaction</span>
                {pendingBookingsBadge && (
                  <span className="nav-badge">{pendingBookingsBadge}</span>
                )}
              </NavLink>

              <NavLink
                to="/staff/payments"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={closeSidebarOnMobile}
              >
                <span className="nav-icon">
                  <CreditCard size={18} />
                </span>
                <span className="nav-text">Payments</span>
                {pendingPaymentsBadge && (
                  <span className="nav-badge">{pendingPaymentsBadge}</span>
                )}
              </NavLink>
            </div>

            <div className="sidebar-section">
              <p className="sidebar-section-title">Account</p>
              <NavLink
                to="/staff/notifications"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={closeSidebarOnMobile}
              >
                <span className="nav-icon">
                  <Bell size={18} />
                </span>
                <span className="nav-text">Notifications</span>
                {unreadBadge && <span className="nav-badge">{unreadBadge}</span>}
              </NavLink>

              <NavLink
                to="/staff/profile"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={closeSidebarOnMobile}
              >
                <span className="nav-icon">
                  <UserRound size={18} />
                </span>
                <span className="nav-text">My Profile</span>
              </NavLink>
            </div>

            <div className="sidebar-bottom">
              <button
                type="button"
                className="nav-link logout-link"
                onClick={() => setShowLogoutModal(true)}
                disabled={loggingOut}
              >
                <span className="nav-icon">
                  <LogOut size={18} />
                </span>
                <span className="nav-text">
                  {loggingOut ? "Logging out..." : "Logout"}
                </span>
              </button>
            </div>
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="staff-sidebar-overlay"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="content">
          <Outlet />
        </main>
      </div>

      <LogoutConfirmModal
        open={showLogoutModal}
        loading={loggingOut}
        title="Log out of Staff Portal?"
        message="Are you sure you want to log out of the LaundryMate Staff Portal?"
        onCancel={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
        onConfirm={confirmLogout}
      />
    </div>
  );
}

export default StaffLayout;
