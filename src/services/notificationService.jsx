import { 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  deleteDoc,
  query,
  where,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { formatShortBookingId } from "../utils/bookingId";

const getTimestampMilliseconds = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * Create a notification
 * @param {string} userId - User ID (customer or staff)
 * @param {string} type - Notification type (booking, payment, progress, pickup, status)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} bookingId - Associated booking ID
 * @returns {Promise<string>} Notification ID
 */
export const createNotification = async (userId, type, title, message, bookingId = null) => {
  try {
    const notificationRef = doc(collection(db, "notifications"));
    
    const notification = {
      notification_id: notificationRef.id,
      user_id: userId,
      type: type, // 'booking', 'payment', 'progress', 'pickup', 'status'
      title: title,
      message: message,
      booking_id: bookingId,
      read: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await setDoc(notificationRef, notification);
    return notificationRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of notifications to fetch
 * @returns {Promise<array>} Array of notifications
 */
export const getUserNotifications = async (userId, limit = 20) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((notificationDoc) => ({
        id: notificationDoc.id,
        ...notificationDoc.data(),
      }))
      .sort(
        (a, b) =>
          getTimestampMilliseconds(b.created_at) -
          getTimestampMilliseconds(a.created_at)
      )
      .slice(0, limit);
  } catch (error) {
    console.error("Error getting user notifications:", error);
    throw error;
  }
};

/**
 * Subscribe to notifications for a user.
 * @param {string} userId - User ID
 * @param {Function} onNotifications - Called with the user's notifications
 * @param {Function} onError - Called when the Firestore listener fails
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserNotifications = (userId, onNotifications, onError) => {
  const q = query(
    collection(db, "notifications"),
    where("user_id", "==", userId)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const notifications = querySnapshot.docs.map((notificationDoc) => ({
          id: notificationDoc.id,
          ...notificationDoc.data(),
        }));
      notifications.sort(
        (a, b) =>
          getTimestampMilliseconds(b.created_at) -
          getTimestampMilliseconds(a.created_at)
      );
      onNotifications(notifications.slice(0, 50));
    },
    onError
  );
};

/**
 * Subscribe to every notification (admin inbox).
 */
export const subscribeToAllNotifications = (onNotifications, onError) => {
  return onSnapshot(
    collection(db, "notifications"),
    (querySnapshot) => {
      const notifications = querySnapshot.docs.map((notificationDoc) => ({
        id: notificationDoc.id,
        ...notificationDoc.data(),
      }));
      notifications.sort(
        (a, b) =>
          getTimestampMilliseconds(b.created_at) -
          getTimestampMilliseconds(a.created_at)
      );
      onNotifications(notifications.slice(0, 100));
    },
    onError
  );
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Delete a notification document.
 */
export const deleteNotification = async (notificationId) => {
  await deleteDoc(doc(db, "notifications", notificationId));
};

/**
 * Mark every unread notification as read (admin).
 */
export const markAllAdminNotificationsAsRead = async () => {
  const querySnapshot = await getDocs(collection(db, "notifications"));
  for (const snapshot of querySnapshot.docs.filter(
    (item) => item.data().read !== true
  )) {
    await updateDoc(doc(db, "notifications", snapshot.id), {
      read: true,
      updated_at: serverTimestamp(),
    });
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    for (const docSnapshot of querySnapshot.docs.filter(
      (snapshot) => snapshot.data().read !== true
    )) {
      await updateDoc(doc(db, "notifications", docSnapshot.id), {
        read: true,
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Get unread notifications count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadNotificationsCount = async (userId) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.filter(
      (docSnapshot) => docSnapshot.data().read !== true
    ).length;
  } catch (error) {
    console.error("Error getting unread notifications count:", error);
    throw error;
  }
};

/**
 * Notify customer when booking is accepted
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyBookingAccepted = async (
  customerId,
  bookingId,
  riderName = ""
) => {
  const details = getBookingStatusNotificationDetails(bookingId, "Accepted", {
    riderName,
  });
  return createNotification(
    customerId,
    details.type,
    details.title,
    details.message,
    bookingId
  );
};

/**
 * Notify customer when laundry is picked up
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyLaundryPickedUp = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "pickup",
    "🧺 Laundry Picked Up",
    `Your laundry from booking #${shortId} has been picked up and is being processed.`,
    bookingId
  );
};

/**
 * Notify customer when washing starts
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyWashingStarted = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "progress",
    "🌊 Washing Started",
    `Your laundry from booking #${shortId} is now being washed.`,
    bookingId
  );
};

/**
 * Notify customer when drying starts
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyDryingStarted = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "progress",
    "🌬️ Drying Started",
    `Your laundry from booking #${shortId} is now being dried.`,
    bookingId
  );
};

/**
 * Notify customer when folding starts
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyFoldingStarted = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "progress",
    "📦 Folding Started",
    `Your laundry from booking #${shortId} is now being folded.`,
    bookingId
  );
};

/**
 * Notify customer when laundry is ready for pickup
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyReadyForPickup = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "pickup",
    "✅ Ready for Pickup",
    `Your laundry from booking #${shortId} is ready for you to pickup!`,
    bookingId
  );
};

/**
 * Notify customer when booking is completed
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<string>} Notification ID
 */
export const notifyBookingCompleted = async (customerId, bookingId) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "status",
    "🎉 Booking Completed",
    `Your booking #${shortId} has been completed. Thank you for using LaundryMate!`,
    bookingId
  );
};

/**
 * Notify a customer when staff changes a booking's status.
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @param {string} status - New booking status
 * @returns {Promise<string>} Notification ID
 */
export const notifyBookingStatusChanged = async (customerId, bookingId, status) => {
  const details = getBookingStatusNotificationDetails(bookingId, status);

  return createNotification(
    customerId,
    details.type,
    details.title,
    details.message,
    bookingId
  );
};

export const getBookingStatusNotificationDetails = (
  bookingId,
  status,
  extras = {}
) => {
  const shortId = formatShortBookingId(bookingId);
  const riderName = String(extras.riderName || "").trim();
  const acceptedMessage = riderName
    ? `Your booking #${shortId} has been accepted. Pickup rider: ${riderName}.`
    : `Your booking #${shortId} has been accepted by our staff.`;

  const statusDetails = {
    Accepted: {
      type: "booking",
      title: "✓ Booking Accepted",
      message: acceptedMessage,
    },
    Declined: {
      type: "booking",
      title: "Booking Declined",
      message: `Your booking #${shortId} has been declined. Please contact us if you need assistance.`,
    },
    "Ready for Pickup": {
      type: "pickup",
      title: "✅ Ready for Pickup",
      message: riderName
        ? `Your laundry from booking #${shortId} is ready for pickup. Rider: ${riderName}.`
        : `Your laundry from booking #${shortId} is ready for pickup.`,
    },
    "Picked Up": {
      type: "pickup",
      title: "🧺 Laundry Picked Up",
      message: riderName
        ? `Your laundry from booking #${shortId} has been picked up by ${riderName}.`
        : `Your laundry from booking #${shortId} has been picked up.`,
    },
    "In Laundry": {
      type: "progress",
      title: "Laundry In Progress",
      message: `Your laundry from booking #${shortId} is now being processed.`,
    },
    Washing: {
      type: "progress",
      title: "🌊 Washing Started",
      message: `Your laundry from booking #${shortId} is now being washed.`,
    },
    Drying: {
      type: "progress",
      title: "🌬️ Drying Started",
      message: `Your laundry from booking #${shortId} is now being dried.`,
    },
    Folding: {
      type: "progress",
      title: "📦 Folding Started",
      message: `Your laundry from booking #${shortId} is now being folded.`,
    },
    "To Deliver": {
      type: "progress",
      title: "Laundry Out for Delivery",
      message: riderName
        ? `Your laundry from booking #${shortId} is on its way with ${riderName}.`
        : `Your laundry from booking #${shortId} is on its way to you.`,
    },
    "Ready for Customer Pickup": {
      type: "pickup",
      title: "✅ Ready for Pickup",
      message: `Your laundry from booking #${shortId} is ready for you to collect.`,
    },
    Delivered: {
      type: "status",
      title: "Laundry Delivered",
      message: `Your laundry from booking #${shortId} has been delivered.`,
    },
    Completed: {
      type: "status",
      title: "🎉 Booking Completed",
      message: `Your booking #${shortId} has been completed. Thank you for using LaundryMate!`,
    },
  };

  const details = statusDetails[status] || {
    type: "status",
    title: `${status} Update`,
    message: `Your booking #${shortId} status has been updated to ${status}.`,
  };

  return details;
};

/**
 * Notify customer of payment confirmation
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Payment amount
 * @returns {Promise<string>} Notification ID
 */
export const notifyPaymentConfirmed = async (customerId, bookingId, amount) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "payment",
    "Payment Confirmed",
    `Payment of ₱${amount} for booking #${shortId} has been confirmed.`,
    bookingId
  );
};

/**
 * Notify customer that a payment was rejected and needs resubmission.
 */
export const notifyPaymentRejected = async (customerId, bookingId, amount) => {
  const shortId = formatShortBookingId(bookingId);
  return createNotification(
    customerId,
    "payment",
    "Payment Rejected",
    `Payment of ₱${amount} for booking #${shortId} was rejected. Please resubmit with correct details.`,
    bookingId
  );
};

/**
 * Notify staff/admin users that a customer submitted (or resubmitted) a payment.
 */
export const notifyStaffPaymentSubmitted = async ({
  recipientIds = [],
  bookingId,
  amount = 0,
  paymentMethod = "payment",
  customerName = "Customer",
  isResubmit = false,
} = {}) => {
  const uniqueRecipientIds = [...new Set(recipientIds.filter(Boolean))];
  if (uniqueRecipientIds.length === 0 || !bookingId) return [];

  const shortId = formatShortBookingId(bookingId);
  const formattedAmount = Number(amount || 0).toLocaleString("en-PH");
  const title = isResubmit
    ? "Payment resubmitted for verification"
    : "Payment pending verification";
  const message = `${customerName} ${
    isResubmit ? "resubmitted" : "submitted"
  } a ${paymentMethod || "payment"} of ₱${formattedAmount} for booking #${shortId}.`;

  return Promise.all(
    uniqueRecipientIds.map((recipientId) =>
      createNotification(recipientId, "payment", title, message, bookingId)
    )
  );
};

/**
 * Notify customer that their payment was submitted and is pending verification.
 */
export const notifyCustomerPaymentSubmitted = async ({
  customerId,
  bookingId,
  amount = 0,
  paymentMethod = "GCash",
  isResubmit = false,
} = {}) => {
  if (!customerId || !bookingId) return null;

  const shortId = formatShortBookingId(bookingId);
  const formattedAmount = Number(amount || 0).toLocaleString("en-PH");
  const title = isResubmit
    ? "Payment Resubmitted"
    : "Payment Submitted";
  const message = `Your ${paymentMethod || "payment"} of ₱${formattedAmount} for booking #${shortId} has been submitted and is pending staff verification.`;

  return createNotification(customerId, "payment", title, message, bookingId);
};
