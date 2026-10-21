import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getCustomerBookings } from "../../services/bookingService";
import "../../styles/MyBookings.css";

function normalizeBookingStatus(status) {
  if (["Washing", "Drying", "Folding"].includes(status)) {
    return "In Laundry";
  }

  if (status === "Ready for Customer Pickup") {
    return "To Deliver";
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

function MyBooking() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
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
    "Completed",
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
  // FETCH BOOKINGS
  // =====================================

  useEffect(() => {
    let isMounted = true;

    const fetchBookings = async () => {
      setLoading(true);

      try {
        let localBookings = [];
        if (user?.uid) {
          try {
            const savedBookings = JSON.parse(
              localStorage.getItem("laundrymateBookings") || "[]"
            );

            if (!Array.isArray(savedBookings)) {
              throw new Error("Saved bookings must be a list.");
            }

            localBookings = savedBookings.filter(
              (booking) =>
                booking.userId === user.uid ||
                booking.customerId === user.uid ||
                booking.customer_id === user.uid
            );
          } catch (error) {
            console.error("Error reading locally saved bookings:", error);
          }
        }

        let customerBookings = [];
        if (user?.uid) {
          try {
            customerBookings = await getCustomerBookings(user.uid);
          } catch (error) {
            console.error("Error fetching Firestore bookings:", error);
            if (localBookings.length === 0) {
              throw error;
            }
          }
        }

        const bookingsById = new Map();
        customerBookings.forEach((booking) => {
          bookingsById.set(String(booking.id), booking);
        });
        localBookings.forEach((booking) => {
          const bookingId = booking.id || booking.bookingId || booking.booking_id;
          if (bookingId) {
            bookingsById.set(String(bookingId), {
              ...bookingsById.get(String(bookingId)),
              ...booking,
              id: String(bookingId),
            });
          }
        });

        const sortedBookings = [...bookingsById.values()].sort(
          (a, b) => {
            const dateA = getTimestampValue(
              a.booking_date || a.createdAt
            );

            const dateB = getTimestampValue(
              b.booking_date || b.createdAt
            );

            return dateB - dateA;
          }
        );

        if (isMounted) {
          setBookings(sortedBookings);
        }
      } catch (error) {
        console.error(
          "Error fetching bookings:",
          error
        );
        if (isMounted) {
          setBookings([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleStorage = (event) => {
      if (!event.key || event.key === "laundrymateBookings") {
        fetchBookings();
      }
    };
    const initialLoad = window.setTimeout(fetchBookings, 0);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("laundrymateBookingUpdated", fetchBookings);

    return () => {
      isMounted = false;
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("laundrymateBookingUpdated", fetchBookings);
    };
  }, [user?.uid]);

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
      Completed: "🎉",
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

  // =====================================
  // BOOKING ID
  // =====================================

  const getBookingId = (booking) => {
    const id =
      booking.booking_id ||
      booking.id ||
      "N/A";

    return id.length > 8
      ? id.slice(-8).toUpperCase()
      : id;
  };

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
        "Delivered",
      ].includes(normalizeBookingStatus(booking.status))
  ).length;

  const completedBookings = bookings.filter(
    (booking) =>
      booking.status === "Completed"
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

              const bookingAmount =
                booking.total_amount ??
                booking.estimatedTotal ??
                booking.totalAmount ??
                0;

              const paymentStatus =
                booking.payment_status ||
                booking.paymentStatus ||
                "Pending";

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

                        <span className="booking-number">
                          Booking #
                          {getBookingId(
                            booking
                          )}
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
                        Booking Date
                      </span>

                      <strong>
                        {formatDate(
                          booking.booking_date ||
                          booking.createdAt
                        )}
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
                        Amount
                      </span>

                      <strong className="booking-amount">
                        ₱
                        {formatCurrency(
                          bookingAmount
                        )}
                      </strong>

                    </div>


                    <div className="detail-item">

                      <span className="detail-label">
                        Payment
                      </span>

                      <span
                        className={`payment-badge ${
                          paymentStatus === "Paid"
                            ? "paid"
                            : "pending"
                        }`}
                      >
                        <span></span>

                        {paymentStatus}

                      </span>

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
                              statusIndex;

                            const isActive =
                              index ===
                              statusIndex;

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
                        "Completed" && (

                        <div className="completion-message">

                          <div className="completion-icon">
                            🎉
                          </div>

                          <div>

                            <strong>
                              Laundry Completed!
                            </strong>

                            <p>
                              Your laundry order
                              has been completed.
                              Thank you for using
                              LaundryMate!
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
                            {formatDate(
                              booking.booking_date
                            )}
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