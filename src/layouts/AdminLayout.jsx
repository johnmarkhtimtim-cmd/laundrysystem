import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Users,
  UserRoundCog,
  UserRound,
  X,
} from "lucide-react";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";
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
    ],
  ],
  [
    "Transactions",
    [
      ["Payments", "/admin/payments", CreditCard],
      ["Pickup & Delivery", "/admin/pickup-delivery", Truck],
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
  const [profile, setProfile] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const name = user?.displayName || user?.email?.split("@")[0] || "Admin";
  const signOut = async () => {
    if (loggingOut || !window.confirm("Log out of the Admin Portal?")) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message || "Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  };
  return (
    <div className="portal-shell">
      <aside className={`portal-sidebar ${drawer ? "open" : ""}`}>
        <div className="portal-brand">
          <span>
            <ShieldCheck size={22} />
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
          <button type="button" onClick={signOut} disabled={loggingOut}>
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
          <NavLink className="portal-notice" to="/admin/notifications">
            <Bell size={19} />
            <i>3</i>
          </NavLink>
          <div className="portal-profile">
            <button onClick={() => setProfile(!profile)}>
              <b>{name[0].toUpperCase()}</b>
              <span>
                <strong>{name}</strong>
                <small>Administrator</small>
              </span>
              <ChevronDown size={16} />
            </button>
            {profile && (
              <div>
                <NavLink to="/admin/profile">My profile</NavLink>
                <button type="button" onClick={signOut} disabled={loggingOut}>
                  {loggingOut ? "Logging out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="portal-main">
          <Outlet context={{ name }} />
        </main>
      </div>
    </div>
  );
}
