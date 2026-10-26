import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  acceptBooking,
  declinePendingBooking,
  subscribeToStaffBookings,
  updateStaffBookingStatus,
} from "../../services/bookingService";
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
  "Completed",
];

const STATUS_TRANSITIONS = {
  Pending: ["Accepted", "Declined"],
  Accepted: ["Ready for Pickup"],
  "Ready for Pickup": ["In Laundry"],
  "In Laundry": ["To Deliver"],
  "To Deliver": ["Delivered"],
  Delivered: ["Completed"],
};

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

function getCustomerName(booking) {
  return (
    booking.customerName ||
    booking.customer_name ||
    booking.name ||
    booking.userName ||
    booking.customer?.name ||
    booking.customer?.displayName ||
    "Customer"
  );
}

function getServices(booking) {
  if (Array.isArray(booking.services)) {
    return booking.services.join(", ");
  }

  return (
    booking.services ||
    booking.serviceType ||
    booking.service ||
    "Laundry Service"
  );
}

function getAmount(booking) {
  return Number(
    booking.totalAmount ||
      booking.total_amount ||
      booking.estimatedTotal ||
      booking.amount ||
      0
  );
}

function getDate(booking) {
  return (
    booking.createdAt ||
    booking.created_at ||
    booking.bookingDate ||
    booking.date ||
    ""
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "No date";

  const date =
    typeof dateValue.toDate === "function"
      ? dateValue.toDate()
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

// ==========================================
// COMPONENT
// ==========================================

function StaffDashboard() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState(null);
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
        "Delivered",
      ].includes(getBookingStatus(booking))
    ).length;

    const completed = bookings.filter(
      (booking) => getBookingStatus(booking) === "Completed"
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
  // UPDATE ORDER STATUS
  // ==========================================

  const updateBookingStatus = async (bookingId, newStatus) => {
    setUpdatingId(bookingId);
    setActionError("");

    const booking = bookings.find(
      (item) => String(getBookingId(item)) === String(bookingId)
    );

    try {
      if (!booking) throw new Error("Booking could not be found.");

      if (getBookingStatus(booking) === "Pending" && newStatus === "Accepted") {
        await acceptBooking(bookingId, user.uid);
      } else if (
        getBookingStatus(booking) === "Pending" &&
        newStatus === "Declined"
      ) {
        await declinePendingBooking(bookingId, user.uid);
      } else {
        await updateStaffBookingStatus(bookingId, user.uid, newStatus);
      }

      window.dispatchEvent(new Event("laundrymateBookingUpdated"));
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Unable to update booking status:", error);
      setActionError(error.message || "Unable to update booking status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================
  // NEXT STATUS
  // ==========================================

  const moveToNextStatus = (booking) => {
    const currentStatus = getBookingStatus(booking);
    const nextStatuses = STATUS_TRANSITIONS[currentStatus] || [];
    if (nextStatuses.length !== 1) {
      return;
    }

    void updateBookingStatus(getBookingId(booking), nextStatuses[0]);
  };

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
          <div className="orders-table-wrapper">
            <table className="staff-orders-table">
              <thead>
                <tr>
                  <th>BOOKING</th>
                  <th>CUSTOMER</th>
                  <th>SERVICE</th>
                  <th>SCHEDULE</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => {
                  const bookingId = getBookingId(booking);
                  const status = getBookingStatus(booking);
                  const nextStatuses = STATUS_TRANSITIONS[status] || [];
                  const statusOptions = [status, ...nextStatuses];

                  return (
                    <tr key={bookingId}>
                      <td>
                        <div className="booking-id">
                          #{bookingId}
                        </div>

                        <span className="booking-date">
                          {formatDate(getDate(booking))}
                        </span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="customer-avatar">
                            {getCustomerName(booking)
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {getCustomerName(booking)}
                            </strong>

                            <span>
                              {booking.email ||
                                booking.customerEmail ||
                                "Customer"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="service-cell">
                          {getServices(booking)}
                        </div>

                        {booking.weight && (
                          <span className="weight-label">
                            {booking.weight} kg
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="schedule-cell">
                          <strong>
                            {booking.pickup_date ||
                              booking.pickupDate ||
                              booking.schedule ||
                              "Not scheduled"}
                          </strong>

                          {booking.pickupTime && (
                            <span>{booking.pickupTime}</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <strong className="amount-cell">
                          {formatCurrency(getAmount(booking))}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            status
                          )}`}
                        >
                          <span className="status-dot" />
                          {status}
                        </span>
                      </td>

                      <td>
                        <div className="action-cell">
                          <select
                            className="status-select"
                            value={status}
                            disabled={updatingId === bookingId}
                            onChange={(e) =>
                              updateBookingStatus(
                                bookingId,
                                e.target.value
                              )
                            }
                          >
                            {statusOptions.map((statusOption) => (
                              <option
                                key={statusOption}
                                value={statusOption}
                              >
                                {statusOption}
                              </option>
                            ))}
                          </select>

                          {nextStatuses.length === 1 && (
                              <button
                                type="button"
                                className="next-status-btn"
                                onClick={() =>
                                  moveToNextStatus(booking)
                                }
                                disabled={
                                  updatingId === bookingId
                                }
                                title={`Move to ${nextStatuses[0]}`}
                                aria-label={`Move booking ${bookingId} to ${nextStatuses[0]}`}
                              >
                                {updatingId === bookingId
                                  ? "..."
                                  : "→"}
                              </button>
                            )}
                        </div>
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