import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../services/notificationService";
import { formatShortBookingId } from "../../utils/bookingId";
import "../../styles/StaffNotifications.css";

function StaffNotifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");

    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (notifs) => {
        setNotifications(notifs);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        console.error("Error fetching notifications:", loadError);
        setError("Unable to load notifications. Please refresh and try again.");
        setLoading(false);
      },
    );

    return () => unsubscribe?.();
  }, [user?.uid]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (markError) {
      console.error("Error marking notification as read:", markError);
      alert("Unable to mark notification as read.");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(user.uid);
    } catch (markError) {
      console.error("Error marking all as read:", markError);
      alert("Unable to mark all notifications as read.");
    }
  };

  const filteredNotifications =
    filter === "All"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type) => {
    const icons = {
      booking: "📋",
      payment: "💳",
      progress: "🔄",
      pickup: "🛍️",
      status: "✅",
    };
    return icons[type] || "🔔";
  };

  const getNotificationColor = (type) => {
    const colors = {
      booking: "blue",
      payment: "green",
      progress: "purple",
      pickup: "orange",
      status: "green",
    };
    return colors[type] || "gray";
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }
    if (days < 7) {
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="staff-notifications-page">
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Stay updated with booking and system notifications</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading notifications...</div>
      ) : (
        <>
          {error && <div className="payment-load-error">{error}</div>}

          <div className="notification-stats">
            <div className="stat-box">
              <span className="stat-label">Total Notifications</span>
              <strong className="stat-value">{notifications.length}</strong>
            </div>
            <div className="stat-box">
              <span className="stat-label">Unread</span>
              <strong className={`stat-value ${unreadCount > 0 ? "highlight" : ""}`}>
                {unreadCount}
              </strong>
            </div>
            {unreadCount > 0 && (
              <button className="btn btn-secondary" onClick={handleMarkAllAsRead}>
                Mark All as Read
              </button>
            )}
          </div>

          <div className="notification-filters">
            <button
              className={`filter-button ${filter === "All" ? "active" : ""}`}
              onClick={() => setFilter("All")}
            >
              All
            </button>
            <button
              className={`filter-button ${filter === "booking" ? "active" : ""}`}
              onClick={() => setFilter("booking")}
            >
              Bookings
            </button>
            <button
              className={`filter-button ${filter === "payment" ? "active" : ""}`}
              onClick={() => setFilter("payment")}
            >
              Payments
            </button>
          </div>

          <div className="notifications-list">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? "read" : "unread"} ${getNotificationColor(notification.type)}`}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="notification-content">
                    <div className="notification-header">
                      <h4>{notification.title}</h4>
                      <span className="notification-time">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="notification-message">
                      {notification.message}
                    </p>
                    {notification.booking_id && (
                      <p className="notification-booking">
                        Booking: #{formatShortBookingId(notification.booking_id)}
                      </p>
                    )}
                  </div>

                  {!notification.read && (
                    <button
                      className="btn-read"
                      onClick={() => handleMarkAsRead(notification.id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No {filter !== "All" ? filter : ""} notifications</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StaffNotifications;
