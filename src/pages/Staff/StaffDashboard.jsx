import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { subscribeToStaffBookings } from "../../services/bookingService";
import {
  formatCurrency,
  formatDate,
  getAmountToBePaid,
  getContactNumber,
  getCustomerName,
  getInitialPayment,
  getInitials,
  getPickupLocation,
  getServices,
  getStatusClass,
  getTotalAmount,
  getWeight,
} from "./bookingHelpers";
import "../../styles/StaffBookings.css";
import "../../styles/StaffDashboard.css";

// ==========================================
// STATUS FLOW
// ==========================================

const STATUS_FLOW = [
  "Pending",
  "Accepted",
  "Ready for Pickup",
  "In Laundry",
  "To Deliver",
  "Delivered",
];

// ==========================================
// HELPERS
// ==========================================

function getBookingStatus(booking) {
  const status =
    booking.status ||
    booking.bookingStatus ||
    booking.orderStatus ||
    "Pending"

  if (["Picked Up", "Washing", "Drying", "Folding"].includes(status)) {
    return "In Laundry";
  }

  if (status === "Ready for Customer Pickup") {
    return "To Deliver";
  }

  if (status === "Completed") {
    return "Delivered";
  }

  return status;
}

function getBookingId(booking) {
  return (
    booking.bookingId ||
    booking.id ||
    booking.booking_id ||
    "N/A"
  );
}

// ==========================================
// COMPONENT
// ==========================================

function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [actionError, setActionError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // ==========================================
  // LOAD BOOKINGS
  // ==========================================

  useEffect(() => {
    if (!user?.uid) return undefined;

    return subscribeToStaffBookings(
      user.uid,
      (staffBookings) => {
        setBookings(staffBookings);
        setLastUpdated(new Date());
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load staff dashboard bookings:", error);
        setActionError("Unable to load bookings from Firestore.");
        setLoading(false);
      },
      false
    );
  }, [user?.uid, refreshKey]);

  // ==========================================
  // STATISTICS
  // ==========================================

  const stats = useMemo(() => {
    const total = bookings.length;

    const pending = bookings.filter(
      (booking) => getBookingStatus(booking) === "Pending"
    ).length;

    const inProgress = bookings.filter((booking) =>
      [
        "Accepted",
        "Ready for Pickup",
        "In Laundry",
        "To Deliver",
      ].includes(getBookingStatus(booking))
    ).length;

    const completed = bookings.filter(
      (booking) => getBookingStatus(booking) === "Delivered"
    ).length;

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [bookings]);

  // ==========================================
  // FILTER BOOKINGS
  // ==========================================

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingId = getBookingId(booking).toLowerCase();
      const customerName = getCustomerName(booking).toLowerCase();
      const services = getServices(booking).toLowerCase();
      const status = getBookingStatus(booking);

      const search = searchTerm.toLowerCase();

      const matchesSearch =
        bookingId.includes(search) ||
        customerName.includes(search) ||
        services.includes(search);

      const matchesStatus =
        statusFilter === "All" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  // ==========================================
  // GREETING
  // ==========================================

  const staffName =
    user?.displayName ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "Staff";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="staff-dashboard">
      {/* ======================================
          HEADER
      ====================================== */}

      <div className="staff-dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            STAFF WORKSPACE
          </span>

          <h1>Good day, {staffName} 👋</h1>

          <p>
            Manage laundry orders, monitor progress, and keep
            customer bookings organized.
          </p>
        </div>

        <button
          className="refresh-dashboard-btn"
          onClick={() => {
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          title="Refresh dashboard"
        >
          <span className="refresh-icon">↻</span>
          Refresh
        </button>
      </div>

      {actionError && (
        <p className="dashboard-feedback" role="alert">
          {actionError}
        </p>
      )}

      {/* ======================================
          STATISTICS
      ====================================== */}

      <div className="staff-stats-grid">
        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon blue">📋</div>
            <span className="stat-label">TOTAL BOOKINGS</span>
          </div>

          <h2>{stats.total}</h2>

          <p className="stat-description">
            All customer bookings
          </p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon orange">⏳</div>
            <span className="stat-label">PENDING</span>
          </div>

          <h2>{stats.pending}</h2>

          <p className="stat-description">
            Waiting for action
          </p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon purple">🧺</div>
            <span className="stat-label">IN PROGRESS</span>
          </div>

          <h2>{stats.inProgress}</h2>

          <p className="stat-description">
            Orders being processed
          </p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon green">✓</div>
            <span className="stat-label">COMPLETED</span>
          </div>

          <h2>{stats.completed}</h2>

          <p className="stat-description">
            Successfully completed
          </p>
        </div>
      </div>

      {/* ======================================
          QUICK OVERVIEW
      ====================================== */}

      <div className="staff-overview-card">
        <div className="overview-content">
          <div className="overview-icon">🧺</div>

          <div>
            <h3>Keep every order moving</h3>
            <p>
              Update laundry progress so customers can track
              their orders accurately.
            </p>
          </div>
        </div>

        <div className="overview-progress">
          <div className="progress-info">
            <span>Completion progress</span>
            <strong>
              {stats.total > 0
                ? Math.round(
                    (stats.completed / stats.total) * 100
                  )
                : 0}
              %
            </strong>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  stats.total > 0
                    ? (stats.completed / stats.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ======================================
          BOOKINGS SECTION
      ====================================== */}

      <div className="staff-orders-card">
        <div className="orders-card-header">
          <div>
            <h2>Recent Orders</h2>
            <p>
              View and manage the latest customer bookings.
            </p>
          </div>

          <span className="orders-count">
            {filteredBookings.length} order
            {filteredBookings.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* SEARCH AND FILTERS */}

        <div className="orders-toolbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>

            <input
              type="text"
              placeholder="Search customer, booking ID, or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchTerm && (
              <button
                className="clear-search"
                onClick={() => setSearchTerm("")}
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-box">
            <label htmlFor="statusFilter">Status:</label>

            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>

              {STATUS_FLOW.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BOOKINGS */}

        {loading ? (
          <div className="dashboard-empty-state">
            <div className="loading-spinner" />
            <p>Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="dashboard-empty-state">
            <div className="empty-icon">📭</div>
            <h3>No bookings found</h3>
            <p>
              {searchTerm || statusFilter !== "All"
                ? "Try adjusting your search or filter."
                : "Customer bookings will appear here."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Contact Number</th>
                  <th>Service Type</th>
                  <th>Weight</th>
                  <th>Total Amount</th>
                  <th>Initial Payment</th>
                  <th>Amount to be Paid</th>
                  <th>Pickup Location</th>
                  <th>Status</th>
                  <th>Pickup Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => {
                  const customerName = getCustomerName(booking);
                  const weight = getWeight(booking);

                  return (
                    <tr key={booking.id}>
                      <td>
                        <span className="booking-id">
                          #{booking.id || "N/A"}
                        </span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="customer-avatar">
                            {getInitials(customerName)}
                          </div>

                          <div className="customer-info">
                            <div className="customer-name">
                              {customerName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="contact-number">
                          {getContactNumber(booking)}
                        </span>
                      </td>

                      <td>
                        <span className="service-name">
                          {getServices(booking)}
                        </span>
                      </td>

                      <td>
                        <span className="weight-value">
                          {weight ? `${weight} kg` : "Not set"}
                        </span>
                      </td>

                      <td>
                        <span className="total-amount">
                          {formatCurrency(getTotalAmount(booking))}
                        </span>
                      </td>

                      <td>
                        <span className="payment-amount">
                          {formatCurrency(getInitialPayment(booking))}
                        </span>
                      </td>

                      <td>
                        <span className="amount-to-be-paid">
                          {formatCurrency(getAmountToBePaid(booking))}
                        </span>
                      </td>

                      <td>
                        <div className="pickup-location">
                          {getPickupLocation(booking)}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status ${getStatusClass(
                            booking.status
                          )}`}
                        >
                          {booking.status || "Pending"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          booking.schedule ||
                            booking.pickup_date ||
                            booking.pickupDate
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="update-status-btn"
                          onClick={() => navigate("/staff/bookings")}
                          aria-label={`Review booking ${booking.id}, status ${booking.status || "Pending"}`}
                        >
                          {booking.status === "Pending"
                            ? "Review Booking"
                            : booking.status === "Accepted"
                              ? "Continue"
                              : "View Details"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}

        <div className="orders-card-footer">
          <span>
            Last updated:{" "}
            {lastUpdated.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>

          <span>
            Showing {filteredBookings.length} of {bookings.length} bookings
          </span>
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;