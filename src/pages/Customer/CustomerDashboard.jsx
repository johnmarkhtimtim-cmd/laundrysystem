import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { subscribeToCustomerBookings } from "../../services/bookingService";
import { subscribeToServices } from "../../services/laundryService";
import { formatShortBookingId, getBookingId } from "../../utils/bookingId";
import {
  getBookingDisplayStatus,
  isPickupOnlyBooking,
  PICKUP_ONLY_FINAL_CUSTOMER_LABEL,
} from "../../utils/bookingFlow";
import "../../styles/CustomerDashboard.css";

const COMPLETED_STATUSES = new Set([
  "completed",
  "delivered",
  "pick up",
  "picked up",
  "declined",
  "cancelled",
  "canceled",
]);

const SERVICE_ICONS = {
  "wash & fold": "🧺",
  "dry cleaning": "👔",
  ironing: "👕",
  "bedding care": "🛏️",
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getBookingServiceName(booking) {
  if (Array.isArray(booking.services) && booking.services.length) {
    return booking.services.join(", ");
  }

  return booking.serviceName || booking.service_id || "Laundry Service";
}

function getStatusClass(status) {
  const normalized = String(status || "Pending").toLowerCase();

  if (
    normalized.includes("ready") ||
    normalized === "completed" ||
    normalized === "delivered" ||
    normalized === "pick up" ||
    normalized === "picked up"
  ) {
    return "ready-for-pickup";
  }

  if (
    normalized.includes("wash") ||
    normalized.includes("dry") ||
    normalized.includes("fold") ||
    normalized.includes("progress") ||
    normalized.includes("deliver")
  ) {
    return "in-progress";
  }

  if (
    normalized === "pending" ||
    normalized === "accepted" ||
    normalized === "scheduled"
  ) {
    return "scheduled";
  }

  return "";
}

function formatPickup(booking) {
  const date = booking.schedule || booking.pickupDate || booking.pickup_date;
  const time = booking.time;

  if (date && time) return `Pickup ${date} · ${time}`;
  if (date) return `Pickup ${date}`;
  if (time) return `Pickup ${time}`;
  return `Booked ${formatDate(booking.createdAt || booking.booking_date)}`;
}

function formatDate(value) {
  const timestamp = getTimestampValue(value);
  if (!timestamp) return "recently";

  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function CustomerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const customerId = user?.uid;
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState(() =>
    location.state?.paymentNotice ? String(location.state.paymentNotice) : ""
  );

  useEffect(() => {
    if (!location.state?.paymentNotice) return undefined;
    navigate(location.pathname, { replace: true, state: null });
    const timer = window.setTimeout(() => setPaymentNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!customerId) {
      return undefined;
    }

    const unsubscribe = subscribeToCustomerBookings(
      customerId,
      (nextBookings) => {
        setBookings(nextBookings);
        setBookingsError("");
        setBookingsLoading(false);
      },
      (error) => {
        console.error("Unable to load customer dashboard bookings:", error);
        setBookings([]);
        setBookingsError(
          "Your bookings could not be loaded. Please refresh and try again."
        );
        setBookingsLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [customerId]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    Promise.resolve().then(() => {
      if (!isMounted) return;

      try {
        unsubscribe = subscribeToServices(
          (availableServices) => {
            if (!isMounted) return;

            setServices(
              availableServices.filter(
                (service) =>
                  String(service.status || "").toLowerCase() === "active"
              )
            );
            setServicesLoading(false);
            setServicesError("");
          },
          (error) => {
            if (!isMounted) return;

            console.error("Unable to load dashboard services:", error);
            setServicesError("Available services could not be loaded. Please try again later.");
            setServicesLoading(false);
          }
        );
      } catch (error) {
        if (!isMounted) return;

        console.error("Unable to subscribe to dashboard services:", error);
        setServicesError("Available services could not be loaded. Please try again later.");
        setServicesLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const visibleBookings = useMemo(
    () => (customerId ? bookings : []),
    [customerId, bookings]
  );
  const isBookingsLoading = customerId ? bookingsLoading : false;
  const visibleBookingsError = customerId ? bookingsError : "";

  const activeBookings = useMemo(
    () =>
      visibleBookings.filter(
        (booking) =>
          !COMPLETED_STATUSES.has(
            String(booking.status || "Pending").toLowerCase()
          )
      ),
    [visibleBookings]
  );
  const recentBookings = visibleBookings.slice(0, 4);

  const handleBookService = (serviceName) => {
    const destination = serviceName
      ? `/customer/booknow?service=${encodeURIComponent(serviceName)}`
      : "/customer/booknow";
    navigate(destination);
  };

  const handleOrderClick = () => {
    navigate("/customer/mybookings");
  };

  const customerName = user?.firstName || "there";

  return (
    <div className="customer-dashboard">
      {paymentNotice ? (
        <p className="dashboard-feedback dashboard-success" role="status">
          {paymentNotice}
        </p>
      ) : null}

      <section className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-text">
            <p className="eyebrow">CUSTOMER DASHBOARD</p>
            <h1>{customerName}</h1>
            <p className="hero-description">
              Keep your laundry fresh, organized, and effortless.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={() => handleBookService()}
        >
          <span aria-hidden="true">＋</span>
          <span>Book a service</span>
        </button>
      </section>

      <section className="stats-grid" aria-label="Booking summary">
        <div className="stat-card blue">
          <div className="stat-top">
            <span className="stat-label">Active bookings</span>
            <span className="stat-icon" aria-hidden="true">🧺</span>
          </div>
          <strong className="stat-value">
            {isBookingsLoading ? "—" : activeBookings.length}
          </strong>
          <span className="stat-change">Orders in progress or scheduled</span>
        </div>
        <div className="stat-card green">
          <div className="stat-top">
            <span className="stat-label">Total bookings</span>
            <span className="stat-icon" aria-hidden="true">📋</span>
          </div>
          <strong className="stat-value">
            {isBookingsLoading ? "—" : visibleBookings.length}
          </strong>
          <span className="stat-change">Your laundry orders</span>
        </div>
        <div className="stat-card purple">
          <div className="stat-top">
            <span className="stat-label">Available services</span>
            <span className="stat-icon" aria-hidden="true">✨</span>
          </div>
          <strong className="stat-value">
            {servicesLoading ? "—" : services.length}
          </strong>
          <span className="stat-change">Ready to book</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel panel-large">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">YOUR LAUNDRY</p>
              <h3>Recent bookings</h3>
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={handleOrderClick}
            >
              View all <span aria-hidden="true">→</span>
            </button>
          </div>

          {isBookingsLoading ? (
            <p className="dashboard-feedback" role="status">Loading your bookings…</p>
          ) : visibleBookingsError ? (
            <div className="dashboard-feedback dashboard-error" role="alert">
              <p>{visibleBookingsError}</p>
              <button
                type="button"
                className="text-btn"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="dashboard-feedback dashboard-empty">
              <span aria-hidden="true">🧺</span>
              <p>You don’t have any bookings yet.</p>
              <button
                type="button"
                className="text-btn"
                onClick={() => handleBookService()}
              >
                Book your first service <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {recentBookings.map((booking, index) => {
                const rawDisplayStatus = getBookingDisplayStatus(booking);
                const status =
                  isPickupOnlyBooking(booking) && rawDisplayStatus === "Completed"
                    ? PICKUP_ONLY_FINAL_CUSTOMER_LABEL
                    : rawDisplayStatus;
                const fullBookingId = getBookingId(booking);
                const shortBookingId = formatShortBookingId(booking);
                const pickupRider = String(
                  booking.rider_name || booking.riderName || ""
                ).trim();

                return (
                  <button
                    key={fullBookingId}
                    type="button"
                    className="order-item"
                    onClick={handleOrderClick}
                    aria-label={`View booking ${shortBookingId}, ${getBookingServiceName(booking)}, status ${status}`}
                  >
                    <span className="order-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="order-info">
                      <span className="order-title">{getBookingServiceName(booking)}</span>
                      <span className="order-detail">
                        #{shortBookingId} · {formatPickup(booking)}
                        {pickupRider ? ` · Rider: ${pickupRider}` : ""}
                      </span>
                    </span>
                    <span className={`status-pill ${getStatusClass(status)}`}>
                      <span className="status-dot" />
                      {status}
                    </span>
                    <span className="order-arrow" aria-hidden="true">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel panel-side">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">BOOK WITH EASE</p>
              <h3>Available services</h3>
            </div>
          </div>

          {servicesLoading ? (
            <p className="dashboard-feedback" role="status">Loading services…</p>
          ) : servicesError ? (
            <p className="dashboard-feedback dashboard-error" role="alert">
              {servicesError}
            </p>
          ) : services.length === 0 ? (
            <p className="dashboard-feedback">There are no services available right now.</p>
          ) : (
            <div className="service-list">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="service-item"
                  onClick={() => handleBookService(service.name)}
                >
                  <span className="service-icon" aria-hidden="true">
                    {service.icon || SERVICE_ICONS[service.name?.toLowerCase()] || "🧺"}
                  </span>
                  <span className="service-content">
                    <span className="service-title">{service.name}</span>
                    <span className="service-description">
                      {service.description || "Select this service when booking."}
                    </span>
                  </span>
                  <span className="service-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="secondary-btn"
            onClick={() => handleBookService()}
          >
            Book a service
          </button>
        </div>
      </section>
    </div>
  );
}

export default CustomerDashboard;
