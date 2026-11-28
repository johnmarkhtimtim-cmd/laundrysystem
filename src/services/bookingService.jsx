import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  runTransaction,
  updateDoc, 
  query, 
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { getBookingStatusNotificationDetails } from "./notificationService";
import { getGeneralSettings } from "./paymentService";
import {
  READY_FOR_CUSTOMER_PICKUP_STATUS,
  isPickupOnlyBooking,
} from "../utils/bookingFlow";

const CAPACITY_EXCLUDED_STATUSES = new Set([
  "Declined",
  "Cancelled",
  "Canceled",
]);

export const getLocalDateKey = (value = new Date()) => {
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeScheduleDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }
  return getLocalDateKey(value);
};

const bookingCountsTowardCapacity = (booking) => {
  const status = String(booking?.status || "").trim();
  if (CAPACITY_EXCLUDED_STATUSES.has(status)) return false;
  if (booking?.archived === true || booking?.isArchived === true) return false;
  return true;
};

const capacityDocRef = (dateKey) => doc(db, "bookingCapacity", dateKey);

/**
 * Normalize a Firestore booking doc so document id always wins, and
 * booking_id / bookingId stay aligned for customer + staff UIs.
 */
const mapBookingDoc = (bookingDoc) => {
  const data = bookingDoc?.data?.() || {};
  const id = bookingDoc.id;

  return {
    ...data,
    id,
    booking_id: data.booking_id || id,
    bookingId: data.bookingId || data.booking_id || id,
  };
};

const mapPaymentDoc = (paymentDoc) => {
  const data = paymentDoc?.data?.() || {};
  return {
    ...data,
    id: paymentDoc.id,
    booking_id: data.booking_id || data.bookingId || null,
  };
};

const attachPaymentToBooking = (booking, paymentByBooking) => {
  const keys = [booking.id, booking.booking_id, booking.bookingId]
    .filter(Boolean)
    .map(String);

  let payment = null;
  for (const key of keys) {
    payment = paymentByBooking.get(key);
    if (payment) break;
  }

  return { ...booking, payment: payment || null };
};

/**
 * Read daily used count from a shared counter.
 * Customers cannot query all bookings, so capacity uses this doc instead.
 */
export const getCapacityUsed = async (dateKey) => {
  const key = normalizeScheduleDateKey(dateKey);
  if (!key) return 0;

  try {
    const snap = await getDoc(capacityDocRef(key));
    if (!snap.exists()) return 0;
    const used = Number(snap.data()?.used);
    return Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  } catch (error) {
    console.error("Error reading booking capacity:", error);
    return 0;
  }
};

/**
 * Count active bookings scheduled for a specific YYYY-MM-DD date.
 * Only works for roles that can list bookings (admin/staff). Prefer getCapacityUsed for customers.
 */
export const countBookingsForScheduleDate = async (dateKey) => {
  const key = normalizeScheduleDateKey(dateKey);
  if (!key) return 0;

  const snapshot = await getDocs(
    query(collection(db, "bookings"), where("schedule", "==", key))
  );

  return snapshot.docs.reduce((total, bookingDoc) => {
    const booking = mapBookingDoc(bookingDoc);
    return bookingCountsTowardCapacity(booking) ? total + 1 : total;
  }, 0);
};

/**
 * Live daily capacity status for Admin / Staff / Customer UIs.
 * maxBookingsPerDay === 0 blocks all new bookings until admin sets a positive limit.
 */
export const getDailyBookingCapacityStatus = async (dateKey) => {
  const key = normalizeScheduleDateKey(dateKey) || getLocalDateKey();
  const settings = await getGeneralSettings();
  const parsedMax = Number(settings.maxBookingsPerDay);
  const max = Number.isFinite(parsedMax) && parsedMax >= 0 ? Math.floor(parsedMax) : 0;
  const closed = max <= 0;

  // Prefer shared counter so customers are not blocked by bookings list permissions.
  let used = await getCapacityUsed(key);
  try {
    const liveCount = await countBookingsForScheduleDate(key);
    if (Number.isFinite(liveCount)) {
      used = Math.max(used, liveCount);
    }
  } catch {
    // Expected for customers — keep counter value.
  }

  const remaining = closed ? 0 : Math.max(max - used, 0);

  return {
    date: key,
    max,
    used,
    remaining,
    isFull: closed || used >= max,
    closed,
    unlimited: false,
  };
};

/**
 * Live capacity for a pickup date — updates when admin changes max bookings
 * or when the shared daily counter changes (no page refresh needed).
 */
export const subscribeToDailyBookingCapacityStatus = (
  dateKey,
  onStatus,
  onError
) => {
  const key = normalizeScheduleDateKey(dateKey) || getLocalDateKey();
  if (!key) {
    onStatus?.({
      date: null,
      max: 0,
      used: 0,
      remaining: 0,
      isFull: true,
      closed: true,
      unlimited: false,
    });
    return () => {};
  }

  let max = 0;
  let used = 0;
  let settingsReady = false;
  let capacityReady = false;

  const emit = () => {
    if (!settingsReady || !capacityReady) return;

    const closed = max <= 0;
    const remaining = closed ? 0 : Math.max(max - used, 0);

    onStatus?.({
      date: key,
      max,
      used,
      remaining,
      isFull: closed || used >= max,
      closed,
      unlimited: false,
    });
  };

  const settingsUnsubscribe = onSnapshot(
    doc(db, "settings", "general"),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const parsedMax = Number(data.maxBookingsPerDay);
      max =
        Number.isFinite(parsedMax) && parsedMax >= 0
          ? Math.floor(parsedMax)
          : 50;
      settingsReady = true;
      emit();
    },
    (error) => {
      console.error("Error listening to capacity settings:", error);
      onError?.(error);
    }
  );

  const capacityUnsubscribe = onSnapshot(
    capacityDocRef(key),
    (snap) => {
      if (!snap.exists()) {
        used = 0;
      } else {
        const raw = Number(snap.data()?.used);
        used = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
      }
      capacityReady = true;
      emit();
    },
    (error) => {
      console.error("Error listening to booking capacity:", error);
      onError?.(error);
    }
  );

  return () => {
    settingsUnsubscribe();
    capacityUnsubscribe();
  };
};

const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  // Only recurse plain objects — keep Firestore FieldValue/Timestamp intact
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)])
    );
  }
  return value;
};

const getTimestampMilliseconds = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const STAFF_BOOKING_TRANSITIONS = {
  Accepted: ["Ready for Pickup"],
  "Ready for Pickup": ["In Laundry"],
  "In Laundry": ["To Deliver", READY_FOR_CUSTOMER_PICKUP_STATUS],
  "Picked Up": ["To Deliver", READY_FOR_CUSTOMER_PICKUP_STATUS],
  Washing: ["To Deliver", READY_FOR_CUSTOMER_PICKUP_STATUS],
  Drying: ["To Deliver", READY_FOR_CUSTOMER_PICKUP_STATUS],
  Folding: ["To Deliver", READY_FOR_CUSTOMER_PICKUP_STATUS],
  "To Deliver": ["Delivered", "Completed"],
  [READY_FOR_CUSTOMER_PICKUP_STATUS]: ["Completed", "Delivered"],
};

const isActiveRiderAccount = (riderData = {}) => {
  const status = String(riderData.status || "Active").trim().toLowerCase();
  return status === "active" || status === "";
};

const getRiderDisplayName = (riderData = {}) => {
  const combinedName = `${riderData.firstName || ""} ${riderData.lastName || ""}`.trim();
  return (
    String(riderData.name || "").trim() ||
    combinedName ||
    String(riderData.displayName || "").trim() ||
    String(riderData.email || "").trim() ||
    "Rider"
  );
};

const addBookingStatusNotification = (
  transaction,
  booking,
  bookingId,
  status,
  extras = {}
) => {
  const customerId = booking.customer_id || booking.customerId || booking.userId;
  if (!customerId) {
    throw new Error(
      `Booking ${bookingId} has no customer user ID; status was not updated.`
    );
  }

  const details = getBookingStatusNotificationDetails(bookingId, status, {
    ...extras,
    riderName:
      extras.riderName || booking.rider_name || booking.riderName || "",
  });
  const notificationRef = doc(collection(db, "notifications"));

  transaction.set(notificationRef, {
    notification_id: notificationRef.id,
    user_id: customerId,
    type: details.type,
    title: details.title,
    message: details.message,
    booking_id: bookingId,
    read: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
};

/**
 * Create a new booking
 * @param {string} customerId - Customer ID
 * @param {string} serviceId - Service ID
 * @param {object} bookingData - Booking details
 * @returns {Promise<string>} Booking ID
 */
export const createBooking = async (customerId, serviceId, bookingData) => {
  try {
    if (!customerId) {
      throw new Error("You must be signed in to create a booking.");
    }

    const scheduleKey =
      normalizeScheduleDateKey(
        bookingData.schedule || bookingData.pickup_date || bookingData.pickupDate
      ) || getLocalDateKey();

    const settings = await getGeneralSettings();
    const todayKey = getLocalDateKey();
    const allowedKey = String(settings?.pickupWindow || "Same day")
      .toLowerCase()
      .includes("next")
      ? (() => {
          const [year, month, day] = String(todayKey).split("-").map(Number);
          const next = new Date(year, month - 1, day);
          next.setDate(next.getDate() + 1);
          return getLocalDateKey(next);
        })()
      : todayKey;

    if (scheduleKey !== allowedKey) {
      throw new Error(
        String(settings?.pickupWindow || "").toLowerCase().includes("next")
          ? `Pickup is next-day only. Please book for ${allowedKey}.`
          : `Pickup is same-day only. Please book for ${allowedKey}.`
      );
    }

    const parsedMax = Number(settings.maxBookingsPerDay);
    const max =
      Number.isFinite(parsedMax) && parsedMax >= 0
        ? Math.floor(parsedMax)
        : 0;

    if (max <= 0) {
      throw new Error(
        `Bookings are closed for ${scheduleKey}. Max bookings is set to 0. Ask the admin to set a positive limit.`
      );
    }

    const bookingRef = doc(collection(db, "bookings"));
    const capacityRef = capacityDocRef(scheduleKey);

    const booking = stripUndefined({
      ...bookingData,
      id: bookingRef.id,
      booking_id: bookingRef.id,
      customer_id: customerId,
      service_id: serviceId || bookingData.service_id || null,
      status: bookingData.status || "Pending",
      booking_date: serverTimestamp(),
      schedule: scheduleKey,
      pickup_date: bookingData.pickup_date || bookingData.schedule || scheduleKey,
      total_amount:
        bookingData.total_amount ??
        bookingData.totalAmount ??
        bookingData.estimatedTotal ??
        0,
      payment_method: bookingData.payment_method || bookingData.paymentMethod || "",
      // Unpaid until the customer submits a payment; then Pending → Paid/Rejected
      payment_status: bookingData.payment_status || bookingData.paymentStatus || "Unpaid",
      notes: bookingData.notes || "",
      staff_id: bookingData.staff_id ?? null,
      rider_id: bookingData.rider_id ?? null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await runTransaction(db, async (transaction) => {
      const capacitySnap = await transaction.get(capacityRef);
      const usedRaw = capacitySnap.exists()
        ? Number(capacitySnap.data()?.used)
        : 0;
      const used =
        Number.isFinite(usedRaw) && usedRaw > 0 ? Math.floor(usedRaw) : 0;

      if (used >= max) {
        throw new Error(
          `Bookings are full for ${scheduleKey}. Maximum ${max} bookings per day.`
        );
      }

      transaction.set(bookingRef, booking);
      transaction.set(
        capacityRef,
        {
          date: scheduleKey,
          used: used + 1,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return bookingRef.id;
  } catch (error) {
    console.error("Error creating booking:", error);
    throw error;
  }
};

/**
 * Get booking by ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} Booking details
 */
export const getBooking = async (bookingId) => {
  try {
    const docRef = doc(db, "bookings", bookingId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return mapBookingDoc(docSnap);
    }
    return null;
  } catch (error) {
    console.error("Error getting booking:", error);
    throw error;
  }
};

/**
 * Get all bookings for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<array>} Array of bookings
 */
export const getCustomerBookings = async (customerId) => {
  try {
    const q = query(
      collection(db, "bookings"),
      where("customer_id", "==", customerId)
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = querySnapshot.docs.map(mapBookingDoc);

    bookings.sort(
      (a, b) =>
        getTimestampMilliseconds(b.booking_date || b.createdAt) -
        getTimestampMilliseconds(a.booking_date || a.createdAt)
    );

    return bookings;
  } catch (error) {
    console.error("Error getting customer bookings:", error);
    throw error;
  }
};

/**
 * Live subscribe to a customer's bookings.
 */
export const subscribeToCustomerBookings = (
  customerId,
  onBookings,
  onError
) => {
  if (!customerId) {
    onBookings?.([]);
    return () => {};
  }

  const q = query(
    collection(db, "bookings"),
    where("customer_id", "==", customerId)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const bookings = querySnapshot.docs.map(mapBookingDoc);

      bookings.sort(
        (a, b) =>
          getTimestampMilliseconds(b.booking_date || b.createdAt) -
          getTimestampMilliseconds(a.booking_date || a.createdAt)
      );

      onBookings?.(bookings);
    },
    (error) => {
      console.error("Error listening to customer bookings:", error);
      onError?.(error);
    }
  );
};

/**
 * Get bookings assigned to a staff member
 * @param {string} staffId - Staff ID
 * @param {string} status - Optional filter by status
 * @returns {Promise<array>} Array of bookings
 */
export const getStaffBookings = async (staffId, status = null) => {
  try {
    let q;
    
    if (status) {
      q = query(
        collection(db, "bookings"),
        where("staff_id", "==", staffId),
        where("status", "==", status),
        orderBy("booking_date", "desc")
      );
    } else {
      q = query(
        collection(db, "bookings"),
        where("staff_id", "==", staffId),
        orderBy("booking_date", "desc")
      );
    }
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push(mapBookingDoc(doc));
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting staff bookings:", error);
    throw error;
  }
};

/**
 * Subscribe to pending bookings and bookings owned by a staff member,
 * including the existing payment details needed by the staff workflow.
 */
export const subscribeToStaffBookings = (
  staffId,
  onBookings,
  onError,
  includePayments = true
) => {
  const bookingSets = new Map();
  let payments = [];

  const emitBookings = () => {
    const paymentByBooking = new Map(
      payments
        .filter((payment) => payment.booking_id)
        .map((payment) => [String(payment.booking_id), payment])
    );
    const bookings = new Map();

    bookingSets.forEach((set) => {
      set.forEach((booking) => bookings.set(booking.id, booking));
    });

    onBookings(
      [...bookings.values()]
        .map((booking) => attachPaymentToBooking(booking, paymentByBooking))
        .sort(
          (a, b) =>
            getTimestampMilliseconds(b.booking_date || b.created_at) -
            getTimestampMilliseconds(a.booking_date || a.created_at)
        )
    );
  };

  const handleError = (error) => {
    console.error("Error subscribing to staff bookings:", error);
    onError(error);
  };

  const pendingUnsubscribe = onSnapshot(
    query(collection(db, "bookings"), where("status", "==", "Pending")),
    (snapshot) => {
      bookingSets.set("pending", snapshot.docs.map(mapBookingDoc));
      emitBookings();
    },
    handleError
  );

  const assignedUnsubscribe = onSnapshot(
    query(collection(db, "bookings"), where("staff_id", "==", staffId)),
    (snapshot) => {
      bookingSets.set("assigned", snapshot.docs.map(mapBookingDoc));
      emitBookings();
    },
    handleError
  );

  const paymentsUnsubscribe = includePayments
    ? onSnapshot(
        collection(db, "payments"),
        (snapshot) => {
          payments = snapshot.docs.map(mapPaymentDoc);
          emitBookings();
        },
        handleError
      )
    : () => {};

  return () => {
    pendingUnsubscribe();
    assignedUnsubscribe();
    paymentsUnsubscribe();
  };
};

/**
 * Subscribe to every booking (with its payment record attached) for admin reporting.
 */
export const subscribeToAllBookings = (onBookings, onError) => {
  let bookings = [];
  let payments = [];

  const emitBookings = () => {
    const paymentByBooking = new Map(
      payments
        .filter((payment) => payment.booking_id)
        .map((payment) => [String(payment.booking_id), payment])
    );

    onBookings(
      bookings
        .map((booking) => attachPaymentToBooking(booking, paymentByBooking))
        .sort(
          (a, b) =>
            getTimestampMilliseconds(b.updated_at || b.booking_date || b.created_at) -
            getTimestampMilliseconds(a.updated_at || a.booking_date || a.created_at)
        )
    );
  };

  const handleError = (error) => {
    console.error("Error subscribing to all bookings:", error);
    onError?.(error);
  };

  const bookingsUnsubscribe = onSnapshot(
    collection(db, "bookings"),
    (snapshot) => {
      bookings = snapshot.docs.map(mapBookingDoc);
      emitBookings();
    },
    handleError
  );

  const paymentsUnsubscribe = onSnapshot(
    collection(db, "payments"),
    (snapshot) => {
      payments = snapshot.docs.map(mapPaymentDoc);
      emitBookings();
    },
    handleError
  );

  return () => {
    bookingsUnsubscribe();
    paymentsUnsubscribe();
  };
};

/**
 * Claim a pending booking for the staff member and auto-assign it to the
 * Active rider with the fewest active jobs.
 */
export const acceptBooking = async (bookingId, staffId) => {
  try {
    const ridersSnapshot = await getDocs(
      query(collection(db, "users"), where("role", "==", "rider"))
    );
    const riderRefs = ridersSnapshot.docs
      .map((riderDoc) => ({
        id: riderDoc.id,
        ref: riderDoc.ref,
        data: riderDoc.data(),
      }))
      .filter((rider) => isActiveRiderAccount(rider.data));

    if (riderRefs.length === 0) {
      throw new Error(
        "No active rider accounts are available to assign this booking."
      );
    }

    const existingWorkloads = await Promise.all(
      riderRefs.map(async (rider) => {
        if (typeof rider.data.active_booking_count === "number") {
          return rider.data.active_booking_count;
        }

        const assignedBookings = await getDocs(
          query(collection(db, "bookings"), where("rider_id", "==", rider.id))
        );
        return assignedBookings.docs.filter(
          (bookingDoc) =>
            !["Declined", "Delivered", "Completed"].includes(
              bookingDoc.data().status
            )
        ).length;
      })
    );

    const bookingRef = doc(db, "bookings", bookingId);
    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      const riderSnapshots = await Promise.all(
        riderRefs.map(({ ref }) => transaction.get(ref))
      );

      if (!bookingSnapshot.exists()) {
        throw new Error(`Booking ${bookingId} does not exist.`);
      }

      const booking = bookingSnapshot.data();
      if (booking.status !== "Pending" || booking.staff_id) {
        throw new Error("This booking has already been claimed by another staff member.");
      }

      const riders = riderSnapshots
        .map((riderSnapshot, index) => {
          if (!riderSnapshot.exists()) return null;
          const riderData = riderSnapshot.data();
          if (!isActiveRiderAccount(riderData)) return null;

          return {
            id: riderRefs[index].id,
            ref: riderRefs[index].ref,
            data: riderData,
            activeBookingCount:
              typeof riderData.active_booking_count === "number"
                ? riderData.active_booking_count
                : existingWorkloads[index],
          };
        })
        .filter(Boolean);

      if (riders.length === 0) {
        throw new Error(
          "No active rider accounts are available to assign this booking."
        );
      }

      // Least busy Active rider wins; stable tie-break by rider id.
      riders.sort(
        (a, b) =>
          a.activeBookingCount - b.activeBookingCount ||
          a.id.localeCompare(b.id)
      );
      const selectedRider = riders[0];
      const riderName = getRiderDisplayName(selectedRider.data);

      transaction.update(bookingRef, {
        staff_id: staffId,
        rider_id: selectedRider.id,
        rider_name: riderName,
        status: "Accepted",
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, "Accepted", {
        riderName,
      });
      transaction.update(selectedRider.ref, {
        active_booking_count: selectedRider.activeBookingCount + 1,
      });
    });
  } catch (error) {
    console.error("Error accepting and assigning booking:", error);
    throw error;
  }
};

/**
 * Decline a pending booking while assigning ownership to the staff member.
 */
export const declinePendingBooking = async (bookingId, staffId) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);

      if (!bookingSnapshot.exists()) {
        throw new Error(`Booking ${bookingId} does not exist.`);
      }

      const booking = bookingSnapshot.data();
      if (booking.status !== "Pending" || booking.staff_id) {
        throw new Error("This booking has already been claimed by another staff member.");
      }

      transaction.update(bookingRef, {
        staff_id: staffId,
        status: "Declined",
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, "Declined");
    });
  } catch (error) {
    console.error("Error declining booking:", error);
    throw error;
  }
};

/**
 * Update the status of a booking already assigned to the current staff member.
 */
export const updateStaffBookingStatus = async (
  bookingId,
  staffId,
  newStatus
) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await runTransaction(db, async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      if (!bookingSnapshot.exists()) {
        throw new Error(`Booking ${bookingId} does not exist.`);
      }

      const booking = bookingSnapshot.data();
      if (booking.staff_id !== staffId) {
        throw new Error("This booking is not assigned to the current staff member.");
      }
      if (!STAFF_BOOKING_TRANSITIONS[booking.status]?.includes(newStatus)) {
        throw new Error(
          `Staff cannot change booking status from "${booking.status}" to "${newStatus}".`
        );
      }

      const isLaundryStage = [
        "In Laundry",
        "Picked Up",
        "Washing",
        "Drying",
        "Folding",
      ].includes(booking.status);
      const pickupOnly = isPickupOnlyBooking(booking);

      if (isLaundryStage && pickupOnly && newStatus === "To Deliver") {
        throw new Error(
          'Pickup Only bookings must move to "Ready for pick up" instead of delivery.'
        );
      }
      if (
        isLaundryStage &&
        !pickupOnly &&
        newStatus === READY_FOR_CUSTOMER_PICKUP_STATUS
      ) {
        throw new Error(
          'Pickup & Delivery bookings must use the "Deliver" workflow.'
        );
      }

      const riderRef =
        ["Delivered", "Completed"].includes(newStatus) && booking.rider_id
          ? doc(db, "users", booking.rider_id)
          : null;
      const riderSnapshot = riderRef ? await transaction.get(riderRef) : null;

      transaction.update(bookingRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, newStatus);

      // Keep least-busy assignment accurate when staff marks Delivered.
      if (
        riderSnapshot?.exists() &&
        typeof riderSnapshot.data().active_booking_count === "number" &&
        riderSnapshot.data().active_booking_count > 0
      ) {
        transaction.update(riderRef, {
          active_booking_count: riderSnapshot.data().active_booking_count - 1,
        });
      }
    });
  } catch (error) {
    console.error("Error updating staff booking status:", error);
    throw error;
  }
};

/**
 * Save staff-calculated laundry details to the shared booking and payment records.
 */
export const updateStaffBookingDetails = async (
  bookingId,
  staffId,
  details
) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnapshot = await getDoc(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error(`Booking ${bookingId} does not exist.`);
    }
    if (bookingSnapshot.data().staff_id !== staffId) {
      throw new Error("This booking is not assigned to the current staff member.");
    }

    await updateDoc(bookingRef, {
      ...details,
      service_rate: details.service_rate ?? details.serviceRate,
      amount_to_be_paid: details.amount_to_be_paid ?? details.amountToBePaid,
      updated_at: serverTimestamp(),
    });

    const paymentSnapshot = await getDocs(
      query(collection(db, "payments"), where("booking_id", "==", bookingId))
    );
    await Promise.all(
      paymentSnapshot.docs.map((paymentDoc) =>
        updateDoc(paymentDoc.ref, {
          total_amount: details.total_amount,
          weight: details.weight,
          service_rate: details.service_rate ?? details.serviceRate,
          laundry_subtotal: details.laundry_subtotal,
          delivery_fee: details.delivery_fee,
          initial_payment: details.initial_payment ?? details.initialPayment,
          amount_to_be_paid: details.amount_to_be_paid ?? details.amountToBePaid,
          updated_at: serverTimestamp(),
        })
      )
    );
  } catch (error) {
    console.error("Error updating staff booking details:", error);
    throw error;
  }
};

/**
 * Save rider-measured weight and calculated totals for an assigned pickup.
 */
export const updateRiderBookingDetails = async (
  bookingId,
  riderId,
  details
) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnapshot = await getDoc(bookingRef);

    if (!bookingSnapshot.exists()) {
      throw new Error(`Booking ${bookingId} does not exist.`);
    }

    const booking = bookingSnapshot.data();
    if (booking.rider_id !== riderId) {
      throw new Error("This booking is not assigned to the current rider.");
    }
    if (booking.status !== "Ready for Pickup") {
      throw new Error("Weight can only be recorded for a ready pickup.");
    }

    let paymentDocs = [];
    try {
      const paymentSnapshot = await getDocs(
        query(collection(db, "payments"), where("booking_id", "==", bookingId))
      );
      paymentDocs = paymentSnapshot.docs;
    } catch {
      const directPayment = await getDoc(doc(db, "payments", `pay_${bookingId}`));
      if (directPayment.exists()) {
        paymentDocs = [directPayment];
      }
    }
    const batch = writeBatch(db);
    batch.update(bookingRef, {
      weight: details.weight,
      laundryWeight: details.laundryWeight,
      kg: details.kg,
      serviceRate: details.serviceRate,
      service_rate: details.serviceRate,
      laundrySubtotal: details.laundrySubtotal,
      laundry_subtotal: details.laundry_subtotal,
      deliveryFee: details.deliveryFee,
      delivery_fee: details.delivery_fee,
      totalAmount: details.totalAmount,
      total_amount: details.total_amount,
      estimatedTotal: details.estimatedTotal,
      amountToBePaid: details.amountToBePaid,
      amount_to_be_paid: details.amountToBePaid,
      updated_at: serverTimestamp(),
    });

    paymentDocs.forEach((paymentDoc) => {
      batch.update(paymentDoc.ref, {
        total_amount: details.total_amount,
        weight: details.weight,
        service_rate: details.serviceRate,
        laundry_subtotal: details.laundry_subtotal,
        delivery_fee: details.delivery_fee,
        initial_payment: details.initialPayment,
        amount_to_be_paid: details.amountToBePaid,
        updated_at: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error updating rider booking details:", error);
    throw error;
  }
};

/**
 * Get bookings assigned to a rider. The Firestore query is scoped by rider_id.
 */
export const getRiderBookings = async (riderId) => {
  try {
    const q = query(
      collection(db, "bookings"),
      where("rider_id", "==", riderId)
    );

    const querySnapshot = await getDocs(q);
    const bookings = querySnapshot.docs.map(mapBookingDoc);
    return bookings.sort(
      (a, b) =>
        getTimestampMilliseconds(b.booking_date || b.created_at) -
        getTimestampMilliseconds(a.booking_date || a.created_at)
    );
  } catch (error) {
    console.error("Error getting rider bookings:", error);
    throw error;
  }
};

/**
 * Subscribe to bookings assigned to a rider, including the existing payment
 * details (e.g. the customer's verified initial payment) needed to compute
 * the remaining amount to be paid.
 */
export const subscribeToRiderBookings = (
  riderId,
  onBookings,
  onError,
  includePayments = true
) => {
  const q = query(
    collection(db, "bookings"),
    where("rider_id", "==", riderId)
  );

  let bookings = [];
  const paymentByBooking = new Map();
  const paymentListeners = new Map();

  const emitBookings = () => {
    onBookings(
      bookings
        .map((booking) => attachPaymentToBooking(booking, paymentByBooking))
        .sort(
          (a, b) =>
            getTimestampMilliseconds(b.booking_date || b.created_at) -
            getTimestampMilliseconds(a.booking_date || a.created_at)
        )
    );
  };

  const handleError = (error) => {
    console.error("Error subscribing to rider bookings:", error);
    onError(error);
  };

  const syncAssignedPaymentListeners = (assignedBookings) => {
    if (!includePayments) return;

    const activeIds = new Set(
      assignedBookings.map((booking) => String(booking.id)).filter(Boolean)
    );

    paymentListeners.forEach((unsubscribe, bookingId) => {
      if (!activeIds.has(bookingId)) {
        unsubscribe();
        paymentListeners.delete(bookingId);
        paymentByBooking.delete(bookingId);
      }
    });

    activeIds.forEach((bookingId) => {
      if (paymentListeners.has(bookingId)) return;

      const paymentQuery = query(
        collection(db, "payments"),
        where("booking_id", "==", bookingId)
      );

      const unsubscribe = onSnapshot(
        paymentQuery,
        (snapshot) => {
          if (snapshot.empty) {
            paymentByBooking.delete(bookingId);
          } else {
            paymentByBooking.set(bookingId, mapPaymentDoc(snapshot.docs[0]));
          }
          emitBookings();
        },
        (paymentError) => {
          // Fall back to direct deterministic payment doc if list rule is restricted
          const directRef = doc(db, "payments", `pay_${bookingId}`);
          const fallbackUnsubscribe = onSnapshot(
            directRef,
            (docSnap) => {
              if (docSnap.exists()) {
                paymentByBooking.set(bookingId, mapPaymentDoc(docSnap));
              } else {
                paymentByBooking.delete(bookingId);
              }
              emitBookings();
            },
            (fallbackErr) => {
              console.warn(
                `Unable to load payment for assigned booking ${bookingId}:`,
                paymentError,
                fallbackErr
              );
            }
          );
          paymentListeners.set(bookingId, fallbackUnsubscribe);
        }
      );

      paymentListeners.set(bookingId, unsubscribe);
    });
  };

  const bookingsUnsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      bookings = querySnapshot.docs.map(mapBookingDoc);
      syncAssignedPaymentListeners(bookings);
      emitBookings();
    },
    handleError
  );

  return () => {
    bookingsUnsubscribe();
    paymentListeners.forEach((unsubscribe) => unsubscribe());
    paymentListeners.clear();
  };
};

/**
 * Update a rider-owned booking only for pickup and delivery transitions.
 */
export const updateRiderBookingStatus = async (bookingId, riderId, newStatus) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const allowedTransitions = {
      "Ready for Pickup": "In Laundry",
      "To Deliver": "Delivered",
    };
    const riderRef = doc(db, "users", riderId);

    await runTransaction(db, async (transaction) => {
      const [bookingSnapshot, riderSnapshot] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(riderRef),
      ]);

      if (!bookingSnapshot.exists()) {
        throw new Error(`Booking ${bookingId} does not exist.`);
      }

      const booking = bookingSnapshot.data();
      if (booking.rider_id !== riderId) {
        throw new Error("This booking is not assigned to the current rider.");
      }

      if (isPickupOnlyBooking(booking) && booking.status !== "Ready for Pickup") {
        throw new Error(
          "Pickup Only orders are collected by the customer and do not use rider delivery."
        );
      }

      if (allowedTransitions[booking.status] !== newStatus) {
        throw new Error(
          `Rider cannot change booking status from "${booking.status}" to "${newStatus}".`
        );
      }

      transaction.update(bookingRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, newStatus);

      if (
        newStatus === "Delivered" &&
        riderSnapshot.exists() &&
        riderSnapshot.data().active_booking_count > 0
      ) {
        transaction.update(riderRef, {
          active_booking_count: riderSnapshot.data().active_booking_count - 1,
        });
      }
    });
  } catch (error) {
    console.error("Error updating rider booking status:", error);
    throw error;
  }
};

/**
 * Get all pending bookings (for staff to accept)
 * @returns {Promise<array>} Array of pending bookings
 */
export const getPendingBookings = async () => {
  try {
    const q = query(
      collection(db, "bookings"),
      where("status", "==", "Pending"),
      orderBy("booking_date", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push(mapBookingDoc(doc));
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting pending bookings:", error);
    throw error;
  }
};

/**
 * Update booking status
 * @param {string} bookingId - Booking ID
 * @param {string} newStatus - New status
 * @returns {Promise<void>}
 */
export const updateBookingStatus = async (bookingId, newStatus) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      status: newStatus,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    throw error;
  }
};

/**
 * Soft-archive a booking so staff can hide completed/old transactions
 * without deleting workflow history.
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export const archiveBooking = async (bookingId) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      archived: true,
      archivedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error archiving booking:", error);
    throw error;
  }
};

/**
 * Restore a soft-archived booking to the active transaction list.
 * @param {string} bookingId
 * @returns {Promise<void>}
 */
export const unarchiveBooking = async (bookingId) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      archived: false,
      archivedAt: null,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error unarchiving booking:", error);
    throw error;
  }
};

/**
 * Get bookings by status
 * @param {string} status - Status to filter by
 * @returns {Promise<array>} Array of bookings
 */
export const getBookingsByStatus = async (status) => {
  try {
    const q = query(
      collection(db, "bookings"),
      where("status", "==", status),
      orderBy("booking_date", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push(mapBookingDoc(doc));
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting bookings by status:", error);
    throw error;
  }
};

/**
 * Get all bookings with customer and service details
 * @returns {Promise<array>} Array of bookings with details
 */
export const getAllBookingsWithDetails = async () => {
  try {
    const q = query(
      collection(db, "bookings"),
      orderBy("booking_date", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    
    for (const docSnapshot of querySnapshot.docs) {
      const booking = mapBookingDoc(docSnapshot);
      
      // Get customer details
      if (booking.customer_id) {
        const customerRef = doc(db, "users", booking.customer_id);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          booking.customer = customerSnap.data();
        }
      }
      
      bookings.push(booking);
    }
    
    return bookings;
  } catch (error) {
    console.error("Error getting bookings with details:", error);
    throw error;
  }
};
