import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getBookingsByStatus, updateBookingStatus } from "../../services/bookingService";
import { notifyLaundryPickedUp } from "../../services/notificationService";
import "../../styles/PickupManagement.css";

function PickupManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingPickups, setPendingPickups] = useState([]);
  const [pickedUpBookings, setPickedUpBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        // Fetch pending pickups (Accepted and Ready for Pickup status)
        const acceptedBookings = await getBookingsByStatus("Accepted");
        const readyBookings = await getBookingsByStatus("Ready for Pickup");
        setPendingPickups([...acceptedBookings, ...readyBookings]);

        // Fetch already picked up bookings
        const pickedUpStatus = await getBookingsByStatus("Picked Up");
        setPickedUpBookings(pickedUpStatus);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const handleMarkAsPickedUp = async (booking) => {
    if (!confirm(`Mark booking #${booking.booking_id?.slice(-4) || booking.id?.slice(-4)} as picked up?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await updateBookingStatus(booking.id, "Picked Up");
      
      // Notify customer
      if (booking.customer_id) {
        await notifyLaundryPickedUp(booking.customer_id, booking.booking_id || booking.id);
      }

      // Update UI
      setPendingPickups(pendingPickups.filter(b => b.id !== booking.id));
      setPickedUpBookings([...pickedUpBookings, { ...booking, status: "Picked Up" }]);
      setSelectedBooking(null);
      alert("Booking marked as picked up successfully!");
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Error updating booking status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWashing = async (booking) => {
    if (!confirm(`Start washing laundry from booking #${booking.booking_id?.slice(-4) || booking.id?.slice(-4)}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await updateBookingStatus(booking.id, "Washing");
      
      // Update UI
      setPickedUpBookings(pickedUpBookings.filter(b => b.id !== booking.id));
      setSelectedBooking(null);
      alert("Booking status updated to Washing!");
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Error updating booking status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="pickup-management-page">
      <div className="page-header">
        <h1>Pickup Management</h1>
        <p>Manage customer laundry pickups and track status</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading pickups...</div>
      ) : (
        <>
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending Pickups ({pendingPickups.length})
            </button>
            <button
              className={`tab-button ${activeTab === "picked" ? "active" : ""}`}
              onClick={() => setActiveTab("picked")}
            >
              Picked Up ({pickedUpBookings.length})
            </button>
          </div>

          {activeTab === "pending" && (
            <div className="bookings-section">
              <h2>Pending Customer Pickups</h2>
              {pendingPickups.length > 0 ? (
                <div className="bookings-grid">
                  {pendingPickups.map((booking) => (
                    <div
                      key={booking.id}
                      className={`booking-card ${selectedBooking?.id === booking.id ? "selected" : ""}`}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="booking-header">
                        <h3>Booking #{booking.booking_id?.slice(-4) || booking.id?.slice(-4)}</h3>
                        <span className={`status-badge ${booking.status === "Accepted" ? "blue" : "purple"}`}>
                          {booking.status}
                        </span>
                      </div>

                      <div className="booking-details">
                        <p>
                          <strong>Customer:</strong> {booking.customer?.name || "Unknown"}
                        </p>
                        <p>
                          <strong>Service:</strong> {booking.service_id || "Service"}
                        </p>
                        <p>
                          <strong>Weight:</strong> {booking.weight} kg
                        </p>
                        <p>
                          <strong>Pickup Time:</strong> {formatDate(booking.pickup_date)}
                        </p>
                        <p>
                          <strong>Amount:</strong> ₱{booking.total_amount}
                        </p>
                        <p>
                          <strong>Payment:</strong>
                          <span className={`payment-badge ${booking.payment_status === "Paid" ? "paid" : "pending"}`}>
                            {booking.payment_status || "Pending"}
                          </span>
                        </p>
                      </div>

                      <div className="booking-actions">
                        <button
                          className="btn btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsPickedUp(booking);
                          }}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Processing..." : "Mark as Picked Up"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No pending pickups at the moment</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "picked" && (
            <div className="bookings-section">
              <h2>Laundry Received - Ready for Processing</h2>
              {pickedUpBookings.length > 0 ? (
                <div className="bookings-grid">
                  {pickedUpBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`booking-card processing ${selectedBooking?.id === booking.id ? "selected" : ""}`}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="booking-header">
                        <h3>Booking #{booking.booking_id?.slice(-4) || booking.id?.slice(-4)}</h3>
                        <span className="status-badge purple">Picked Up</span>
                      </div>

                      <div className="booking-details">
                        <p>
                          <strong>Customer:</strong> {booking.customer?.name || "Unknown"}
                        </p>
                        <p>
                          <strong>Service:</strong> {booking.service_id || "Service"}
                        </p>
                        <p>
                          <strong>Weight:</strong> {booking.weight} kg
                        </p>
                        <p>
                          <strong>Received Date:</strong> {formatDate(booking.booking_date)}
                        </p>
                        <p>
                          <strong>Amount:</strong> ₱{booking.total_amount}
                        </p>
                        <div className="processing-info">
                          <p className="info-title">Next Step: Start Washing</p>
                          <p>Process the laundry through the washing cycle</p>
                        </div>
                      </div>

                      <div className="booking-actions">
                        <button
                          className="btn btn-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartWashing(booking);
                          }}
                          disabled={actionLoading}
                        >
                          {actionLoading ? "Processing..." : "Start Washing"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No laundry waiting for processing</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PickupManagement;
