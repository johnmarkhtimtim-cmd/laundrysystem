import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  markAllNotificationsAsRead as markAllFirestoreNotificationsAsRead,
  markNotificationAsRead,
  subscribeToUserNotifications,
} from "../../services/notificationService";
import { subscribeToCustomerPayments } from "../../services/paymentService";
import { formatShortBookingId } from "../../utils/bookingId";
import "../../styles/Notifications.css";

function Notification() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const [localNotifications, setLocalNotifications] = useState([]);
  const [paymentNotifications, setPaymentNotifications] = useState([]);
  const [firestoreNotifications, setFirestoreNotifications] = useState([]);
  const [firestoreNotificationsUserId, setFirestoreNotificationsUserId] = useState("");
  const notifications = useMemo(
    () =>
      [
        ...localNotifications,
        ...paymentNotifications,
        ...(user?.uid === firestoreNotificationsUserId
          ? firestoreNotifications.filter((item) => item.type !== "payment")
          : []),
      ].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      ),
    [
      localNotifications,
      paymentNotifications,
      firestoreNotifications,
      firestoreNotificationsUserId,
      user?.uid,
    ]
  );

  // =========================================
  // LOAD NOTIFICATIONS
  // =========================================

  const currentUid = user?.uid;

  const loadNotifications = useCallback(() => {
    try {
      const bookings = JSON.parse(
        localStorage.getItem("laundrymateBookings") || "[]"
      );

      const savedReadStatus = JSON.parse(
        localStorage.getItem("laundrymateNotificationRead") || "{}"
      );

      const generatedNotifications = [];

      // =========================================
      // BOOKING NOTIFICATIONS
      // =========================================

      bookings.forEach((booking, index) => {
        const bookingUserId =
          booking.customer_id ||
          booking.customerId ||
          booking.userId ||
          booking.uid;
        if (bookingUserId && currentUid && bookingUserId !== currentUid) {
          return;
        }

        const bookingId =
          booking.bookingId ||
          booking.id ||
          `LM-${String(index + 1).padStart(3, "0")}`;
        const shortBookingId = formatShortBookingId(bookingId);

        const services =
          booking.services ||
          booking.service ||
          "Laundry Service";

        const bookingStatus =
          booking.status ||
          booking.bookingStatus ||
          "Pending";

        const createdAt =
          booking.createdAt ||
          booking.date ||
          new Date().toISOString();

        const notificationId = `booking-${bookingId}`;

        let title = "Booking Submitted";
        let message = `Your ${services} booking has been successfully submitted.`;

        // -----------------------------------------
        // BOOKING STATUS
        // -----------------------------------------

        if (
          bookingStatus.toLowerCase() === "confirmed" ||
          bookingStatus.toLowerCase() === "approved"
        ) {
          title = "Booking Confirmed";
          message = `Your ${services} booking has been successfully confirmed.`;
        }

        if (
          bookingStatus.toLowerCase() === "processing" ||
          bookingStatus.toLowerCase() === "in progress" ||
          ["in laundry", "washing", "drying", "folding"].includes(
            bookingStatus.toLowerCase()
          )
        ) {
          title = "Laundry In Progress";
          message = `Your laundry is currently being processed by our staff.`;
        }

        if (bookingStatus.toLowerCase() === "to deliver") {
          title = "Laundry Out for Delivery";
          message = `Your laundry from booking #${shortBookingId} is on its way to you.`;
        }

        if (bookingStatus.toLowerCase() === "delivered") {
          title = "Laundry Delivered";
          message = `Your laundry from booking #${shortBookingId} has been delivered.`;
        }

        if (
          bookingStatus.toLowerCase() === "ready for customer pickup"
        ) {
          title = "Ready for pick up";
          message = `Your laundry from booking #${shortBookingId} is ready for pick up.`;
        }

        if (
          bookingStatus.toLowerCase() === "ready" ||
          bookingStatus.toLowerCase() === "ready for pickup"
        ) {
          title = "Laundry Ready";
          message = `Your laundry is ready for pickup.`;
        }

        if (
          bookingStatus.toLowerCase() === "completed"
        ) {
          title = "Booking Completed";
          message = `Your ${services} booking has been completed successfully.`;
        }

        if (
          bookingStatus.toLowerCase() === "cancelled" ||
          bookingStatus.toLowerCase() === "canceled"
        ) {
          title = "Booking Cancelled";
          message = `Your booking #${shortBookingId} has been cancelled.`;
        }

        generatedNotifications.push({
          id: notificationId,
          type:
            bookingStatus.toLowerCase() === "processing" ||
            bookingStatus.toLowerCase() === "in progress" ||
            ["in laundry", "washing", "drying", "folding"].includes(
              bookingStatus.toLowerCase()
            )
              ? "progress"
              : "booking",
          title,
          message,
          time: formatRelativeTime(createdAt),
          date: formatDate(createdAt),
          booking: bookingId,
          createdAt,
          unread: savedReadStatus[notificationId] !== true,
        });

        // =========================================
        // PICKUP NOTIFICATION
        // =========================================

        const pickupDate =
          booking.pickup_date ||
          booking.pickupDate ||
          booking.schedule ||
          "";

        const pickupTime =
          booking.time ||
          "";

        if (pickupDate || pickupTime) {
          const pickupNotificationId = `pickup-${bookingId}`;

          generatedNotifications.push({
            id: pickupNotificationId,
            type: "pickup",
            title: "Pickup Schedule",
            message: pickupTime
              ? `Your laundry is scheduled for pickup at ${pickupTime}.`
              : `Your laundry is scheduled for pickup on ${pickupDate}.`,
            time: formatRelativeTime(
              booking.updatedAt || booking.createdAt
            ),
            date: formatDate(
              booking.updatedAt || booking.createdAt
            ),
            booking: bookingId,
            createdAt:
              booking.updatedAt ||
              booking.createdAt ||
              new Date().toISOString(),
            unread: savedReadStatus[pickupNotificationId] !== true,
          });
        }
      });

      // =========================================
      // SORT NEWEST FIRST
      // =========================================

      generatedNotifications.sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      setLocalNotifications(generatedNotifications);
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error
      );

      setLocalNotifications([]);
    }
  }, [currentUid]);

  // =========================================
  // INITIAL LOAD + AUTO UPDATE
  // =========================================

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0);

    let unsubscribeNotifications = () => {};
    let unsubscribePayments = () => {};

    if (user?.uid) {
      unsubscribeNotifications = subscribeToUserNotifications(
        user.uid,
        (firestoreItems) => {
          setFirestoreNotificationsUserId(user.uid);
          setFirestoreNotifications(
            firestoreItems.map((item) => {
              const rawCreatedAt = item.created_at;
              const parsedCreatedAt = rawCreatedAt?.toDate
                ? rawCreatedAt.toDate()
                : rawCreatedAt;
              const createdAt =
                parsedCreatedAt instanceof Date
                  ? parsedCreatedAt.toISOString()
                  : parsedCreatedAt || new Date().toISOString();

              return {
                id: item.id,
                type: item.type || "status",
                title: item.title || "LaundryMate Update",
                message: item.message || "",
                time: formatRelativeTime(createdAt),
                date: formatDate(createdAt),
                booking: item.booking_id || item.bookingId || "N/A",
                createdAt,
                unread: item.read !== true,
                firestore: true,
              };
            })
          );
        },
        (error) => {
          console.error("Failed to subscribe to customer notifications:", error);
        }
      );

      unsubscribePayments = subscribeToCustomerPayments(
        user.uid,
        (payments) => {
          const savedReadStatus = JSON.parse(
            localStorage.getItem("laundrymateNotificationRead") || "{}"
          );

          setPaymentNotifications(
            payments.map((payment, index) => {
              const paymentId =
                payment.payment_id ||
                payment.id ||
                `PAY-${String(index + 1).padStart(3, "0")}`;
              const bookingId = payment.booking_id || "N/A";
              const shortBookingId = formatShortBookingId(bookingId);
              const amount = Number(payment.total_amount || payment.amount || 0);
              const paymentStatus = String(
                payment.payment_status || "Pending"
              ).toLowerCase();
              const rawCreatedAt =
                payment.updated_at || payment.created_at || payment.payment_date;
              const parsedCreatedAt = rawCreatedAt?.toDate
                ? rawCreatedAt.toDate()
                : rawCreatedAt;
              const createdAt =
                parsedCreatedAt instanceof Date
                  ? parsedCreatedAt.toISOString()
                  : parsedCreatedAt || new Date().toISOString();
              const notificationId = `payment-${paymentId}`;

              let title = "Payment Pending";
              let message = `Your payment of ${formatCurrency(
                amount
              )} for booking #${shortBookingId} is pending verification.`;

              if (paymentStatus === "paid") {
                title = "Payment Successful";
                message = `Your payment of ${formatCurrency(
                  amount
                )} for booking #${shortBookingId} has been received.`;
              }

              if (paymentStatus === "rejected" || paymentStatus === "failed") {
                title = "Payment Rejected";
                message = `Your payment for booking #${shortBookingId} was rejected. Please resubmit.`;
              }

              return {
                id: notificationId,
                type: "payment",
                title,
                message,
                time: formatRelativeTime(createdAt),
                date: formatDate(createdAt),
                booking: bookingId,
                createdAt,
                unread: savedReadStatus[notificationId] !== true,
              };
            })
          );
        },
        (error) => {
          console.error("Failed to subscribe to customer payments:", error);
          setPaymentNotifications([]);
        }
      );
    }

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener(
      "laundrymateBookingUpdated",
      handleUpdate
    );

    window.addEventListener(
      "laundrymatePaymentUpdated",
      handleUpdate
    );

    window.addEventListener(
      "storage",
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        "laundrymateBookingUpdated",
        handleUpdate
      );

      window.removeEventListener(
        "laundrymatePaymentUpdated",
        handleUpdate
      );

      window.removeEventListener(
        "storage",
        handleUpdate
      );
      window.clearTimeout(initialLoad);
      unsubscribeNotifications();
      unsubscribePayments();
    };
  }, [user?.uid, loadNotifications]);

  // =========================================
  // UNREAD COUNT
  // =========================================

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  // =========================================
  // FILTER
  // =========================================

  const filteredNotifications = useMemo(() => {
    if (filter === "All") {
      return notifications;
    }

    return notifications.filter(
      (notification) =>
        notification.type === filter
    );
  }, [filter, notifications]);

  // =========================================
  // MARK AS READ
  // =========================================

  const markAsRead = async (id) => {
    const notification = notifications.find((item) => item.id === id);

    if (notification?.firestore) {
      try {
        await markNotificationAsRead(id);
        setFirestoreNotifications((current) =>
          current.map((item) =>
            item.id === id ? { ...item, unread: false } : item
          )
        );
      } catch (error) {
        console.error("Failed to mark customer notification as read:", error);
      }
      return;
    }

    const savedReadStatus = JSON.parse(
      localStorage.getItem(
        "laundrymateNotificationRead"
      ) || "{}"
    );

    savedReadStatus[id] = true;

    localStorage.setItem(
      "laundrymateNotificationRead",
      JSON.stringify(savedReadStatus)
    );
    window.dispatchEvent(new Event("laundrymateNotificationUpdated"));

    setLocalNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification
      )
    );
    setPaymentNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              unread: false,
            }
          : notification
      )
    );
  };

  // =========================================
  // MARK ALL AS READ
  // =========================================

  const markAllAsRead = async () => {
    if (user?.uid) {
      try {
        await markAllFirestoreNotificationsAsRead(user.uid);
        setFirestoreNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            unread: false,
          }))
        );
      } catch (error) {
        console.error("Failed to mark all customer notifications as read:", error);
        return;
      }
    }

    const savedReadStatus = JSON.parse(
      localStorage.getItem(
        "laundrymateNotificationRead"
      ) || "{}"
    );

    notifications.forEach((notification) => {
      savedReadStatus[notification.id] = true;
    });

    localStorage.setItem(
      "laundrymateNotificationRead",
      JSON.stringify(savedReadStatus)
    );
    window.dispatchEvent(new Event("laundrymateNotificationUpdated"));

    setLocalNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
    setPaymentNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
  };

  // =========================================
  // ICON
  // =========================================

  const getIcon = (type) => {
    switch (type) {
      case "booking":
        return "✓";

      case "payment":
        return "₱";

      case "progress":
        return "◷";

      case "pickup":
        return "⌂";

      default:
        return "!";
    }
  };

  return (
    <div className="notification-page">

      {/* =========================================
          HEADER
      ========================================= */}

      <div className="notification-header">

        <div className="notification-header-content">

          <p className="notification-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            Notifications
          </h1>

          <p>
            Stay updated with your bookings,
            payments, and laundry status.
          </p>

        </div>

        <div className="notification-header-icon">
          🔔

          {unreadCount > 0 && (
            <span className="header-unread-count">
              {unreadCount}
            </span>
          )}
        </div>

      </div>

      {/* =========================================
          STATISTICS
      ========================================= */}

      <div className="notification-stats">

        <div className="notification-stat-card">

          <div className="notification-stat-icon blue">
            🔔
          </div>

          <div>
            <span>
              Total Notifications
            </span>

            <strong>
              {notifications.length}
            </strong>
          </div>

        </div>

        <div className="notification-stat-card">

          <div className="notification-stat-icon orange">
            ●
          </div>

          <div>
            <span>
              Unread
            </span>

            <strong>
              {unreadCount}
            </strong>
          </div>

        </div>

        <div className="notification-stat-card">

          <div className="notification-stat-icon green">
            ✓
          </div>

          <div>
            <span>
              Booking Updates
            </span>

            <strong>
              {
                notifications.filter(
                  (item) =>
                    item.type === "booking"
                ).length
              }
            </strong>
          </div>

        </div>

        <div className="notification-stat-card">

          <div className="notification-stat-icon purple">
            ₱
          </div>

          <div>
            <span>
              Payment Updates
            </span>

            <strong>
              {
                notifications.filter(
                  (item) =>
                    item.type === "payment"
                ).length
              }
            </strong>
          </div>

        </div>

      </div>

      {/* =========================================
          NOTIFICATION PANEL
      ========================================= */}

      <section className="notification-panel">

        <div className="notification-panel-header">

          <div>
            <h2>
              Recent Notifications
            </h2>

            <p>
              Updates about your LaundryMate account.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              className="mark-all-btn"
              onClick={markAllAsRead}
              type="button"
            >
              Mark all as read
            </button>
          )}

        </div>

        {/* =========================================
            FILTERS
        ========================================= */}

        <div className="notification-filters">

          <button
            type="button"
            className={
              filter === "All"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("All")}
          >
            All
          </button>

          <button
            type="button"
            className={
              filter === "booking"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("booking")}
          >
            Bookings
          </button>

          <button
            type="button"
            className={
              filter === "payment"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("payment")}
          >
            Payments
          </button>

          <button
            type="button"
            className={
              filter === "progress"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("progress")}
          >
            Laundry Status
          </button>

          <button
            type="button"
            className={
              filter === "pickup"
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter("pickup")}
          >
            Pickup
          </button>

        </div>

        {/* =========================================
            NOTIFICATION LIST
        ========================================= */}

        <div className="notification-list">

          {filteredNotifications.length === 0 ? (

            <div className="empty-notifications">

              <div className="empty-notification-icon">
                🔔
              </div>

              <h3>
                No notifications
              </h3>

              <p>
                You're all caught up!
              </p>

            </div>

          ) : (

            filteredNotifications.map(
              (notification) => (

                <div
                  key={notification.id}
                  className={
                    notification.unread
                      ? "notification-item unread"
                      : "notification-item"
                  }
                  onClick={() =>
                    markAsRead(notification.id)
                  }
                >

                  {/* ICON */}

                  <div
                    className={`notification-icon ${notification.type}`}
                  >
                    {getIcon(
                      notification.type
                    )}
                  </div>

                  {/* CONTENT */}

                  <div className="notification-content">

                    <div className="notification-title-row">

                      <h3>
                        {notification.title}
                      </h3>

                      {notification.unread && (
                        <span className="new-badge">
                          NEW
                        </span>
                      )}

                    </div>

                    <p>
                      {notification.message}
                    </p>

                    <div className="notification-meta">

                      <span>
                        {notification.time}
                      </span>

                      <span className="meta-dot">
                        •
                      </span>

                      <span>
                        Booking #
                        {formatShortBookingId(notification.booking)}
                      </span>

                    </div>

                  </div>

                  {/* UNREAD DOT */}

                  {notification.unread && (
                    <span className="unread-dot" />
                  )}

                </div>
              )
            )
          )}

        </div>

      </section>

    </div>
  );
}

// =========================================
// FORMAT CURRENCY
// =========================================

function formatCurrency(amount) {
  return new Intl.NumberFormat(
    "en-PH",
    {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }
  ).format(Number(amount) || 0);
}

// =========================================
// FORMAT DATE
// =========================================

function formatDate(date) {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

// =========================================
// RELATIVE TIME
// =========================================

function formatRelativeTime(date) {
  if (!date) {
    return "Recently";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Recently";
  }

  const now = new Date();

  const difference =
    now.getTime() -
    parsedDate.getTime();

  const seconds =
    Math.floor(difference / 1000);

  if (seconds < 60) {
    return "Just now";
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} ${
      minutes === 1
        ? "minute"
        : "minutes"
    } ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${
      hours === 1
        ? "hour"
        : "hours"
    } ago`;
  }

  const days =
    Math.floor(hours / 24);

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return formatDate(date);
}

export default Notification;