import { useAuth } from "../../context/AuthContext";
import "../../styles/RiderDashboard.css";

function RiderProfile() {
  const { user } = useAuth();
  const name = user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Rider";
  return <section className="rider-page"><p className="eyebrow">Account</p><h1>My profile</h1><div className="rider-profile"><span className="profile-avatar">{name.charAt(0).toUpperCase()}</span><div><h2>{name}</h2><p>{user?.email}</p><p>{user?.phone || "Phone number not provided"}</p></div></div><div className="rider-security-note"><strong>Role-based access enabled</strong><span>Your account can view and update only bookings assigned to your rider ID.</span></div></section>;
}

export default RiderProfile;