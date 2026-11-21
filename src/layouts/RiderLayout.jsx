import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import ThemeToggleBar from "../components/ThemeToggleBar";
import "../styles/RiderLayout.css";

const MOBILE_BREAKPOINT = 900;

function RiderLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== "undefined" && window.innerWidth > MOBILE_BREAKPOINT,
  );
  const displayName = user?.name || user?.firstName || "Rider";
  const initial = displayName.charAt(0).toUpperCase();

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
      alert(error.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div
      className={`rider-layout ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
    >
      <ThemeToggleBar />
      <header className="rider-header">
        <div className="rider-brand">
          <button
            type="button"
            className="rider-menu-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            <Menu size={21} />
          </button>
          <span className="rider-brand-mark">🚲</span>
          <span>
            <strong>LaundryMate</strong>
            <small>Rider Portal</small>
          </span>
        </div>
        <div className="rider-account">
          <span className="rider-avatar">{initial}</span>
          <span>{displayName}</span>
        </div>
      </header>

      <div className="rider-body">
        <aside className="rider-sidebar">
          <nav>
            <NavLink to="/rider/transactions" onClick={closeSidebarOnMobile}>
              💳 <span>Transactions</span>
            </NavLink>
            <NavLink to="/rider/profile" onClick={closeSidebarOnMobile}>
              👤 <span>My Profile</span>
            </NavLink>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              disabled={loggingOut}
            >
              🚪 <span>Logout</span>
            </button>
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="rider-sidebar-overlay"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="rider-content">
          <Outlet />
        </main>
      </div>

      <LogoutConfirmModal
        open={showLogoutModal}
        loading={loggingOut}
        title="Log out of Rider Portal?"
        message="Are you sure you want to log out of the LaundryMate Rider Portal?"
        onCancel={() => {
          if (!loggingOut) setShowLogoutModal(false);
        }}
        onConfirm={confirmLogout}
      />
    </div>
  );
}

export default RiderLayout;
