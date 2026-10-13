import { 
  collection, 
  doc, 
  setDoc, 
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  onSnapshot,
  limit as firestoreLimit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

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
      where("user_id", "==", userId),
      orderBy("created_at", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const notifications = [];
    let count = 0;
    
    querySnapshot.forEach((doc) => {
      if (count < limit) {
        notifications.push({ id: doc.id, ...doc.data() });
        count++;
      }
    });
    
    return notifications;
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
    where("user_id", "==", userId),
    orderBy("created_at", "desc"),
    firestoreLimit(50)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      onNotifications(
        querySnapshot.docs.map((notificationDoc) => ({
          id: notificationDoc.id,
          ...notificationDoc.data(),
        }))
      );
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
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", userId),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    
    for (const docSnapshot of querySnapshot.docs) {
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
      where("user_id", "==", userId),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
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
export const notifyBookingAccepted = async (customerId, bookingId) => {
  return createNotification(
    customerId,
    "booking",
    "✓ Booking Accepted",
    `Your booking #${bookingId} has been accepted by our staff.`,
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
  return createNotification(
    customerId,
    "pickup",
    "🧺 Laundry Picked Up",
    `Your laundry from booking #${bookingId} has been picked up and is being processed.`,
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
  return createNotification(
    customerId,
    "progress",
    "🌊 Washing Started",
    `Your laundry from booking #${bookingId} is now being washed.`,
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
  return createNotification(
    customerId,
    "progress",
    "🌬️ Drying Started",
    `Your laundry from booking #${bookingId} is now being dried.`,
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
  return createNotification(
    customerId,
    "progress",
    "📦 Folding Started",
    `Your laundry from booking #${bookingId} is now being folded.`,
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
  return createNotification(
    customerId,
    "pickup",
    "✅ Ready for Pickup",
    `Your laundry from booking #${bookingId} is ready for you to pickup!`,
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
  return createNotification(
    customerId,
    "status",
    "🎉 Booking Completed",
    `Your booking #${bookingId} has been completed. Thank you for using LaundryMate!`,
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
  const statusDetails = {
    Accepted: {
      type: "booking",
      title: "✓ Booking Accepted",
      message: `Your booking #${bookingId} has been accepted by our staff.`,
    },
    Declined: {
      type: "booking",
      title: "Booking Declined",
      message: `Your booking #${bookingId} has been declined. Please contact us if you need assistance.`,
    },
    "Ready for Pickup": {
      type: "pickup",
      title: "✅ Ready for Pickup",
      message: `Your laundry from booking #${bookingId} is ready for pickup.`,
    },
    "Picked Up": {
      type: "pickup",
      title: "🧺 Laundry Picked Up",
      message: `Your laundry from booking #${bookingId} has been picked up.`,
    },
    "In Laundry": {
      type: "progress",
      title: "Laundry In Progress",
      message: `Your laundry from booking #${bookingId} is now being processed.`,
    },
    Washing: {
      type: "progress",
      title: "🌊 Washing Started",
      message: `Your laundry from booking #${bookingId} is now being washed.`,
    },
    Drying: {
      type: "progress",
      title: "🌬️ Drying Started",
      message: `Your laundry from booking #${bookingId} is now being dried.`,
    },
    Folding: {
      type: "progress",
      title: "📦 Folding Started",
      message: `Your laundry from booking #${bookingId} is now being folded.`,
    },
    "To Deliver": {
      type: "progress",
      title: "Laundry Out for Delivery",
      message: `Your laundry from booking #${bookingId} is on its way to you.`,
    },
    "Ready for Customer Pickup": {
      type: "pickup",
      title: "✅ Ready for Pickup",
      message: `Your laundry from booking #${bookingId} is ready for you to collect.`,
    },
    Delivered: {
      type: "status",
      title: "Laundry Delivered",
      message: `Your laundry from booking #${bookingId} has been delivered.`,
    },
    Completed: {
      type: "status",
      title: "🎉 Booking Completed",
      message: `Your booking #${bookingId} has been completed. Thank you for using LaundryMate!`,
    },
  };

  const details = statusDetails[status] || {
    type: "status",
    title: `${status} Update`,
    message: `Your booking #${bookingId} status has been updated to ${status}.`,
  };

  return createNotification(
    customerId,
    details.type,
    details.title,
    details.message,
    bookingId
  );
};

/**
 * Notify customer of payment confirmation
 * @param {string} customerId - Customer ID
 * @param {string} bookingId - Booking ID
 * @param {number} amount - Payment amount
 * @returns {Promise<string>} Notification ID
 */
export const notifyPaymentConfirmed = async (customerId, bookingId, amount) => {
  return createNotification(
    customerId,
    "payment",
    "💳 Payment Confirmed",
    `Payment of ₱${amount} for booking #${bookingId} has been confirmed.`,
    bookingId
  );
};
