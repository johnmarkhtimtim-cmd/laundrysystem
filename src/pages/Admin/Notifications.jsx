import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { subscribeToAllBookings } from "../../services/bookingService";
import {
  deleteNotification,
  markAllAdminNotificationsAsRead,
  markNotificationAsRead,
  subscribeToAllNotifications,
} from "../../services/notificationService";
import { subscribeToAllPayments } from "../../services/paymentService";

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

export default function Notifications() {
  const [firestoreItems, setFirestoreItems] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissedActivity, setDismissedActivity] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("laundrymateAdminDismissedAlerts") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const unsubNotifications = subscribeToAllNotifications(
      (items) => {
        setFirestoreItems(
          items.map((item) => ({
            id: item.id,
            title: item.title || "LaundryMate update",
            message: item.message || "",
            read: item.read === true,
            createdAt: toIso(item.created_at),
            source: "firestore",
          }))
        );
        setLoading(false);
      },
      (loadError) => {
        console.error(loadError);
        setError("Unable to load stored notifications.");
        setLoading(false);
      }
    );

    let payments = [];
    let bookings = [];

    const rebuildActivity = () => {
      const alerts = [];

      payments
        .filter((payment) => payment.payment_status === "Pending")
        .slice(0, 20)
        .forEach((payment) => {
          alerts.push({
            id: `payment-${payment.id}`,
            title: "Payment pending verification",
            message: `${payment.customer_name || "Customer"} submitted a ${
              payment.payment_method || "payment"
            } of ₱${Number(payment.amount || 0).toLocaleString("en-PH")} for booking #${
              payment.booking_id?.slice(-6) || "N/A"
            }.`,
            read: false,
            createdAt: toIso(payment.created_at),
            source: "activity",
          });
        });

      bookings
        .filter((booking) => String(booking.status || "").toLowerCase() === "pending")
        .slice(0, 20)
        .forEach((booking) => {
          alerts.push({
            id: `booking-${booking.id}`,
            title: "New booking awaiting staff",
            message: `${
              booking.customer_name || "Customer"
            } placed a booking that still needs acceptance.`,
            read: false,
            createdAt: toIso(booking.created_at || booking.booking_date),
            source: "activity",
          });
        });

      alerts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setActivityItems(alerts);
    };

    const unsubPayments = subscribeToAllPayments(
      (list) => {
        payments = list;
        rebuildActivity();
      },
      (paymentError) => console.error(paymentError)
    );

    const unsubBookings = subscribeToAllBookings(
      (list) => {
        bookings = list;
        rebuildActivity();
      },
      (bookingError) => console.error(bookingError)
    );

    return () => {
      unsubNotifications?.();
      unsubPayments?.();
      unsubBookings?.();
    };
  }, []);

  const items = useMemo(() => {
    const dismissed = new Set(dismissedActivity);
    return [...firestoreItems, ...activityItems.filter((item) => !dismissed.has(item.id))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [firestoreItems, activityItems, dismissedActivity]);

  const unreadCount = items.filter((item) => !item.read).length;

  const markAllRead = async () => {
    try {
      await markAllAdminNotificationsAsRead();
      setFirestoreItems((current) =>
        current.map((item) => ({ ...item, read: true }))
      );
      setActivityItems((current) =>
        current.map((item) => ({ ...item, read: true }))
      );
    } catch (markError) {
      console.error(markError);
      alert("Could not mark notifications as read.");
    }
  };

  const removeItem = async (item) => {
    if (item.source === "firestore") {
      try {
        await deleteNotification(item.id);
      } catch (deleteError) {
        console.error(deleteError);
        alert("Could not remove notification.");
      }
      return;
    }

    const next = [...dismissedActivity, item.id];
    setDismissedActivity(next);
    localStorage.setItem(
      "laundrymateAdminDismissedAlerts",
      JSON.stringify(next)
    );
  };

  const markOneRead = async (item) => {
    if (item.source !== "firestore" || item.read) return;
    try {
      await markNotificationAsRead(item.id);
    } catch (readError) {
      console.error(readError);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Notifications"
        description="Live payment, booking, and system activity."
      />
      <section className="portal-card notification-list">
        <div className="section-heading">
          <strong>
            {loading ? "Loading…" : `${unreadCount} unread notifications`}
          </strong>
          <button className="light-action" type="button" onClick={markAllRead}>
            Mark all as read
          </button>
        </div>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        {!loading && items.length === 0 ? (
          <p style={{ color: "#64748b" }}>No notifications yet.</p>
        ) : (
          items.map((item) => (
            <article
              className={item.read ? "read" : "unread"}
              key={item.id}
              onClick={() => markOneRead(item)}
            >
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </div>
              <button type="button" onClick={() => removeItem(item)}>
                Remove
              </button>
            </article>
          ))
        )}
      </section>
    </>
  );
}
