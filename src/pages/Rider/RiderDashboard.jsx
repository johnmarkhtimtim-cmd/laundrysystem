import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getRiderBookings, updateBookingStatus } from "../../services/bookingService";
import "../../styles/RiderDashboard.css";

const NEXT_STATUS = {
  "Ready for Pickup": "Picked Up",
  "Picked Up": "In Transit",
  "In Transit": "Delivered",
};

function RiderDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const loadBookings = async () => {
    try {
      setError("");
      setBookings(await getRiderBookings(user.uid));
    } catch (loadError) {
      setError("Unable to load assigned pickups. Please try again.");
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [user.uid]);

  const stats = useMemo(() => ({
    assigned: bookings.filter((booking) => booking.status !== "Delivered").length,
    inTransit: bookings.filter((booking) => booking.status === "In Transit").length,
    completed: bookings.filter((booking) => booking.status === "Delivered").length,
  }), [bookings]);

  const advanceStatus = async (booking) => {
    const nextStatus = NEXT_STATUS[booking.status];
    if (!nextStatus) return;

    setUpdatingId(booking.id);
    try {
      await updateBookingStatus(booking.id, nextStatus);
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: nextStatus } : item));
    } catch (updateError) {
      setError("The pickup status could not be updated.");
      console.error(updateError);
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <section className="rider-page">
      <div className="rider-page-heading"><div><p className="eyebrow">Today&apos;s route</p><h1>Rider dashboard</h1><p>Only bookings assigned to your rider account appear here.</p></div><button type="button" className="refresh-button" onClick={loadBookings}>Refresh</button></div>
      <div className="rider-stats"><div><strong>{stats.assigned}</strong><span>Open pickups</span></div><div><strong>{stats.inTransit}</strong><span>In transit</span></div><div><strong>{stats.completed}</strong><span>Delivered</span></div></div>
      {error && <p className="rider-error" role="alert">{error}</p>}
      <div className="rider-list-header"><h2>Assigned pickups</h2><span>{bookings.length} total</span></div>
      {loading ? <p className="rider-empty">Loading your assignments...</p> : bookings.length === 0 ? <p className="rider-empty">No pickups have been assigned to you yet.</p> : <div className="rider-bookings">
        {bookings.map((booking) => <article className="rider-booking" key={booking.id}>
          <div><span className="booking-id">#{booking.booking_id || booking.id}</span><h3>{booking.customer?.name || booking.customer_name || "Customer pickup"}</h3><p>{booking.pickup_address || booking.pickupAddress || booking.address || "Pickup address unavailable"}</p></div>
          <div className="rider-booking-meta"><span className={`rider-status status-${String(booking.status || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>{booking.status || "Pending"}</span>{NEXT_STATUS[booking.status] && <button type="button" disabled={updatingId === booking.id} onClick={() => advanceStatus(booking)}>{updatingId === booking.id ? "Updating..." : `Mark ${NEXT_STATUS[booking.status]}`}</button>}</div>
        </article>)}
      </div>}
    </section>
  );
}

export default RiderDashboard;