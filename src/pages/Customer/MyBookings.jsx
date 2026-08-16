import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getCustomerBookings } from "../../services/bookingService";
import "../../styles/MyBookings.css";

function MyBooking() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        if (user?.uid) {
          const customerBookings = await getCustomerBookings(user.uid);
          setBookings(customerBookings);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user?.uid]);

  // Status workflow
  const statusWorkflow = [
    "Pending",
    "Accepted",
    "Ready for Pickup",
    "Picked Up",
    "Washing",
    "Drying",
    "Folding",
    "Ready for Customer Pickup",
    "Completed"
  ];

  const getStatusIndex = (status) => {
    return statusWorkflow.indexOf(status);
  };

  const getStatusIcon = (status) => {
    const icons = {
      "Pending": "📋",
      "Accepted": "✓",
      "Ready for Pickup": "🛍️",
      "Picked Up": "📦",
      "Washing": "🌊",
      "Drying": "🌬️",
      "Folding": "📂",
      "Ready for Customer Pickup": "✅",
      "Completed": "🎉"
    };
    return icons[status] || "⭕";
  };

  const calculateStats = () => {
    return {
      total: bookings.length,
      pending: bookings.filter(b => b.status === "Pending").length,
      processing: bookings.filter(b => 
        ["Accepted", "Ready for Pickup", "Picked Up", "Washing", "Drying", "Folding", "Ready for Customer Pickup"].includes(b.status)
      ).length,
      completed: bookings.filter(b => b.status === "Completed").length,
    };
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const stats = calculateStats();

  return (
    <div className="my-booking-page">
      {/* PAGE HEADER */}
      <div className="booking-page-header">
        <div>
          <p className="booking-eyebrow">LAUNDRYMATE</p>
          <h1>My Bookings</h1>
          <p>Track and manage your laundry bookings with real-time status updates.</p>
        </div>
        <div className="booking-header-icon">🧺</div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="booking-stat-grid">
        <div className="booking-stat-card">
          <div className="booking-stat-icon blue">📋</div>
          <div>
            <span>Total Bookings</span>
            <strong>{stats.total}</strong>
          </div>
        </div>

        <div className="booking-stat-card">
          <div className="booking-stat-icon orange">⏳</div>
          <div>
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>
        </div>

        <div className="booking-stat-card">
          <div className="booking-stat-icon blue">🧺</div>
          <div>
            <span>Processing</span>
            <strong>{stats.processing}</strong>
          </div>
        </div>

        <div className="booking-stat-card">
          <div className="booking-stat-icon green">✓</div>
          <div>
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </div>
      </div>

      {/* BOOKINGS LIST */}
      {loading ? (
        <div className="loading-message">Loading your bookings...</div>
      ) : bookings.length > 0 ? (
        <div className="booking-list">
          {bookings.map((booking) => {
            const statusIndex = getStatusIndex(booking.status);
            const isExpanded = selectedBooking?.id === booking.id;

            return (
              <div
                key={booking.id}
                className={`booking-card ${isExpanded ? "expanded" : ""}`}
                onClick={() => setSelectedBooking(isExpanded ? null : booking)}
              >
                {/* CARD HEADER */}
                <div className="booking-card-header">
                  <div className="booking-title">
                    <div className="booking-service-icon">
                      {booking.service_id === "Wash & Fold" && "🧺"}
                      {booking.service_id === "Bedding Care" && "🛏️"}
                      {booking.service_id === "Dry Cleaning" && "👔"}
                      {!booking.service_id && "🧺"}
                    </div>
                    <div>
                      <h2>{booking.service_id || "Laundry Service"}</h2>
                      <p>Booking #{booking.booking_id?.slice(-4) || booking.id?.slice(-4)}</p>
                    </div>
                  </div>

                  <span className={`booking-status ${booking.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    <span className="status-circle"></span>
                    {booking.status}
                  </span>
                </div>

                {/* BOOKING DETAILS */}
                <div className="booking-details">
                  <div className="detail-item">
                    <span className="detail-label">Booking Date</span>
                    <strong>{formatDate(booking.booking_date)}</strong>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Laundry Weight</span>
                    <strong>{booking.weight || "N/A"} kg</strong>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Amount</span>
                    <strong className="booking-amount">₱{booking.total_amount || "0"}</strong>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Payment</span>
                    <strong>
                      <span className={`payment-badge ${booking.payment_status === "Paid" ? "paid" : "pending"}`}>
                        {booking.payment_status || "Pending"}
                      </span>
                    </strong>
                  </div>
                </div>

                {/* STATUS WORKFLOW */}
                {isExpanded && (
                  <div className="booking-workflow">
                    <div className="workflow-header">
                      <strong>Booking Workflow</strong>
                      <span className="progress-indicator">
                        Step {Math.min(statusIndex + 1, 9)} of 9
                      </span>
                    </div>

                    <div className="status-timeline-visual">
                      {statusWorkflow.map((status, index) => {
                        const isCompleted = index < statusIndex;
                        const isActive = index === statusIndex;

                        return (
                          <div key={index} className="timeline-item">
                            <div
                              className={`timeline-dot ${
                                isCompleted ? "completed" : isActive ? "active" : "pending"
                              }`}
                            >
                              {isCompleted ? "✓" : getStatusIcon(status)}
                            </div>
                            <div className="timeline-label">
                              <p>{status}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {booking.status === "Completed" && (
                      <div className="completion-message">
                        <p>✅ Your booking has been completed! Thank you for using LaundryMate.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EXPAND INDICATOR */}
                <div className="booking-expand-indicator">
                  {isExpanded ? "▲ Collapse" : "▼ View Details"}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <p>📋 No bookings yet.</p>
          <p>Create your first laundry booking to get started!</p>
        </div>
      )}
    </div>
  );
}

export default MyBooking;