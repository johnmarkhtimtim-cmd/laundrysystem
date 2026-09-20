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
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Create a new booking
 * @param {string} customerId - Customer ID
 * @param {string} serviceId - Service ID
 * @param {object} bookingData - Booking details
 * @returns {Promise<string>} Booking ID
 */
export const createBooking = async (customerId, serviceId, bookingData) => {
  try {
    const bookingRef = doc(collection(db, "bookings"));
    
    const booking = {
      booking_id: bookingRef.id,
      customer_id: customerId,
      service_id: serviceId,
      status: "Pending",
      booking_date: serverTimestamp(),
      pickup_date: bookingData.pickup_date || null,
      weight: bookingData.weight || 0,
      total_amount: bookingData.total_amount || 0,
      payment_method: bookingData.payment_method || "Cash on Pickup",
      payment_status: bookingData.payment_method === "Online Payment" ? "Paid" : "Pending",
      notes: bookingData.notes || "",
      staff_id: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    await setDoc(bookingRef, booking);
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
      return { id: docSnap.id, ...docSnap.data() };
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
      where("customer_id", "==", customerId),
      orderBy("booking_date", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = [];
    querySnapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting customer bookings:", error);
    throw error;
  }
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
      bookings.push({ id: doc.id, ...doc.data() });
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting staff bookings:", error);
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
      where("rider_id", "==", riderId),
      orderBy("booking_date", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((bookingDoc) => ({
      id: bookingDoc.id,
      ...bookingDoc.data(),
    }));
  } catch (error) {
    console.error("Error getting rider bookings:", error);
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
      bookings.push({ id: doc.id, ...doc.data() });
    });
    
    return bookings;
  } catch (error) {
    console.error("Error getting pending bookings:", error);
    throw error;
  }
};

/**
 * Accept booking (assign to staff)
 * @param {string} bookingId - Booking ID
 * @param {string} staffId - Staff ID
 * @returns {Promise<void>}
 */
export const acceptBooking = async (bookingId, staffId) => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      staff_id: staffId,
      status: "Accepted",
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error accepting booking:", error);
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
      bookings.push({ id: doc.id, ...doc.data() });
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
      const booking = { id: docSnapshot.id, ...docSnapshot.data() };
      
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
