import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, ExternalLink, X } from "lucide-react";
import {
  markAllAdminNotificationsAsRead,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToAllNotifications,
  subscribeToUserNotifications,
} from "../services/notificationService";
import {
  subscribeToAllBookings,
  subscribeToRiderBookings,
  subscribeToStaffBookings,
} from "../services/bookingService";
import {
  subscribeToAllPayments,
  subscribeToCustomerPayments,
} from "../services/paymentService";
import { formatShortBookingId } from "../utils/bookingId";
import { getBookingDisplayStatus, isPickupOnlyBooking } from "../utils/bookingFlow";
import "../styles/NotificationModal.css";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value) {
  const date = toDate(value);
  return date ? date.toISOString() : new Date().toISOString();
}

function formatRelativeTime(value) {
  const date = toDate(value);
  if (!date) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTypeIcon(type) {
  const icons = {
    booking: "📋",
    payment: "💳",
    progress: "🧺",
    pickup: "📦",
    status: "✅",
  };
  return icons[type] || "🔔";
}

function readLocalReadMap(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function writeLocalReadMap(storageKey, map) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export default function NotificationModal({
  open,
  onClose,
  role = "customer",
  userId = "",
  onUnreadCountChange,
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [firestoreItems, setFirestoreItems] = useState([]);
  const [derivedItems, setDerivedItems] = useState([]);
  const [localReadVersion, setLocalReadVersion] = useState(0);
  const [livePopupItem, setLivePopupItem] = useState(null);
  const seenUnreadIdsRef = useRef(null);

  const normalizedRole = String(role || "customer").toLowerCase();
  const localReadKey = useMemo(
    () =>
      normalizedRole === "customer"
        ? "laundrymateNotificationRead"
        : `laundrymateModalRead_${normalizedRole}_${userId || "anon"}`,
    [normalizedRole, userId]
  );

  // Subscribe to notifications & role-specific activity
  useEffect(() => {
    if (!userId && normalizedRole !== "admin") {
      return undefined;
    }

    const unsubscribers = [];

    if (normalizedRole === "admin") {
      unsubscribers.push(
        subscribeToAllNotifications(
          (items) => {
            setFirestoreItems(
              items.map((item) => ({
                id: item.id,
                type: item.type || "status",
                title: item.title || "LaundryMate Update",
                message: item.message || "",
                bookingId: item.booking_id || item.bookingId || null,
                createdAt: toIsoString(item.created_at),
                read: item.read === true,
                source: "firestore",
              }))
            );
          },
          (err) => console.error("Admin notification modal listener:", err)
        )
      );

      let latestPayments = [];
      let latestBookings = [];

      const rebuildAdminDerived = () => {
        const next = [];

        latestPayments
          .filter((p) => p.payment_status === "Pending")
          .slice(0, 20)
          .forEach((payment) => {
            next.push({
              id: `admin-payment-${payment.id}`,
              type: "payment",
              title: "Payment pending verification",
              message: `${payment.customer_name || "Customer"} submitted a ${
                payment.payment_method || "payment"
              } of ₱${Number(payment.amount || 0).toLocaleString("en-PH")} for booking #${formatShortBookingId(
                payment.booking_id || payment.id
              )}.`,
              bookingId: payment.booking_id || null,
              createdAt: toIsoString(payment.created_at),
              source: "local",
            });
          });

        latestBookings
          .filter((b) => String(b.status || "").toLowerCase() === "pending")
          .slice(0, 20)
          .forEach((booking) => {
            next.push({
              id: `admin-booking-${booking.id}`,
              type: "booking",
              title: "New booking awaiting staff",
              message: `${
                booking.customer_name || booking.customerName || "Customer"
              } placed booking #${formatShortBookingId(booking)} waiting for review.`,
              bookingId: booking.id,
              createdAt: toIsoString(booking.created_at || booking.booking_date),
              source: "local",
            });
          });

        setDerivedItems(next);
      };

      unsubscribers.push(
        subscribeToAllPayments(
          (payments) => {
            latestPayments = payments;
            rebuildAdminDerived();
          },
          (err) => console.error("Admin modal payments:", err)
        )
      );

      unsubscribers.push(
        subscribeToAllBookings(
          (bookings) => {
            latestBookings = bookings;
            rebuildAdminDerived();
          },
          (err) => console.error("Admin modal bookings:", err)
        )
      );
    } else if (normalizedRole === "staff") {
      unsubscribers.push(
        subscribeToUserNotifications(
          userId,
          (items) => {
            setFirestoreItems(
              items.map((item) => ({
                id: item.id,
                type: item.type || "status",
                title: item.title || "Staff Notification",
                message: item.message || "",
                bookingId: item.booking_id || item.bookingId || null,
                createdAt: toIsoString(item.created_at),
                read: item.read === true,
                source: "firestore",
              }))
            );
          },
          (err) => console.error("Staff notification modal:", err)
        )
      );

      let staffBookings = [];
      let staffPayments = [];

      const rebuildStaffDerived = () => {
        const next = [];

        staffBookings
          .filter((b) => String(b.status || "").toLowerCase() === "pending")
          .slice(0, 20)
          .forEach((booking) => {
            next.push({
              id: `staff-pending-booking-${booking.id}`,
              type: "booking",
              title: "Pending booking needs review",
              message: `${
                booking.customer_name || booking.customerName || "Customer"
              } submitted booking #${formatShortBookingId(booking)}.`,
              bookingId: booking.id,
              createdAt: toIsoString(booking.created_at || booking.booking_date),
              source: "local",
            });
          });

        staffPayments
          .filter((p) => p.payment_status === "Pending")
          .slice(0, 20)
          .forEach((payment) => {
            next.push({
              id: `staff-pending-payment-${payment.id}`,
              type: "payment",
              title: "Payment awaiting verification",
              message: `${
                payment.customer_name || "Customer"
              } submitted ₱${Number(payment.amount || 0).toLocaleString(
                "en-PH"
              )} (${payment.payment_method || "GCash"}) for booking #${formatShortBookingId(
                payment.booking_id || payment.id
              )}.`,
              bookingId: payment.booking_id || null,
              createdAt: toIsoString(payment.created_at),
              source: "local",
            });
          });

        setDerivedItems(next);
      };

      unsubscribers.push(
        subscribeToStaffBookings(
          userId,
          (bookings) => {
            staffBookings = bookings;
            rebuildStaffDerived();
          },
          (err) => console.error("Staff modal bookings:", err),
          false
        )
      );

      unsubscribers.push(
        subscribeToAllPayments(
          (payments) => {
            staffPayments = payments;
            rebuildStaffDerived();
          },
          (err) => console.error("Staff modal payments:", err)
        )
      );
    } else if (normalizedRole === "rider") {
      unsubscribers.push(
        subscribeToUserNotifications(
          userId,
          (items) => {
            setFirestoreItems(
              items.map((item) => ({
                id: item.id,
                type: item.type || "pickup",
                title: item.title || "Rider Update",
                message: item.message || "",
                bookingId: item.booking_id || item.bookingId || null,
                createdAt: toIsoString(item.created_at),
                read: item.read === true,
                source: "firestore",
              }))
            );
          },
          (err) => console.error("Rider notification modal:", err)
        )
      );

      unsubscribers.push(
        subscribeToRiderBookings(
          userId,
          (bookings) => {
            const next = bookings.slice(0, 25).map((booking) => {
              const displayStatus = getBookingDisplayStatus(booking);
              const shortId = formatShortBookingId(booking);
              const customer =
                booking.customer_name || booking.customerName || "Customer";
              const pickupOnly = isPickupOnlyBooking(booking);

              let title = `Booking #${shortId} · ${displayStatus}`;
              let message = `Assigned booking for ${customer}.`;
              let type = "booking";

              if (booking.status === "Ready for Pickup") {
                title = "📍 Ready for Pickup";
                message = `Pick up laundry from ${customer} for booking #${shortId}.`;
                type = "pickup";
              } else if (booking.status === "To Deliver" && !pickupOnly) {
                title = "🚚 Ready for Delivery";
                message = `Deliver laundry to ${customer} for booking #${shortId}.`;
                type = "progress";
              } else if (displayStatus === "Ready for pick up") {
                title = "📦 Ready for pick up (Pickup Only)";
                message = `Booking #${shortId} for ${customer} is ready for customer pick up at the shop.`;
                type = "pickup";
              }

              return {
                id: `rider-booking-${booking.id}-${booking.status || "Pending"}`,
                type,
                title,
                message,
                bookingId: booking.id,
                createdAt: toIsoString(
                  booking.updated_at ||
                    booking.updatedAt ||
                    booking.booking_date ||
                    booking.created_at
                ),
                source: "local",
              };
            });

            setDerivedItems(next);
          },
          (err) => console.error("Rider modal bookings:", err),
          false
        )
      );
    } else {
      // Customer
      unsubscribers.push(
        subscribeToUserNotifications(
          userId,
          (items) => {
            setFirestoreItems(
              items
                .filter((item) => item.type !== "payment")
                .map((item) => ({
                  id: item.id,
                  type: item.type || "status",
                  title: item.title || "LaundryMate Update",
                  message: item.message || "",
                  bookingId: item.booking_id || item.bookingId || null,
                  createdAt: toIsoString(item.created_at),
                  read: item.read === true,
                  source: "firestore",
                }))
            );
          },
          (err) => console.error("Customer modal notifications:", err)
        )
      );

      unsubscribers.push(
        subscribeToCustomerPayments(
          userId,
          (payments) => {
            const next = payments.map((payment, index) => {
              const paymentId =
                payment.payment_id ||
                payment.id ||
                `PAY-${String(index + 1).padStart(3, "0")}`;
              const shortId = formatShortBookingId(payment.booking_id || "N/A");
              const amount = Number(
                payment.total_amount || payment.amount || 0
              ).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const status = String(
                payment.payment_status || "Pending"
              ).toLowerCase();

              let title = "Payment Pending";
              let message = `Your payment of ₱${amount} for booking #${shortId} is pending verification.`;

              if (status === "paid") {
                title = "Payment Confirmed";
                message = `Your payment of ₱${amount} for booking #${shortId} has been confirmed.`;
              } else if (status === "rejected" || status === "failed") {
                title = "Payment Rejected";
                message = `Your payment for booking #${shortId} was rejected. Please resubmit.`;
              }

              return {
                id: `payment-${paymentId}`,
                type: "payment",
                title,
                message,
                bookingId: payment.booking_id || null,
                createdAt: toIsoString(
                  payment.updated_at || payment.created_at || payment.payment_date
                ),
                source: "local",
              };
            });

            setDerivedItems(next);
          },
          (err) => console.error("Customer modal payments:", err)
        )
      );
    }

    const syncLocalRead = () => setLocalReadVersion((v) => v + 1);
    window.addEventListener("laundrymateNotificationUpdated", syncLocalRead);
    window.addEventListener("storage", syncLocalRead);

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
      window.removeEventListener(
        "laundrymateNotificationUpdated",
        syncLocalRead
      );
      window.removeEventListener("storage", syncLocalRead);
    };
  }, [normalizedRole, userId]);

  const notifications = useMemo(() => {
    void localReadVersion;
    const localReadMap = readLocalReadMap(localReadKey);

    const mappedDerived = derivedItems.map((item) => ({
      ...item,
      read: Boolean(localReadMap[item.id]),
    }));

    const combined = [...firestoreItems, ...mappedDerived];
    combined.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
    return combined;
  }, [firestoreItems, derivedItems, localReadKey, localReadVersion]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read),
    [notifications]
  );

  const unreadCount = unreadNotifications.length;

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // Pop up an on-screen modal card automatically when a new unread notification arrives
  useEffect(() => {
    const currentUnreadIds = new Set(unreadNotifications.map((item) => item.id));

    if (seenUnreadIdsRef.current === null) {
      seenUnreadIdsRef.current = currentUnreadIds;
      return;
    }

    const newlyArrived = unreadNotifications.find(
      (item) => !seenUnreadIdsRef.current.has(item.id)
    );
    seenUnreadIdsRef.current = currentUnreadIds;

    if (newlyArrived && !open) {
      setLivePopupItem(newlyArrived);
    }
  }, [unreadNotifications, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const markItemRead = useCallback(
    async (item) => {
      if (!item || item.read) return;

      if (item.source === "firestore") {
        try {
          await markNotificationAsRead(item.id);
          setFirestoreItems((curr) =>
            curr.map((n) => (n.id === item.id ? { ...n, read: true } : n))
          );
        } catch (err) {
          console.error("Unable to mark notification as read:", err);
        }
        return;
      }

      const map = readLocalReadMap(localReadKey);
      map[item.id] = true;
      writeLocalReadMap(localReadKey, map);
      setLocalReadVersion((v) => v + 1);
      window.dispatchEvent(new Event("laundrymateNotificationUpdated"));
    },
    [localReadKey]
  );

  const handleMarkAllRead = async () => {
    try {
      if (normalizedRole === "admin") {
        await markAllAdminNotificationsAsRead();
      } else if (userId) {
        await markAllNotificationsAsRead(userId);
      }
      setFirestoreItems((curr) => curr.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Unable to mark all Firestore notifications as read:", err);
    }

    const map = readLocalReadMap(localReadKey);
    derivedItems.forEach((item) => {
      map[item.id] = true;
    });
    writeLocalReadMap(localReadKey, map);
    setLocalReadVersion((v) => v + 1);
    window.dispatchEvent(new Event("laundrymateNotificationUpdated"));
  };

  const visibleItems = useMemo(() => {
    if (filter === "unread") {
      return unreadNotifications;
    }
    return notifications;
  }, [filter, notifications, unreadNotifications]);

  const fullPageRoute =
    normalizedRole === "admin"
      ? "/admin/notifications"
      : normalizedRole === "staff"
        ? "/staff/notifications"
        : normalizedRole === "rider"
          ? "/rider/transactions"
          : "/customer/notification";

  return (
    <>
      {/* Live incoming notification pop-up modal alert */}
      {livePopupItem && !open && (
        <div
          className="lm-notif-toast-modal"
          role="dialog"
          aria-live="polite"
          aria-label="New notification"
        >
          <div className="lm-notif-toast-icon">
            {getTypeIcon(livePopupItem.type)}
          </div>
          <div className="lm-notif-toast-body">
            <span className="lm-notif-toast-eyebrow">New Notification</span>
            <strong>{livePopupItem.title}</strong>
            <p>{livePopupItem.message}</p>
          </div>
          <button
            type="button"
            className="lm-notif-toast-close"
            onClick={() => setLivePopupItem(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main on-screen Notifications Modal when clicking the notification badge */}
      {open && (
        <div
          className="lm-notif-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose?.();
            }
          }}
        >
          <div
            className="lm-notif-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lm-notif-modal-title"
          >
            <div className="lm-notif-modal-header">
              <div className="lm-notif-modal-title-wrap">
                <span className="lm-notif-modal-bell">
                  <Bell size={19} />
                </span>
                <div>
                  <h2 id="lm-notif-modal-title">Notifications</h2>
                  <p>
                    {unreadCount > 0
                      ? `You have ${unreadCount} unread notification${
                          unreadCount === 1 ? "" : "s"
                        }`
                      : "You’re all caught up"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="lm-notif-modal-close"
                onClick={onClose}
                aria-label="Close notifications modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="lm-notif-modal-toolbar">
              <div className="lm-notif-modal-tabs">
                <button
                  type="button"
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  className={filter === "unread" ? "active" : ""}
                  onClick={() => setFilter("unread")}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  className="lm-notif-mark-all-btn"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck size={15} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="lm-notif-modal-list">
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className={`lm-notif-item ${
                      item.read ? "is-read" : "is-unread"
                    }`}
                    onClick={() => markItemRead(item)}
                  >
                    <div className="lm-notif-item-icon">
                      {getTypeIcon(item.type)}
                    </div>

                    <div className="lm-notif-item-content">
                      <div className="lm-notif-item-top">
                        <strong>{item.title}</strong>
                        <span className="lm-notif-item-time">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p>{item.message}</p>

                      {item.bookingId && item.bookingId !== "N/A" && (
                        <span className="lm-notif-item-booking">
                          Booking #{formatShortBookingId(item.bookingId)}
                        </span>
                      )}
                    </div>

                    {!item.read && (
                      <button
                        type="button"
                        className="lm-notif-item-read-btn"
                        title="Mark as read"
                        aria-label="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markItemRead(item);
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="lm-notif-empty">
                  <div className="lm-notif-empty-icon">🔔</div>
                  <strong>
                    {filter === "unread"
                      ? "No unread notifications"
                      : "No notifications yet"}
                  </strong>
                  <span>
                    {filter === "unread"
                      ? "Switch to All to review past updates."
                      : "New booking and payment updates will appear here."}
                  </span>
                </div>
              )}
            </div>

            <div className="lm-notif-modal-footer">
              <button
                type="button"
                className="lm-notif-view-page-btn"
                onClick={() => {
                  onClose?.();
                  navigate(fullPageRoute);
                }}
              >
                <ExternalLink size={15} />
                <span>
                  {normalizedRole === "rider"
                    ? "Open Assigned Bookings"
                    : "View All Notifications"}
                </span>
              </button>

              <button
                type="button"
                className="lm-notif-done-btn"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
