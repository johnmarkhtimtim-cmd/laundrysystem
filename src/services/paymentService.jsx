import { 
  collection, 
  doc, 
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

const getTimestampMilliseconds = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

/**
 * Create a payment record
 * @param {string} bookingId - Booking ID
 * @param {string} customerId - Customer ID
 * @param {number} amount - Payment amount
 * @param {string} method - Payment method (Online Payment, Cash on Pickup)
 * @param {string} status - Payment status (Pending, Paid)
 * @returns {Promise<string>} Payment ID
 */
export const createPayment = async (
  bookingId,
  customerId,
  amount,
  method = "Cash on Pickup",
  status = "Pending",
  details = {}
) => {
  try {
    const paymentRef = doc(collection(db, "payments"));
    
    const payment = {
      ...details,
      payment_id: paymentRef.id,
      booking_id: bookingId,
      customer_id: customerId,
      amount: amount,
      payment_method: method,
      payment_status: status,
      payment_date: status === "Paid" ? serverTimestamp() : null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await setDoc(paymentRef, payment);
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
    await updateDoc(paymentRef, {
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      gcash_customer_name: paymentData.gcash_customer_name || "",
      reference_number: paymentData.reference_number || "",
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating customer payment:", error);
    throw error;
  }
};

/**
 * Get payment by booking ID
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} Payment details
 */
export const getPaymentByBookingId = async (bookingId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("booking_id", "==", bookingId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting payment by booking ID:", error);
    throw error;
  }
};

/**
 * Get payments for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<array>} Array of payments
 */
export const getCustomerPayments = async (customerId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("customer_id", "==", customerId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((paymentDoc) => ({
        id: paymentDoc.id,
        ...paymentDoc.data(),
      }))
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
          .map((paymentDoc) => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
          }))
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
 * Get all payments for staff view with customer details
 * @returns {Promise<array>} Array of payments with customer details
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
 * Update payment status
 * @param {string} paymentId - Payment ID
 * @param {string} newStatus - New payment status
 * @returns {Promise<void>}
 */
export const updatePaymentStatus = async (paymentId, newStatus) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      payment_status: newStatus,
      payment_date: newStatus === "Paid" ? serverTimestamp() : null,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
};

/**
 * Get payments by status
 * @param {string} status - Payment status (Pending, Paid)
 * @returns {Promise<array>} Array of payments
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
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    
    return payments;
  } catch (error) {
    console.error("Error getting payments by status:", error);
    throw error;
  }
};

/**
 * Get revenue summary
 * @returns {Promise<object>} Revenue statistics
 */
export const getRevenueSummary = async () => {
  try {
    const allPayments = await getAllPayments();
    
    const totalRevenue = allPayments
      .filter(p => p.payment_status === "Paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const pendingRevenue = allPayments
      .filter(p => p.payment_status === "Pending")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const paidCount = allPayments.filter(p => p.payment_status === "Paid").length;
    const pendingCount = allPayments.filter(p => p.payment_status === "Pending").length;
    
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
