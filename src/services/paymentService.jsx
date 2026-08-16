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
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Create a payment record
 * @param {string} bookingId - Booking ID
 * @param {string} customerId - Customer ID
 * @param {number} amount - Payment amount
 * @param {string} method - Payment method (Online Payment, Cash on Pickup)
 * @param {string} status - Payment status (Pending, Paid)
 * @returns {Promise<string>} Payment ID
 */
export const createPayment = async (bookingId, customerId, amount, method = "Cash on Pickup", status = "Pending") => {
  try {
    const paymentRef = doc(collection(db, "payments"));
    
    const payment = {
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
      where("customer_id", "==", customerId),
      orderBy("created_at", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    
    return payments;
  } catch (error) {
    console.error("Error getting customer payments:", error);
    throw error;
  }
};

/**
 * Get all payments for staff view
 * @returns {Promise<array>} Array of payments with customer and booking details
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
      
      // Get customer details
      if (payment.customer_id) {
        const customerRef = doc(db, "users", payment.customer_id);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          payment.customer = customerSnap.data();
        }
      }
      
      // Get booking details
      if (payment.booking_id) {
        const bookingRef = doc(db, "bookings", payment.booking_id);
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          payment.booking = bookingSnap.data();
        }
      }
      
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
