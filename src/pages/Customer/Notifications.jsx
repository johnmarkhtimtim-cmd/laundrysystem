import { useState } from "react";
import "../../styles/Notifications.css";

function Notification() {
  const [filter, setFilter] = useState("All");

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "booking",
      title: "Booking Confirmed",
      message:
        "Your Wash & Fold booking has been successfully confirmed.",
      time: "10 minutes ago",
      date: "Today",
      booking: "LM-2026-001",
      unread: true,
    },
    {
      id: 2,
      type: "payment",
      title: "Payment Successful",
      message:
        "Your payment of ₱400 for booking LM-2026-001 has been received.",
      time: "20 minutes ago",
      date: "Today",
      booking: "LM-2026-001",
      unread: true,
    },
    {
      id: 3,
      type: "progress",
      title: "Laundry In Progress",
      message:
        "Your laundry is currently being washed and processed by our staff.",
      time: "1 hour ago",
      date: "Today",
      booking: "LM-2026-001",
      unread: true,
    },
    {
      id: 4,
      type: "pickup",
      title: "Pickup Reminder",
      message:
        "Your laundry is scheduled for pickup today at 3:30 PM.",
      time: "3 hours ago",
      date: "Today",
      booking: "LM-2026-001",
      unread: false,
    },
    {
      id: 5,
      type: "booking",
      title: "Booking Completed",
      message:
        "Your Bedding Care booking has been completed successfully.",
      time: "Yesterday",
      date: "Yesterday",
      booking: "LM-2026-002",
      unread: false,
    },
    {
      id: 6,
      type: "payment",
      title: "Payment Pending",
      message:
        "Cash payment of ₱300 is still pending for your Dry Cleaning booking.",
      time: "Yesterday",
      date: "Yesterday",
      booking: "LM-2026-003",
      unread: false,
    },
  ]);

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  const filteredNotifications =
    filter === "All"
      ? notifications
      : notifications.filter(
          (notification) => notification.type === filter
        );

  const markAsRead = (id) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, unread: false }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        unread: false,
      }))
    );
  };

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

        <div>
          <p className="notification-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            Notifications
          </h1>

          <p>
            Stay updated with your bookings and payments.
          </p>
        </div>

        <div className="notification-header-icon">
          🔔
        </div>

      </div>


      {/* =========================================
          NOTIFICATION SUMMARY
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
                  (item) => item.type === "booking"
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
                  (item) => item.type === "payment"
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

          <button
            className="mark-all-btn"
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>

        </div>


        {/* FILTERS */}

        <div className="notification-filters">

          <button
            className={filter === "All" ? "filter active" : "filter"}
            onClick={() => setFilter("All")}
          >
            All
          </button>

          <button
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


        {/* NOTIFICATION LIST */}

        <div className="notification-list">

          {filteredNotifications.length === 0 ? (

            <div className="empty-notifications">

              <div>
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

            filteredNotifications.map((notification) => (

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
                  {getIcon(notification.type)}
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

                    <span>
                      •
                    </span>

                    <span>
                      Booking #{notification.booking}
                    </span>

                  </div>

                </div>


                {/* STATUS */}

                {notification.unread && (
                  <span className="unread-dot"></span>
                )}

              </div>

            ))

          )}

        </div>

      </section>


      {/* =========================================
          NOTIFICATION SETTINGS
      ========================================= */}

      <section className="notification-settings">

        <div className="settings-icon">
          ⚙
        </div>

        <div className="settings-content">

          <h3>
            Notification Preferences
          </h3>

          <p>
            Manage which LaundryMate updates you want
            to receive.
          </p>

        </div>

        <button
          className="settings-btn"
          type="button"
        >
          Manage Preferences
          <span>→</span>
        </button>

      </section>

    </div>
  );
}

export default Notification;