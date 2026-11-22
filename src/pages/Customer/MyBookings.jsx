import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { subscribeToCustomerBookings } from "../../services/bookingService";
import { subscribeToCustomerPayments } from "../../services/paymentService";
import {
  formatShortBookingId,
  getBookingId as resolveBookingId,
} from "../../utils/bookingId";
import "../../styles/MyBookings.css";

function normalizeBookingStatus(status) {
  if (["Washing", "Drying", "Folding"].includes(status)) {
    return "In Laundry";
  }

  if (status === "Ready for Customer Pickup") {
    return "To Deliver";
  }

  if (status === "Completed") {
    return "Delivered";
  }

  return status || "Pending";
}

function getTimestampValue(timestamp) {
  if (!timestamp) {
    return 0;
  }

  if (timestamp.toDate) {
    return timestamp.toDate().getTime();
  }

  if (timestamp.seconds) {
    return timestamp.seconds * 1000;
  }

  const date = new Date(timestamp);

  return isNaN(date.getTime())
    ? 0
    : date.getTime();
}

function normalizePaymentStatus(status, hasPaymentRecord = false) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "paid") return "Paid";
  if (value === "rejected") return "Rejected";
  if (value === "unpaid") return "Unpaid";
  if (value === "pending") return hasPaymentRecord ? "Pending" : "Unpaid";
  return hasPaymentRecord ? "Pending" : "Unpaid";
}

function MyBooking() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // =====================================
  // STATUS WORKFLOW
  // =====================================

  const statusWorkflow = [
    "Pending",
    "Accepted",
    "Ready for Pickup",
    "Picked Up",
    "In Laundry",
    "To Deliver",
    "Delivered",
  ];

  // =====================================
  // SERVICE INFORMATION
  // =====================================

  const serviceInfo = {
    "Wash & Fold": {
      icon: "🧺",
      description: "Professional washing and folding",
    },

    "Bedding Care": {
      icon: "🛏️",
      description: "Careful cleaning for bedding",
    },

    "Dry Cleaning": {
      icon: "👔",
      description: "Professional dry cleaning service",
    },

    Ironing: {
      icon: "👕",
      description: "Neat and wrinkle-free ironing",
    },
  };

  // =====================================
  // LIVE BOOKINGS + PAYMENTS
  // =====================================

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }
    let bookingsReady = false;
    let paymentsReady = false;

    const markReady = () => {
      if (bookingsReady && paymentsReady) {
        setLoading(false);
      }
    };

    const unsubBookings = subscribeToCustomerBookings(
      user.uid,
      (nextBookings) => {
        setBookings(nextBookings);
        bookingsReady = true;
        markReady();
      },
      (error) => {
        console.error("Live bookings error:", error);
        bookingsReady = true;
        markReady();
      }
    );

    const unsubPayments = subscribeToCustomerPayments(
      user.uid,
      (nextPayments) => {
        setPayments(nextPayments);
        paymentsReady = true;
        markReady();
      },
      (error) => {
        console.error("Live payments error:", error);
        paymentsReady = true;
        markReady();
      }
    );

    const refreshFromEvent = () => {
      // Snapshots already keep data live; this is a safety nudge for same-tab events.
      bookingsReady = true;
      paymentsReady = true;
      markReady();
    };

    window.addEventListener("laundrymateBookingUpdated", refreshFromEvent);
    window.addEventListener("laundrymatePaymentUpdated", refreshFromEvent);

    return () => {
      unsubBookings?.();
      unsubPayments?.();
      window.removeEventListener("laundrymateBookingUpdated", refreshFromEvent);
      window.removeEventListener("laundrymatePaymentUpdated", refreshFromEvent);
    };
  }, [user?.uid]);

  const paymentsByBookingId = useMemo(() => {
    const map = new Map();
    payments.forEach((payment) => {
      const bookingId = String(
        payment.booking_id || payment.bookingId || ""
      );
      if (!bookingId) return;
      const existing = map.get(bookingId);
      if (!existing) {
        map.set(bookingId, payment);
        return;
      }
      const existingTime = getTimestampValue(
        existing.created_at || existing.createdAt || existing.updated_at
      );
      const nextTime = getTimestampValue(
        payment.created_at || payment.createdAt || payment.updated_at
      );
      if (nextTime >= existingTime) {
        map.set(bookingId, payment);
      }
    });
    return map;
  }, [payments]);

  // =====================================
  // STATUS INDEX
  // =====================================

  const getStatusIndex = (status) => {
    const index = statusWorkflow.indexOf(
      normalizeBookingStatus(status)
    );

    return index >= 0 ? index : 0;
  };

  // =====================================
  // STATUS ICON
  // =====================================

  const getStatusIcon = (status) => {
    const icons = {
      Pending: "📋",
      Accepted: "✓",
      "Ready for Pickup": "🛍️",
      "Picked Up": "📦",
      "In Laundry": "🧺",
      "To Deliver": "🚚",
      Delivered: "✅",
    };

    return icons[status] || "○";
  };

  // =====================================
  // SERVICE ICON
  // =====================================

  const getServiceIcon = (booking) => {
    const serviceName =
      booking.service_id ||
      booking.services?.[0];

    return serviceInfo[serviceName]?.icon || "🧺";
  };

  // =====================================
  // SERVICE DESCRIPTION
  // =====================================

  const getServiceDescription = (booking) => {
    const serviceName =
      booking.service_id ||
      booking.services?.[0];

    return (
      serviceInfo[serviceName]?.description ||
      "Laundry service"
    );
  };

  // =====================================
  // DATE FORMAT
  // =====================================

  const formatDate = (timestamp) => {
    if (!timestamp) {
      return "N/A";
    }

    // Already a single calendar day key (YYYY-MM-DD) — show that day only
    if (
      typeof timestamp === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(timestamp.trim())
    ) {
      const [year, month, day] = timestamp.trim().slice(0, 10).split("-");
      const localDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(localDate.getTime())) {
        return localDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    let date;

    try {
      date = timestamp.toDate
        ? timestamp.toDate()
        : timestamp.seconds
        ? new Date(timestamp.seconds * 1000)
        : new Date(timestamp);
    } catch {
      return "N/A";
    }

    if (isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getBookingDay = (booking) =>
    booking?.schedule ||
    booking?.pickup_date ||
    booking?.pickupDate ||
    booking?.booking_date ||
    booking?.createdAt;

  const getPickupRiderName = (booking) =>
    String(booking?.rider_name || booking?.riderName || "").trim();

  // =====================================
  // CURRENCY FORMAT
  // =====================================

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  const getBookingTotalAmount = (booking, linkedPayment = null) => {
    const total = Number(
      booking?.total_amount ??
        booking?.totalAmount ??
        booking?.estimatedTotal ??
        linkedPayment?.total_amount ??
        linkedPayment?.totalAmount ??
        0
    );
    return Number.isNaN(total) ? 0 : total;
  };

  // Verified down payment. Prefer initial_payment (set when rider saves weight);
  // fall back to the original payment.amount (createPayment stores the deposit there).
  const getBookingInitialPayment = (booking, linkedPayment = null) => {
    const candidates = [
      linkedPayment?.initial_payment,
      linkedPayment?.initialPayment,
      booking?.initial_payment,
      booking?.initialPayment,
      booking?.downPayment,
      booking?.down_payment,
      booking?.amountPaid,
      booking?.initialPaid,
      linkedPayment?.amount,
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === "") {
        continue;
      }
      const initial = Number(candidate);
      if (!Number.isNaN(initial) && initial >= 0) {
        return initial;
      }
    }

    return 0;
  };

  // Remaining balance after initial payment (what customer pays on delivery).
  const getBookingAmountDue = (booking, linkedPayment = null) => {
    const stored = Number(
      booking?.amount_to_be_paid ??
        booking?.amountToBePaid ??
        linkedPayment?.amount_to_be_paid ??
        linkedPayment?.amountToBePaid
    );

    if (Number.isFinite(stored) && stored >= 0) {
      return stored;
    }

    return Math.max(
      0,
      getBookingTotalAmount(booking, linkedPayment) -
        getBookingInitialPayment(booking, linkedPayment)
    );
  };

  // =====================================
  // BOOKING ID (same short label as staff/rider, e.g. 2mkDRq)
  // =====================================

  const getBookingId = (booking) => formatShortBookingId(booking);

  // =====================================
  // STATS
  // =====================================

  const totalBookings = bookings.length;

  const pendingBookings = bookings.filter(
    (booking) =>
      booking.status === "Pending"
  ).length;

  const processingBookings = bookings.filter(
    (booking) =>
      [
        "Accepted",
        "Ready for Pickup",
        "Picked Up",
        "In Laundry",
        "To Deliver",
      ].includes(normalizeBookingStatus(booking.status))
  ).length;

  const completedBookings = bookings.filter(
    (booking) =>
      normalizeBookingStatus(booking.status) === "Delivered"
  ).length;

  // =====================================
  // PROGRESS
  // =====================================

  const getProgress = (status) => {
    const index = getStatusIndex(status);

    return ((index + 1) / statusWorkflow.length) * 100;
  };

  // =====================================
  // TOGGLE BOOKING
  // =====================================

  const toggleBooking = (booking) => {
    if (selectedBooking?.id === booking.id) {
      setSelectedBooking(null);
    } else {
      setSelectedBooking(booking);
    }
  };

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="my-booking-page">

      {/* =====================================
          PAGE HEADER
      ===================================== */}

      <header className="booking-page-header">

        <div className="booking-header-content">

          <span className="booking-eyebrow">
            LAUNDRYMATE
          </span>

          <h1>
            My Bookings
          </h1>

          <p>
            Track your laundry orders and monitor
            their progress in real time.
          </p>

        </div>

        <div className="booking-header-icon">
          🧺
        </div>

      </header>


      {/* =====================================
          STATISTICS
      ===================================== */}

      <section className="booking-stat-grid">

        {/* TOTAL */}

        <div className="booking-stat-card">

          <div className="booking-stat-icon blue">
            📋
          </div>

          <div className="booking-stat-content">

            <span>
              Total Bookings
            </span>

            <strong>
              {totalBookings}
            </strong>

          </div>

        </div>


        {/* PENDING */}

        <div className="booking-stat-card">

          <div className="booking-stat-icon orange">
            ⏳
          </div>

          <div className="booking-stat-content">

            <span>
              Pending
            </span>

            <strong>
              {pendingBookings}
            </strong>

          </div>

        </div>


        {/* PROCESSING */}

        <div className="booking-stat-card">

          <div className="booking-stat-icon purple">
            🧺
          </div>

          <div className="booking-stat-content">

            <span>
              Processing
            </span>

            <strong>
              {processingBookings}
            </strong>

          </div>

        </div>


        {/* COMPLETED */}

        <div className="booking-stat-card">

          <div className="booking-stat-icon green">
            ✓
          </div>

          <div className="booking-stat-content">

            <span>
              Completed
            </span>

            <strong>
              {completedBookings}
            </strong>

          </div>

        </div>

      </section>


      {/* =====================================
          BOOKING SECTION
      ===================================== */}

      <section className="bookings-section">

        <div className="bookings-section-header">

          <div>

            <span className="section-kicker">
              LAUNDRY ORDERS
            </span>

            <h2>
              Your Bookings
            </h2>

            <p>
              View and track all your laundry
              bookings.
            </p>

          </div>

          {bookings.length > 0 && (
            <span className="booking-count">
              {bookings.length}{" "}
              {bookings.length === 1
                ? "Booking"
                : "Bookings"}
            </span>
          )}

        </div>


        {/* =====================================
            LOADING
        ===================================== */}

        {loading ? (

          <div className="booking-loading">

            <div className="loading-spinner"></div>

            <strong>
              Loading your bookings...
            </strong>

            <p>
              Please wait while we retrieve
              your laundry orders.
            </p>

          </div>

        ) : bookings.length > 0 ? (

          <div className="booking-list">

            {bookings.map((booking) => {

              const status = normalizeBookingStatus(booking.status);

              const statusIndex =
                getStatusIndex(status);

              const isExpanded =
                selectedBooking?.id ===
                booking.id;

              const progress =
                getProgress(status);

              const serviceName =
                booking.service_id ||
                booking.services?.join(", ") ||
                "Laundry Service";

              const linkedPayment =
                paymentsByBookingId.get(String(booking.id)) ||
                paymentsByBookingId.get(
                  String(booking.booking_id || booking.bookingId || "")
                ) ||
                null;

              const totalAmount = getBookingTotalAmount(booking, linkedPayment);
              const initialPayment = getBookingInitialPayment(
                booking,
                linkedPayment
              );
              const amountDue = getBookingAmountDue(booking, linkedPayment);
              const hasWeighedTotal =
                Number(booking.weight) > 0 ||
                Number(booking.laundryWeight) > 0 ||
                status === "Delivered";
              // After weight/delivery: show total minus initial payment.
              const displayAmount = hasWeighedTotal ? amountDue : totalAmount;
              const amountLabel =
                status === "Delivered"
                  ? "Final Amount"
                  : hasWeighedTotal
                    ? "Amount Due"
                    : "Amount";

              const paymentStatus = normalizePaymentStatus(
                linkedPayment?.payment_status ||
                  linkedPayment?.paymentStatus ||
                  booking.payment_status ||
                  booking.paymentStatus,
                Boolean(linkedPayment)
              );

              const paymentMethod =
                linkedPayment?.payment_method ||
                linkedPayment?.paymentMethod ||
                booking.payment_method ||
                booking.paymentMethod ||
                "";

              return (

                <article
                  key={booking.id}
                  className={`booking-card ${
                    isExpanded
                      ? "expanded"
                      : ""
                  }`}
                >

                  {/* =====================================
                      CARD TOP
                  ===================================== */}

                  <div className="booking-card-top">

                    <div className="booking-title">

                      <div className="booking-service-icon">
                        {getServiceIcon(booking)}
                      </div>

                      <div className="booking-title-info">

                        <div className="booking-title-row">

                          <h3>
                            {serviceName}
                          </h3>

                          <span
                            className={`booking-status status-${status
                              .toLowerCase()
                              .replace(
                                /[^a-z0-9]+/g,
                                "-"
                              )}`}
                          >
                            <span className="status-circle"></span>

                            {status}

                          </span>

                        </div>

                        <p>
                          {getServiceDescription(
                            booking
                          )}
                        </p>

                        <span
                          className="booking-number"
                          title={`#${resolveBookingId(booking)}`}
                        >
                          Booking #{getBookingId(booking)}
                        </span>

                      </div>

                    </div>

                  </div>


                  {/* =====================================
                      BASIC DETAILS
                  ===================================== */}

                  <div className="booking-details">

                    <div className="detail-item">

                      <span className="detail-label">
                        Pickup Date
                      </span>

                      <strong>
                        {formatDate(getBookingDay(booking))}
                      </strong>

                    </div>


                    <div className="detail-item">

                      <span className="detail-label">
                        Laundry Weight
                      </span>

                      <strong>
                        {booking.weight ||
                          "0"}{" "}
                        kg
                      </strong>

                    </div>


                    <div className="detail-item">

                      <span className="detail-label">
                        {amountLabel}
                      </span>

                      <strong className="booking-amount">
                        ₱{formatCurrency(displayAmount)}
                      </strong>

                      {hasWeighedTotal && initialPayment > 0 ? (
                        <small className="amount-breakdown">
                          Total ₱{formatCurrency(totalAmount)} − Initial ₱
                          {formatCurrency(initialPayment)}
                        </small>
                      ) : null}

                    </div>


                    <div className="detail-item">

                      <span className="detail-label">
                        Payment
                      </span>

                      <span
                        className={`payment-badge ${
                          paymentStatus === "Paid"
                            ? "paid"
                            : paymentStatus === "Rejected"
                              ? "rejected"
                              : paymentStatus === "Unpaid"
                                ? "unpaid"
                                : "pending"
                        }`}
                      >
                        <span></span>
                        {paymentStatus}
                        {paymentStatus === "Pending" && paymentMethod
                          ? ` · ${paymentMethod}`
                          : ""}
                      </span>

                    </div>

                    <div className="detail-item">
                      <span className="detail-label">
                        Pickup Rider
                      </span>
                      <strong>
                        {getPickupRiderName(booking) ||
                          (status === "Pending"
                            ? "Waiting for assignment"
                            : "Not assigned yet")}
                      </strong>
                    </div>

                  </div>


                  {/* =====================================
                      PROGRESS
                  ===================================== */}

                  <div className="booking-progress-section">

                    <div className="progress-header">

                      <div>

                        <span>
                          Current Progress
                        </span>

                        <strong>
                          {status}
                        </strong>

                      </div>

                      <strong>
                        {Math.round(
                          progress
                        )}
                        %
                      </strong>

                    </div>

                    <div className="progress-track">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${progress}%`,
                        }}
                      ></div>

                    </div>

                  </div>


                  {/* =====================================
                      VIEW DETAILS BUTTON
                  ===================================== */}

                  <button
                    type="button"
                    className="booking-details-button"
                    onClick={() =>
                      toggleBooking(
                        booking
                      )
                    }
                  >

                    <span>
                      {isExpanded
                        ? "Hide Details"
                        : "View Booking Details"}
                    </span>

                    <span
                      className={`expand-icon ${
                        isExpanded
                          ? "rotate"
                          : ""
                      }`}
                    >
                      ↓
                    </span>

                  </button>


                  {/* =====================================
                      EXPANDED WORKFLOW
                  ===================================== */}

                  {isExpanded && (

                    <div className="booking-expanded">

                      <div className="expanded-divider"></div>

                      <div className="workflow-header">

                        <div>

                          <span className="section-kicker">
                            ORDER TRACKING
                          </span>

                          <h3>
                            Booking Workflow
                          </h3>

                        </div>

                        <span className="workflow-step">
                          Step{" "}
                          {Math.min(
                            statusIndex + 1,
                            statusWorkflow.length
                          )}{" "}
                          of {statusWorkflow.length}
                        </span>

                      </div>


                      {/* TIMELINE */}

                      <div className="status-timeline">

                        {statusWorkflow.map(
                          (
                            workflowStatus,
                            index
                          ) => {

                            const isCompleted =
                              index <
                                statusIndex ||
                              statusIndex ===
                                statusWorkflow.length - 1;

                            const isActive =
                              index ===
                                statusIndex &&
                              !isCompleted;

                            return (

                              <div
                                key={
                                  workflowStatus
                                }
                                className={`timeline-item ${
                                  isCompleted
                                    ? "completed"
                                    : isActive
                                    ? "active"
                                    : ""
                                }`}
                              >

                                <div className="timeline-line"></div>

                                <div className="timeline-dot">

                                  {isCompleted
                                    ? "✓"
                                    : getStatusIcon(
                                        workflowStatus
                                      )}

                                </div>

                                <div className="timeline-content">

                                  <strong>
                                    {workflowStatus}
                                  </strong>

                                  {isActive && (
                                    <span>
                                      Current status
                                    </span>
                                  )}

                                </div>

                              </div>

                            );
                          }
                        )}

                      </div>


                      {/* =====================================
                          COMPLETED MESSAGE
                      ===================================== */}

                      {status ===
                        "Delivered" && (

                        <div className="completion-message">

                          <div className="completion-icon">
                            🎉
                          </div>

                          <div>

                            <strong>
                              Laundry Delivered!
                            </strong>

                            <p>
                              Your laundry order has been delivered.
                              {initialPayment > 0
                                ? ` Final amount due was ₱${formatCurrency(
                                    amountDue
                                  )} after subtracting your initial payment of ₱${formatCurrency(
                                    initialPayment
                                  )}.`
                                : " Thank you for using LaundryMate!"}
                            </p>

                          </div>

                        </div>

                      )}


                      {/* =====================================
                          BOOKING INFORMATION
                      ===================================== */}

                      <div className="expanded-info-grid">

                        <div className="expanded-info-card">

                          <span>
                            Pickup Date
                          </span>

                          <strong>
                            {formatDate(getBookingDay(booking))}
                          </strong>

                        </div>

                        <div className="expanded-info-card">

                          <span>
                            Pickup Time
                          </span>

                          <strong>
                            {booking.time ||
                              "Not specified"}
                          </strong>

                        </div>

                        <div className="expanded-info-card">

                          <span>
                            Service Type
                          </span>

                          <strong>
                            {booking.pickupType ||
                              booking.pickup_type ||
                              "Pickup & Delivery"}
                          </strong>

                        </div>

                        <div className="expanded-info-card">

                          <span>
                            Weight
                          </span>

                          <strong>
                            {booking.weight ||
                              "0"}{" "}
                            kg
                          </strong>

                        </div>

                        <div className="expanded-info-card">
                          <span>Pickup Rider</span>
                          <strong>
                            {getPickupRiderName(booking) ||
                              (status === "Pending"
                                ? "Waiting for assignment"
                                : "Not assigned yet")}
                          </strong>
                        </div>

                      </div>


                      {/* =====================================
                          LOCATION
                      ===================================== */}

                      {(booking.address ||
                        booking.barangay ||
                        booking.city ||
                        booking.province) && (

                        <div className="booking-location">

                          <div className="location-icon">
                            📍
                          </div>

                          <div>

                            <span>
                              Pickup Location
                            </span>

                            <strong>
                              {[
                                booking.address,
                                booking.barangay,
                                booking.city,
                                booking.province,
                              ]
                                .filter(Boolean)
                                .join(
                                  ", "
                                )}
                            </strong>

                            {booking.landmark && (
                              <small>
                                Landmark:{" "}
                                {
                                  booking.landmark
                                }
                              </small>
                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  )}

                </article>

              );
            })}

          </div>

        ) : (

          /* =====================================
             EMPTY STATE
          ===================================== */

          <div className="empty-state">

            <div className="empty-state-icon">
              🧺
            </div>

            <h3>
              No Bookings Yet
            </h3>

            <p>
              You haven't created any laundry
              bookings yet.
            </p>

            <span>
              Create your first booking to
              get started with LaundryMate.
            </span>

          </div>

        )}

      </section>

    </div>
  );
}

export default MyBooking;