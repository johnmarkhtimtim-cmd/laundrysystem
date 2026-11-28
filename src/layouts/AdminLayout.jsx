import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  ChartNoAxesCombined,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Users,
  UserRoundCog,
  UserRound,
  Bike,
  X,
} from "lucide-react";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import NotificationModal from "../components/NotificationModal";
import ThemeToggleBar from "../components/ThemeToggleBar";
import brandLogo from "../assets/laundrymate-logo.jpg";
import { subscribeToAllBookings } from "../services/bookingService";
import { subscribeToAllNotifications } from "../services/notificationService";
import { subscribeToAllPayments } from "../services/paymentService";
import "../styles/AdminPortal.css";
const nav = [
  [
    "Main",
    [
      ["Dashboard", "/admin", LayoutDashboard],
    ],
  ],
  [
    "Business management",
    [
      ["Services", "/admin/services", Sparkles],
      ["Customers", "/admin/customers", Users],
      ["Staff", "/admin/staff", UserRoundCog],
      ["Rider", "/admin/riders", Bike],
    ],
  ],
  [
    "Transactions",
    [
      ["Payments", "/admin/payments", CreditCard],
    ],
  ],
  ["Analytics", [["SalesReport", "/admin/reports", ChartNoAxesCombined]]],
  ["Communication", [["Notifications", "/admin/notifications", Bell]]],
  ["System", [["Settings", "/admin/settings", Settings]]],
];
export default function AdminPortalLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const name =
    user?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Admin";

  useEffect(() => {
    let pendingPayments = 0;
    let pendingBookings = 0;
    let unreadNotifications = 0;

    const emit = () => {
      setUnreadCount(pendingPayments + pendingBookings + unreadNotifications);
    };

    const unsubPayments = subscribeToAllPayments(
      (payments) => {
        pendingPayments = payments.filter(
          (payment) => payment.payment_status === "Pending"
        ).length;
        emit();
      },
      (error) => console.error(error)
    );

    const unsubBookings = subscribeToAllBookings(
      (bookings) => {
        pendingBookings = bookings.filter(
          (booking) => String(booking.status || "").toLowerCase() === "pending"
        ).length;
        emit();
      },
      (error) => console.error(error)
    );

    const unsubNotifications = subscribeToAllNotifications(
      (notifications) => {
        unreadNotifications = notifications.filter(
          (item) => item.read !== true
        ).length;
        emit();
      },
      (error) => console.error(error)
    );

    return () => {
      unsubPayments?.();
      unsubBookings?.();
      unsubNotifications?.();
    };
  }, []);

  const requestLogout = () => {
    if (loggingOut) return;
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      navigate("/", { replace: true });
      await logout();
    } catch (error) {
      alert(error.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };
  return (
    <div className="portal-shell">
      <ThemeToggleBar />
      <aside className={`portal-sidebar ${drawer ? "open" : ""}`}>
        <div className="portal-brand">
          <span>
            <img
              src={brandLogo}
              alt="LaundryMate logo"
              className="brand-logo-img"
            />
          </span>
          <div>
            <strong>LaundryMate</strong>
            <small>Admin Portal</small>
          </div>
          <button onClick={() => setDrawer(false)}>
            <X size={20} />
          </button>
        </div>
        <nav>
          {nav.map(([label, items]) => (
            <section className="portal-nav-group" key={label}>
              <p>{label}</p>
              {items.map(([text, to, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/admin"}
                  onClick={() => setDrawer(false)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <Icon size={18} />
                  {text}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <div className="portal-nav-bottom">
          <NavLink to="/admin/profile" onClick={() => setDrawer(false)}>
            <UserRound size={18} />
            Profile
          </NavLink>
          <button type="button" onClick={requestLogout} disabled={loggingOut}>
            <LogOut size={18} />
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
      {drawer && (
        <button
          className="portal-scrim"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="portal-workspace">
        <header className="portal-topbar">
          <button className="portal-menu" onClick={() => setDrawer(true)}>
            <Menu size={21} />
          </button>
          <div className="portal-push" />
          <button
            type="button"
            className="portal-notice"
            title="Notifications"
            aria-label="Open notifications"
            onClick={() => setShowNotificationModal(true)}
          >
            <Bell size={19} />
            {unreadCount > 0 && <i>{unreadCount > 99 ? "99+" : unreadCount}</i>}
          </button>
          <div className="portal-profile">
            <div className="portal-profile-identity">
              <b>{name[0].toUpperCase()}</b>
              <span>
                <strong>{name}</strong>
                <small>Administrator</small>
              </span>
            </div>
          </div>
        </header>
        <main className="portal-main">
          <Outlet context={{ name }} />
        </main>
      </div>

      <NotificationModal
        open={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        role="admin"
        userId={user?.uid}
        onUnreadCountChange={setUnreadCount}
      />

      <LogoutConfirmModal
        open={showLogoutModal}
        loading={loggingOut}
        title="Log out of Admin Portal?"
        message="Are you sure you want to log out of the LaundryMate Admin Portal?"
        onCancel={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
