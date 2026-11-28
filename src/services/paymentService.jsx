import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  notifyCustomerPaymentSubmitted,
  notifyPaymentConfirmed,
  notifyPaymentRejected,
  notifyStaffPaymentSubmitted,
} from "./notificationService";
import { getUsersByRoles } from "./userService";

const PAYMENT_SETTINGS_DOC = "payment";

const DEFAULT_PAYMENT_SETTINGS = {
  gcashName: "Prince-Tyler Laundry Shop",
  gcashNumber: "",
  gcashQr: "/images/gcash-qr.png",
};

const getTimestampMilliseconds = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeMethod = (method) => {
  if (!method) return "Cash";
  if (method === "Online Payment" || method === "Cash on Pickup") {
    return method === "Online Payment" ? "GCash" : "Cash";
  }
  return method;
};

const alertStaffOfSubmittedPayment = async ({
  bookingId,
  amount,
  paymentMethod,
  customerName,
  isResubmit = false,
}) => {
  try {
    // Staff inbox only — admin already surfaces pending payments as activity alerts.
    const recipients = await getUsersByRoles(["staff"]);
    if (recipients.length === 0) return;

    await notifyStaffPaymentSubmitted({
      recipientIds: recipients.map((user) => user.id),
      bookingId,
      amount,
      paymentMethod,
      customerName: customerName || "Customer",
      isResubmit,
    });
  } catch (error) {
    // Payment should still succeed even if staff alerts fail.
    console.error("Error notifying staff of payment submission:", error);
  }
};

/**
 * Sync payment fields onto the linked booking document.
 */
const syncBookingPaymentFields = async (
  bookingId,
  { payment_status, payment_method } = {}
) => {
  if (!bookingId) return;

  const bookingRef = doc(db, "bookings", bookingId);
  const updates = { updated_at: serverTimestamp() };

  if (payment_status) updates.payment_status = payment_status;
  if (payment_method) updates.payment_method = normalizeMethod(payment_method);

  try {
    await updateDoc(bookingRef, updates);
  } catch (error) {
    // Payment record is the source of truth; booking sync must not block submit.
    console.error("Error syncing booking payment fields:", error);
  }
};

/**
 * Create a payment record atomically (preventing duplicates per booking)
 * and sync method/status onto the linked booking.
 */
export const createPayment = async (
  bookingId,
  customerId,
  amount,
  method = "Cash",
  status = "Pending",
  details = {}
) => {
  try {
    if (!bookingId) {
      throw new Error("Missing booking ID for payment submission.");
    }
    if (!customerId) {
      throw new Error("You must be signed in to submit a payment.");
    }

    // Guard against legacy random-ID payments already pending/paid for this booking
    // (query scoped by customer_id so Firestore security rules always allow it)
    const customerPayments = await getCustomerPayments(customerId);
    const existingLegacy = customerPayments.find(
      (item) => String(item.booking_id || item.bookingId || "") === String(bookingId)
    );
    if (existingLegacy) {
      const existingStatus = String(
        existingLegacy.payment_status || existingLegacy.status || ""
      ).toLowerCase();
      if (existingStatus === "paid") {
        throw new Error("This booking is already marked as paid.");
      }
      if (existingStatus === "pending") {
        throw new Error("This booking already has a pending payment.");
      }
    }

    // Deterministic payment ID per booking guarantees atomic duplicate prevention
    const paymentRef = doc(db, "payments", `pay_${bookingId}`);
    const paymentMethod = normalizeMethod(method);
    const numericAmount = Number(amount) || 0;

    // Only write keys allowed by firestore.rules payments create
    const payment = {
      payment_id: paymentRef.id,
      booking_id: bookingId,
      customer_id: customerId,
      customer_name: details.customer_name || "Customer",
      amount: numericAmount,
      // Do not write initial_payment here — customer create rules reject unknown keys.
      // Rider weight update sets initial_payment later; amount is the deposit.
      total_amount: Number(details.total_amount ?? numericAmount) || numericAmount,
      services: details.services || "",
      payment_method: paymentMethod,
      payment_status: status,
      gcash_customer_name: details.gcash_customer_name || "",
      reference_number: details.reference_number || "",
      receipt_url: details.receipt_url || "",
      receipt_path: details.receipt_path || "",
      receipt_name: details.receipt_name || "",
      receipt_content_type: details.receipt_content_type || "",
      receipt_size: details.receipt_size ?? null,
      payment_date: status === "Paid" ? serverTimestamp() : null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await runTransaction(db, async (transaction) => {
      const existingSnap = await transaction.get(paymentRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() || {};
        const currentStatus = String(
          existingData.payment_status || ""
        ).toLowerCase();
        if (currentStatus === "paid") {
          throw new Error("This booking is already marked as paid.");
        }
        if (currentStatus === "pending") {
          throw new Error("This booking already has a pending payment.");
        }
        if (
          currentStatus === "unpaid" &&
          String(status).toLowerCase() === "unpaid"
        ) {
          // Cash booking resubmitted unchanged — already recorded, nothing to update.
          return;
        }

        // Resubmitting after a Rejected payment must use update() with only
        // the keys permitted by Firestore security rules.
        transaction.update(paymentRef, {
          amount: numericAmount,
          payment_method: paymentMethod,
          payment_status: status,
          gcash_customer_name: details.gcash_customer_name || "",
          reference_number: details.reference_number || "",
          receipt_url: details.receipt_url || existingData.receipt_url || "",
          receipt_path: details.receipt_path || existingData.receipt_path || "",
          receipt_name: details.receipt_name || existingData.receipt_name || "",
          receipt_content_type:
            details.receipt_content_type || existingData.receipt_content_type || "",
          receipt_size:
            details.receipt_size ?? existingData.receipt_size ?? null,
          updated_at: serverTimestamp(),
        });
        return;
      }

      transaction.set(paymentRef, payment);
    });

    await syncBookingPaymentFields(bookingId, {
      payment_status: status,
      payment_method: paymentMethod,
    });

    if (String(status).toLowerCase() === "pending") {
      await alertStaffOfSubmittedPayment({
        bookingId,
        amount: numericAmount,
        paymentMethod,
        customerName: details.customer_name,
        isResubmit: false,
      });

      try {
        await notifyCustomerPaymentSubmitted({
          customerId,
          bookingId,
          amount: numericAmount,
          paymentMethod,
          isResubmit: false,
        });
      } catch (notifyErr) {
        console.error("Error notifying customer of payment submission:", notifyErr);
      }
    }

    return paymentRef.id;
  } catch (error) {
    console.error("Error creating payment:", error);
    throw error;
  }
};

/**
 * Update a customer's pending payment details without changing its status.
 */
export const updateCustomerPayment = async (paymentId, paymentData) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    const paymentSnap = await getDoc(paymentRef);
    const existing = paymentSnap.exists() ? paymentSnap.data() : {};
    const paymentMethod = normalizeMethod(paymentData.payment_method);
    const nextStatus =
      paymentMethod === "Cash" && paymentData.payment_status === "Unpaid"
        ? "Unpaid"
        : "Pending";

    await updateDoc(paymentRef, {
      amount: paymentData.amount,
      payment_method: paymentMethod,
      payment_status: nextStatus,
      gcash_customer_name: paymentData.gcash_customer_name || "",
      reference_number: paymentData.reference_number || "",
      // Cash payments carry no GCash receipt — clear any previous upload.
      receipt_url:
        paymentMethod === "Cash"
          ? ""
          : paymentData.receipt_url || existing.receipt_url || "",
      receipt_path:
        paymentMethod === "Cash"
          ? ""
          : paymentData.receipt_path || existing.receipt_path || "",
      receipt_name:
        paymentMethod === "Cash"
          ? ""
          : paymentData.receipt_name || existing.receipt_name || "",
      receipt_content_type:
        paymentMethod === "Cash"
          ? ""
          : paymentData.receipt_content_type || existing.receipt_content_type || "",
      receipt_size:
        paymentMethod === "Cash"
          ? null
          : (paymentData.receipt_size ?? existing.receipt_size ?? null),
      updated_at: serverTimestamp(),
    });

    const bookingId = existing.booking_id || paymentData.booking_id;
    if (bookingId) {
      await syncBookingPaymentFields(bookingId, {
        payment_status: nextStatus,
        payment_method: paymentMethod,
      });
    }

    if (nextStatus === "Pending") {
      await alertStaffOfSubmittedPayment({
        bookingId,
        amount: paymentData.amount ?? existing.amount ?? existing.total_amount,
        paymentMethod,
        customerName:
          paymentData.customer_name ||
          existing.customer_name ||
          "Customer",
        isResubmit: true,
      });

      const customerId = existing.customer_id || paymentData.customer_id;
      if (customerId && bookingId) {
        try {
          await notifyCustomerPaymentSubmitted({
            customerId,
            bookingId,
            amount: paymentData.amount ?? existing.amount ?? existing.total_amount,
            paymentMethod,
            isResubmit: true,
          });
        } catch (notifyErr) {
          console.error("Error notifying customer of payment resubmission:", notifyErr);
        }
      }
    }
  } catch (error) {
    console.error("Error updating customer payment:", error);
    throw error;
  }
};

/**
 * Get payment by booking ID
 */
export const getPaymentByBookingId = async (bookingId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("booking_id", "==", bookingId)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const paymentDoc = querySnapshot.docs[0];
      return { id: paymentDoc.id, ...paymentDoc.data() };
    }

    return null;
  } catch (error) {
    console.error("Error getting payment by booking ID:", error);
    throw error;
  }
};

/**
 * Get payments for a customer
 */
export const getCustomerPayments = async (customerId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("customer_id", "==", customerId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((paymentDoc) => {
        const data = paymentDoc.data() || {};
        const bookingId = data.booking_id || data.bookingId || null;

        return {
          ...data,
          id: paymentDoc.id,
          payment_id: data.payment_id || paymentDoc.id,
          booking_id: bookingId,
          bookingId,
          customer_id: data.customer_id || data.customerId || customerId,
        };
      })
      .sort(
        (a, b) =>
          getTimestampMilliseconds(b.created_at || b.createdAt) -
          getTimestampMilliseconds(a.created_at || a.createdAt)
      );
  } catch (error) {
    console.error("Error getting customer payments:", error);
    throw error;
  }
};

/**
 * Subscribe to a customer's payment records.
 */
export const subscribeToCustomerPayments = (
  customerId,
  onPayments,
  onError
) => {
  const q = query(
    collection(db, "payments"),
    where("customer_id", "==", customerId)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      onPayments(
        querySnapshot.docs
          .map((paymentDoc) => {
            const data = paymentDoc.data() || {};
            const bookingId =
              data.booking_id || data.bookingId || null;

            return {
              ...data,
              id: paymentDoc.id,
              payment_id: data.payment_id || paymentDoc.id,
              booking_id: bookingId,
              bookingId,
              customer_id: data.customer_id || data.customerId || customerId,
            };
          })
          .sort(
            (a, b) =>
              getTimestampMilliseconds(b.created_at || b.createdAt) -
              getTimestampMilliseconds(a.created_at || a.createdAt)
          )
      );
    },
    onError
  );
};

/**
 * Subscribe to every payment record for staff/admin views.
 */
export const subscribeToAllPayments = (onPayments, onError) => {
  return onSnapshot(
    collection(db, "payments"),
    (querySnapshot) => {
      onPayments(
        querySnapshot.docs
          .map((paymentDoc) => {
            const payment = { id: paymentDoc.id, ...paymentDoc.data() };

            return {
              ...payment,
              customer: { name: payment.customer_name || "Unknown" },
            };
          })
          .sort(
            (a, b) =>
              getTimestampMilliseconds(b.created_at) -
              getTimestampMilliseconds(a.created_at)
          )
      );
    },
    onError
  );
};

/**
 * Get all payments for staff view with customer details
 */
export const getAllPayments = async () => {
  try {
    const q = query(
      collection(db, "payments"),
      orderBy("created_at", "desc")
    );

    const querySnapshot = await getDocs(q);
    const payments = [];

    for (const docSnapshot of querySnapshot.docs) {
      const payment = { id: docSnapshot.id, ...docSnapshot.data() };
      payment.customer = {
        name: payment.customer_name || "Unknown",
      };
      payments.push(payment);
    }

    return payments;
  } catch (error) {
    console.error("Error getting all payments:", error);
    throw error;
  }
};

/**
 * Update payment status, sync booking, and notify the customer.
 */
export const updatePaymentStatus = async (paymentId, newStatus) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      throw new Error("Payment not found");
    }

    const payment = paymentSnap.data();
    const updates = {
      payment_status: newStatus,
      payment_date: newStatus === "Paid" ? serverTimestamp() : null,
      updated_at: serverTimestamp(),
    };

    await updateDoc(paymentRef, updates);

    if (payment.booking_id) {
      await syncBookingPaymentFields(payment.booking_id, {
        payment_status: newStatus,
        payment_method: payment.payment_method,
      });
    }

    const customerId = payment.customer_id;
    const bookingId = payment.booking_id;
    const amount = payment.amount ?? payment.total_amount ?? 0;

    if (customerId && bookingId) {
      if (newStatus === "Paid") {
        await notifyPaymentConfirmed(customerId, bookingId, amount);
      } else if (newStatus === "Rejected") {
        await notifyPaymentRejected(customerId, bookingId, amount);
      }
    }
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
};

/**
 * Mark an "Unpaid" cash payment as Paid after the money is physically
 * collected by staff or the assigned rider. Runs in a transaction so two
 * collectors cannot record the same collection twice; Firestore rules
 * enforce who may perform the Unpaid -> Paid transition.
 */
export const markCashPaymentCollected = async (paymentId) => {
  try {
    if (!paymentId) {
      throw new Error("Missing payment ID.");
    }

    const paymentRef = doc(db, "payments", paymentId);
    let bookingId = null;
    let customerId = null;
    let amount = 0;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(paymentRef);
      if (!snap.exists()) {
        throw new Error("Payment not found.");
      }

      const data = snap.data() || {};
      const method = String(data.payment_method || "").toLowerCase();
      const status = String(data.payment_status || "").toLowerCase();

      if (method !== "cash") {
        throw new Error("Only cash payments can be collected this way.");
      }
      if (status === "paid") {
        throw new Error("This payment is already marked as paid.");
      }
      if (status !== "unpaid") {
        throw new Error("This cash payment is not awaiting collection.");
      }

      bookingId = data.booking_id || null;
      customerId = data.customer_id || null;
      amount = Number(data.amount ?? data.total_amount ?? 0) || 0;

      transaction.update(paymentRef, {
        payment_status: "Paid",
        payment_date: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    });

    if (bookingId) {
      await syncBookingPaymentFields(bookingId, {
        payment_status: "Paid",
        payment_method: "Cash",
      });
    }

    if (customerId && bookingId) {
      try {
        await notifyPaymentConfirmed(customerId, bookingId, amount);
      } catch (notifyErr) {
        console.error("Error notifying customer of cash collection:", notifyErr);
      }
    }

    return paymentId;
  } catch (error) {
    console.error("Error collecting cash payment:", error);
    throw error;
  }
};

/**
 * Get payments by status
 */
export const getPaymentsByStatus = async (status) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("payment_status", "==", status),
      orderBy("created_at", "desc")
    );

    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((paymentDoc) => {
      payments.push({ id: paymentDoc.id, ...paymentDoc.data() });
    });

    return payments;
  } catch (error) {
    console.error("Error getting payments by status:", error);
    throw error;
  }
};

/**
 * Get revenue summary
 */
export const getRevenueSummary = async () => {
  try {
    const allPayments = await getAllPayments();

    const totalRevenue = allPayments
      .filter((p) => p.payment_status === "Paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingRevenue = allPayments
      .filter((p) => p.payment_status === "Pending")
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const paidCount = allPayments.filter(
      (p) => p.payment_status === "Paid"
    ).length;
    const pendingCount = allPayments.filter(
      (p) => p.payment_status === "Pending"
    ).length;

    return {
      total_revenue: totalRevenue,
      pending_revenue: pendingRevenue,
      paid_count: paidCount,
      pending_count: pendingCount,
    };
  } catch (error) {
    console.error("Error getting revenue summary:", error);
    throw error;
  }
};

/**
 * Load shop GCash / payment display settings.
 */
export const getPaymentSettings = async () => {
  try {
    const settingsRef = doc(db, "settings", PAYMENT_SETTINGS_DOC);
    const snap = await getDoc(settingsRef);

    if (!snap.exists()) {
      return { ...DEFAULT_PAYMENT_SETTINGS };
    }

    return {
      ...DEFAULT_PAYMENT_SETTINGS,
      ...snap.data(),
    };
  } catch (error) {
    console.error("Error getting payment settings:", error);
    return { ...DEFAULT_PAYMENT_SETTINGS };
  }
};

/**
 * Subscribe to shop payment settings.
 */
export const subscribeToPaymentSettings = (onSettings, onError) => {
  const settingsRef = doc(db, "settings", PAYMENT_SETTINGS_DOC);

  return onSnapshot(
    settingsRef,
    (snap) => {
      if (!snap.exists()) {
        onSettings({ ...DEFAULT_PAYMENT_SETTINGS });
        return;
      }

      onSettings({
        ...DEFAULT_PAYMENT_SETTINGS,
        ...snap.data(),
      });
    },
    onError
  );
};

/**
 * Save shop payment settings (admin).
 */
export const updatePaymentSettings = async (settings) => {
  try {
    const settingsRef = doc(db, "settings", PAYMENT_SETTINGS_DOC);
    await setDoc(
      settingsRef,
      {
        gcashName: settings.gcashName || DEFAULT_PAYMENT_SETTINGS.gcashName,
        gcashNumber: settings.gcashNumber || "",
        gcashQr: settings.gcashQr || DEFAULT_PAYMENT_SETTINGS.gcashQr,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error updating payment settings:", error);
    throw error;
  }
};

const DEFAULT_GENERAL_SETTINGS = {
  businessName: "LaundryMate",
  pickupWindow: "Same day",
  // Positive number = max bookings per pickup date.
  // 0 = no bookings allowed until admin sets a positive limit again.
  maxBookingsPerDay: 50,
};

/**
 * Resolve max bookings.
 * 0 is allowed (blocks all bookings). Invalid / negative → default.
 */
const resolveMaxBookingsPerDay = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_GENERAL_SETTINGS.maxBookingsPerDay;
  }
  return Math.floor(parsed);
};

const normalizeGeneralSettings = (settings) => ({
  ...settings,
  maxBookingsPerDay: resolveMaxBookingsPerDay(settings?.maxBookingsPerDay),
});

/**
 * Load general business settings.
 */
export const getGeneralSettings = async () => {
  try {
    const settingsRef = doc(db, "settings", "general");
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) return { ...DEFAULT_GENERAL_SETTINGS };
    return normalizeGeneralSettings({
      ...DEFAULT_GENERAL_SETTINGS,
      ...snap.data(),
    });
  } catch (error) {
    console.error("Error getting general settings:", error);
    return { ...DEFAULT_GENERAL_SETTINGS };
  }
};

/**
 * Live subscribe to general business settings (admin changes appear without refresh).
 */
export const subscribeToGeneralSettings = (onSettings, onError) => {
  const settingsRef = doc(db, "settings", "general");

  return onSnapshot(
    settingsRef,
    (snap) => {
      if (!snap.exists()) {
        onSettings({ ...DEFAULT_GENERAL_SETTINGS });
        return;
      }

      onSettings(
        normalizeGeneralSettings({
          ...DEFAULT_GENERAL_SETTINGS,
          ...snap.data(),
        })
      );
    },
    (error) => {
      console.error("Error listening to general settings:", error);
      onError?.(error);
    }
  );
};

/**
 * Save general business settings (admin).
 */
export const updateGeneralSettings = async (settings) => {
  const settingsRef = doc(db, "settings", "general");
  const maxBookingsPerDay = resolveMaxBookingsPerDay(settings.maxBookingsPerDay);

  await setDoc(
    settingsRef,
    {
      businessName: settings.businessName || DEFAULT_GENERAL_SETTINGS.businessName,
      pickupWindow: settings.pickupWindow || DEFAULT_GENERAL_SETTINGS.pickupWindow,
      maxBookingsPerDay,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );

  return { maxBookingsPerDay };
};

export { DEFAULT_PAYMENT_SETTINGS, DEFAULT_GENERAL_SETTINGS, normalizeMethod };
