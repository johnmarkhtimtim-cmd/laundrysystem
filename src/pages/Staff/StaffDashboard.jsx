import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getBookingsByStatus } from "../../services/bookingService";
import "../../styles/StaffDashboard.css";

function StaffDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    newBookings: 0,
    pendingPickup: 0,
    pickedUp: 0,
    washing: 0,
    drying: 0,
    folding: 0,
    readyForPickup: 0,
    completed: 0,
  });
  const [todayPickups, setTodayPickups] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        // Fetch bookings by each status
        const statusTypes = [
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

        let allBookings = [];
        for (const status of statusTypes) {
          const statusBookings = await getBookingsByStatus(status);
          allBookings = [...allBookings, ...statusBookings];
        }

        setBookings(allBookings);

        // Calculate stats
        const newStats = {
          newBookings: allBookings.filter(b => b.status === "Pending").length,
          pendingPickup: allBookings.filter(b => b.status === "Accepted" || b.status === "Ready for Pickup").length,
          pickedUp: allBookings.filter(b => b.status === "Picked Up").length,
          washing: allBookings.filter(b => b.status === "Washing").length,
          drying: allBookings.filter(b => b.status === "Drying").length,
          folding: allBookings.filter(b => b.status === "Folding").length,
          readyForPickup: allBookings.filter(b => b.status === "Ready for Customer Pickup").length,
          completed: allBookings.filter(b => b.status === "Completed").length,
        };

        setStats(newStats);

        // Get today's pickups
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPickupBookings = allBookings.filter(booking => {
          if (!booking.pickup_date) return false;
          const pickupDate = booking.pickup_date.toDate ? booking.pickup_date.toDate() : new Date(booking.pickup_date);
          pickupDate.setHours(0, 0, 0, 0);
          return pickupDate.getTime() === today.getTime() && 
                 (booking.status === "Ready for Pickup" || booking.status === "Accepted");
        });

        setTodayPickups(todayPickupBookings.slice(0, 10)); // Limit to 10
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      "Pending": "orange",
      "Accepted": "blue",
      "Ready for Pickup": "blue",
      "Picked Up": "purple",
      "Washing": "blue",
      "Drying": "cyan",
      "Folding": "indigo",
      "Ready for Customer Pickup": "green",
      "Completed": "green"
    };
    return colors[status] || "gray";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="staff-dashboard">
      <div className="dashboard-header">
        <h1>Staff Dashboard</h1>
        <p>Welcome, {user?.name || user?.email || "Staff Member"}</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading dashboard...</div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="dashboard-cards">
            <div className="stat-card">
              <div className="card-icon orange">📋</div>
              <div className="card-content">
                <span>New Bookings</span>
                <strong className="card-number">{stats.newBookings}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon blue">🛍️</div>
              <div className="card-content">
                <span>Pending Pickup</span>
                <strong className="card-number">{stats.pendingPickup}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon purple">✓</div>
              <div className="card-content">
                <span>Picked Up</span>
                <strong className="card-number">{stats.pickedUp}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon blue">🌊</div>
              <div className="card-content">
                <span>Washing</span>
                <strong className="card-number">{stats.washing}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon cyan">🌬️</div>
              <div className="card-content">
                <span>Drying</span>
                <strong className="card-number">{stats.drying}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon indigo">📦</div>
              <div className="card-content">
                <span>Folding</span>
                <strong className="card-number">{stats.folding}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon green">✅</div>
              <div className="card-content">
                <span>Ready for Pickup</span>
                <strong className="card-number">{stats.readyForPickup}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="card-icon green">🎉</div>
              <div className="card-content">
                <span>Completed</span>
                <strong className="card-number">{stats.completed}</strong>
              </div>
            </div>
          </div>

          {/* TODAY'S PICKUP ORDERS TABLE */}
          <div className="dashboard-section">
            <h2>Today's Pickup Orders</h2>
            <div className="table-wrapper">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Weight</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayPickups.length > 0 ? (
                    todayPickups.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <strong>#{booking.booking_id?.slice(-4) || booking.id?.slice(-4)}</strong>
                        </td>
                        <td>{booking.customer?.name || "Unknown"}</td>
                        <td>{booking.service_id || "Service"}</td>
                        <td>{booking.weight} kg</td>
                        <td>₱{booking.total_amount}</td>
                        <td>
                          <span className={`badge ${booking.payment_status === "Paid" ? "paid" : "pending"}`}>
                            {booking.payment_status || "Pending"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-message">No pickups scheduled for today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StaffDashboard;
