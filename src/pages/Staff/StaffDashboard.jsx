import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getLocalDateKey,
  subscribeToDailyBookingCapacityStatus,
  subscribeToStaffBookings,
} from "../../services/bookingService";
import {
  formatCurrency,
  formatDate,
  formatShortBookingId,
  getBookingDisplayStatus,
  getBookingId,
  getCustomerName,
  getInitials,
  getServices,
  getStatusClass,
  getTotalAmount,
  isReadyForCustomerPickupStage,
  READY_FOR_PICKUP_ONLY_LABEL,
} from "./bookingHelpers";
import "../../styles/StaffBookings.css";
import "../../styles/StaffDashboard.css";

const STATUS_FLOW = [
  "Pending",
  "Accepted",
  "Ready for Pickup",
  "In Laundry",
  READY_FOR_PICKUP_ONLY_LABEL,
  "To Deliver",
  "Delivered",
];

const STATUS_COLORS = {
  Pending: "#f59e0b",
  Accepted: "#3b82f6",
  "Ready for Pickup": "#06b6d4",
  "In Laundry": "#8b5cf6",
  [READY_FOR_PICKUP_ONLY_LABEL]: "#14b8a6",
  "To Deliver": "#0ea5e9",
  Delivered: "#22c55e",
};

const RECENT_LIMIT = 8;

function getBookingStatus(booking) {
  const status =
    booking.status ||
    booking.bookingStatus ||
    booking.orderStatus ||
    "Pending";

  if (["Picked Up", "Washing", "Drying", "Folding"].includes(status)) {
    return "In Laundry";
  }

  if (isReadyForCustomerPickupStage(booking)) {
    return READY_FOR_PICKUP_ONLY_LABEL;
  }

  if (status === "Completed") {
    return "Delivered";
  }

  return status;
}

function StatusPipelineChart({ counts, maxValue }) {
  const height = 180;
  const width = 520;
  const padding = { top: 16, right: 12, bottom: 42, left: 12 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barGap = 14;
  const barWidth = (chartWidth - barGap * (STATUS_FLOW.length - 1)) / STATUS_FLOW.length;
  const safeMax = Math.max(maxValue, 1);

  return (
    <div className="staff-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Booking status pipeline">
        {STATUS_FLOW.map((status, index) => {
          const value = counts[status] || 0;
          const barHeight = (value / safeMax) * chartHeight;
          const x = padding.left + index * (barWidth + barGap);
          const y = padding.top + chartHeight - barHeight;
          const shortLabel =
            status === "Ready for Pickup"
              ? "Pickup"
              : status === "In Laundry"
                ? "Laundry"
                : status === READY_FOR_PICKUP_ONLY_LABEL
                  ? "Ready"
                  : status === "To Deliver"
                    ? "Deliver"
                    : status;

          return (
            <g key={status}>
              <rect
                x={x}
                y={padding.top}
                width={barWidth}
                height={chartHeight}
                rx="8"
                fill="currentColor"
                opacity="0.06"
              />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, value > 0 ? 6 : 0)}
                rx="8"
                fill={STATUS_COLORS[status]}
              />
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                className="staff-chart-value"
              >
                {value}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 14}
                textAnchor="middle"
                className="staff-chart-label"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CompletionDonut({ completed, total }) {
  const size = 168;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rate = total > 0 ? completed / total : 0;
  const length = rate * circumference;

  return (
    <div className="staff-donut-layout">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Completion rate">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="staff-donut-percent"
        >
          {Math.round(rate * 100)}%
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          className="staff-donut-caption"
        >
          completed
        </text>
      </svg>

      <div className="staff-donut-meta">
        <div>
          <span>Completed</span>
          <strong>{completed}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{Math.max(total - completed, 0)}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>
    </div>
  );
}

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
  const [capacityStatus, setCapacityStatus] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    return subscribeToStaffBookings(
      user.uid,
      (staffBookings) => {
        setBookings(staffBookings);
        setLastUpdated(new Date());
        setLoading(false);
        setActionError("");
      },
      (error) => {
        console.error("Unable to load staff dashboard bookings:", error);
        setActionError("Unable to load bookings from Firestore.");
        setLoading(false);
      },
      false
    );
  }, [user?.uid, refreshKey]);

  useEffect(() => {
    return subscribeToDailyBookingCapacityStatus(
      getLocalDateKey(),
      (status) => setCapacityStatus(status),
      (error) => {
        console.error("Unable to load daily capacity:", error);
        setCapacityStatus(null);
      }
    );
  }, []);

  const stats = useMemo(() => {
    const statusCounts = Object.fromEntries(STATUS_FLOW.map((status) => [status, 0]));

    bookings.forEach((booking) => {
      const status = getBookingStatus(booking);
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      }
    });

    const pending = statusCounts.Pending;
    const inProgress =
      statusCounts.Accepted +
      statusCounts["Ready for Pickup"] +
      statusCounts["In Laundry"] +
      statusCounts[READY_FOR_PICKUP_ONLY_LABEL] +
      statusCounts["To Deliver"];
    const completed = statusCounts.Delivered;

    return {
      total: bookings.length,
      pending,
      inProgress,
      completed,
      statusCounts,
      maxStatusCount: Math.max(...Object.values(statusCounts), 0),
      completionRate:
        bookings.length > 0
          ? Math.round((completed / bookings.length) * 100)
          : 0,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingId = getBookingId(booking).toLowerCase();
      const shortBookingId = formatShortBookingId(booking).toLowerCase();
      const customerName = getCustomerName(booking).toLowerCase();
      const services = getServices(booking).toLowerCase();
      const status = getBookingStatus(booking);
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        bookingId.includes(search) ||
        shortBookingId.includes(search) ||
        customerName.includes(search) ||
        services.includes(search);

      const matchesStatus = statusFilter === "All" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const recentBookings = filteredBookings.slice(0, RECENT_LIMIT);

  const renderStatValue = (value) =>
    loading ? <span className="stat-value-skeleton" aria-hidden="true" /> : value;

  return (
    <div className="staff-dashboard">
      <div className="staff-dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            Staff Dashboard
            {!loading && !actionError && (
              <span className="dashboard-live-badge">
                <i aria-hidden="true" />
                Live
              </span>
            )}
          </span>
          <h1>Operations overview</h1>
          <p>Track bookings, pipeline progress, and recent customer orders.</p>
        </div>

        <button
          type="button"
          className="refresh-dashboard-btn"
          onClick={() => {
            setLoading(true);
            setActionError("");
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

      {capacityStatus && !capacityStatus.unlimited && (
        <div
          className={
            "staff-capacity-banner" +
            (capacityStatus.isFull ? " is-full" : "")
          }
        >
          <div>
            <strong>Today's booking capacity</strong>
            <p>
              {capacityStatus.date}: {capacityStatus.used}/{capacityStatus.max}{" "}
              used
              {capacityStatus.closed || capacityStatus.max <= 0
                ? " · Closed (max is 0) — admin must set a positive limit"
                : capacityStatus.isFull
                  ? " · Full — new customer bookings for today are blocked"
                  : " · " + capacityStatus.remaining + " remaining"}
            </p>
          </div>
          <span>
            {capacityStatus.closed || capacityStatus.max <= 0
              ? "CLOSED"
              : capacityStatus.isFull
                ? "FULL"
                : capacityStatus.remaining + " left"}
          </span>
        </div>
      )}

      <div className="staff-stats-grid">
        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon blue">📋</div>
            <span className="stat-label">Total</span>
          </div>
          <h2>{renderStatValue(stats.total)}</h2>
          <p className="stat-description">All bookings</p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon orange">⏳</div>
            <span className="stat-label">Pending</span>
          </div>
          <h2>{renderStatValue(stats.pending)}</h2>
          <p className="stat-description">Needs review</p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon purple">🧺</div>
            <span className="stat-label">In progress</span>
          </div>
          <h2>{renderStatValue(stats.inProgress)}</h2>
          <p className="stat-description">Being processed</p>
        </div>

        <div className="staff-stat-card">
          <div className="stat-card-top">
            <div className="stat-icon green">✓</div>
            <span className="stat-label">Completed</span>
          </div>
          <h2>{renderStatValue(stats.completed)}</h2>
          <p className="stat-description">{stats.completionRate}% done</p>
        </div>
      </div>

      <div className="staff-analytics-row">
        <article className="staff-analytics-card">
          <div className="staff-analytics-head">
            <div>
              <h2>Status pipeline</h2>
              <p>Live booking volume by workflow stage</p>
            </div>
          </div>
          {loading ? (
            <div className="dashboard-empty-state compact">
              <div className="loading-spinner" />
              <p>Loading chart...</p>
            </div>
          ) : (
            <StatusPipelineChart
              counts={stats.statusCounts}
              maxValue={stats.maxStatusCount}
            />
          )}
        </article>

        <article className="staff-analytics-card">
          <div className="staff-analytics-head">
            <div>
              <h2>Completion rate</h2>
              <p>Delivered orders versus remaining work</p>
            </div>
          </div>
          {loading ? (
            <div className="dashboard-empty-state compact">
              <div className="loading-spinner" />
              <p>Loading chart...</p>
            </div>
          ) : (
            <CompletionDonut completed={stats.completed} total={stats.total} />
          )}
        </article>
      </div>

      <div className="staff-orders-card">
        <div className="orders-card-header">
          <div>
            <h2>Recent orders</h2>
            <p>Latest bookings assigned to your workspace</p>
          </div>

          <div className="orders-header-actions">
            <span className="orders-count">
              {filteredBookings.length} order
              {filteredBookings.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="orders-link-btn"
              onClick={() => navigate("/staff/bookings")}
            >
              Open transactions
            </button>
          </div>
        </div>

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
                type="button"
                className="clear-search"
                onClick={() => setSearchTerm("")}
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-box">
            <label htmlFor="statusFilter">Status</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All status</option>
              {STATUS_FLOW.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty-state">
            <div className="loading-spinner" />
            <p>Loading bookings...</p>
          </div>
        ) : recentBookings.length === 0 ? (
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
            <table className="bookings-table staff-recent-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking) => {
                  const customerName = getCustomerName(booking);
                  const shortId = formatShortBookingId(booking);

                  return (
                    <tr key={getBookingId(booking)}>
                      <td>
                        <span
                          className="booking-id"
                          title={`#${getBookingId(booking)}`}
                        >
                          #{shortId}
                        </span>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <div className="customer-avatar">
                            {getInitials(customerName)}
                          </div>
                          <div className="customer-info">
                            <div className="customer-name">{customerName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="service-name">{getServices(booking)}</span>
                      </td>
                      <td>
                        <span className="total-amount">
                          {formatCurrency(getTotalAmount(booking))}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status ${getStatusClass(
                            getBookingDisplayStatus(booking)
                          )}`}
                        >
                          {getBookingDisplayStatus(booking)}
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
                          aria-label={`Open booking ${booking.id}`}
                        >
                          {booking.status === "Pending" ? "Review" : "Open"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="orders-card-footer">
          <span>
            Last updated:{" "}
            {lastUpdated.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span>
            Showing {recentBookings.length} of {filteredBookings.length} filtered
            bookings
          </span>
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
