import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  runTransaction,
  setDoc, 
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
  "In Laundry": ["To Deliver"],
  "Picked Up": ["To Deliver"],
  Washing: ["To Deliver"],
  Drying: ["To Deliver"],
  Folding: ["To Deliver"],
  "To Deliver": ["Delivered"],
  "Ready for Customer Pickup": ["Delivered"],
};

const addBookingStatusNotification = (transaction, booking, bookingId, status) => {
  const customerId = booking.customer_id || booking.customerId || booking.userId;
  if (!customerId) {
    throw new Error(
      `Booking ${bookingId} has no customer user ID; status was not updated.`
    );
  }

  const details = getBookingStatusNotificationDetails(bookingId, status);
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
    const bookingRef = doc(collection(db, "bookings"));
    
    const booking = {
      ...bookingData,
      id: bookingRef.id,
      booking_id: bookingRef.id,
      customer_id: customerId,
      service_id: serviceId || bookingData.service_id || null,
      status: bookingData.status || "Pending",
      booking_date: serverTimestamp(),
      pickup_date: bookingData.pickup_date || bookingData.schedule || null,
      total_amount:
        bookingData.total_amount ??
        bookingData.totalAmount ??
        bookingData.estimatedTotal ??
        0,
      payment_method: bookingData.payment_method || bookingData.paymentMethod || "Cash on Pickup",
      payment_status: bookingData.payment_status || bookingData.paymentStatus || "Pending",
      notes: bookingData.notes || "",
      staff_id: bookingData.staff_id || null,
      rider_id: bookingData.rider_id || null,
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
      where("customer_id", "==", customerId)
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = querySnapshot.docs.map((bookingDoc) => ({
      id: bookingDoc.id,
      ...bookingDoc.data(),
    }));

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
      payments.map((payment) => [String(payment.booking_id), payment])
    );
    const bookings = new Map();

    bookingSets.forEach((set) => {
      set.forEach((booking) => bookings.set(booking.id, booking));
    });

    onBookings(
      [...bookings.values()]
        .map((booking) => ({
          ...booking,
          payment: paymentByBooking.get(String(booking.id)) || null,
        }))
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
      bookingSets.set(
        "pending",
        snapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data(),
        }))
      );
      emitBookings();
    },
    handleError
  );

  const assignedUnsubscribe = onSnapshot(
    query(collection(db, "bookings"), where("staff_id", "==", staffId)),
    (snapshot) => {
      bookingSets.set(
        "assigned",
        snapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data(),
        }))
      );
      emitBookings();
    },
    handleError
  );

  const paymentsUnsubscribe = includePayments
    ? onSnapshot(
        collection(db, "payments"),
        (snapshot) => {
          payments = snapshot.docs.map((paymentDoc) => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
          }));
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
 * Claim a pending booking for the staff member and auto-assign it to the
 * rider with the fewest active jobs.
 */
export const acceptBooking = async (bookingId, staffId) => {
  try {
    const ridersSnapshot = await getDocs(
      query(collection(db, "users"), where("role", "==", "rider"))
    );
    const riderRefs = ridersSnapshot.docs.map((riderDoc) => ({
      id: riderDoc.id,
      ref: riderDoc.ref,
      data: riderDoc.data(),
    }));

    if (riderRefs.length === 0) {
      throw new Error("No rider accounts are available to assign this booking.");
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

      const riders = riderSnapshots.map((riderSnapshot, index) => {
        const riderData = riderSnapshot.data();
        return {
          id: riderRefs[index].id,
          ref: riderRefs[index].ref,
          data: riderData,
          activeBookingCount:
            typeof riderData.active_booking_count === "number"
              ? riderData.active_booking_count
              : existingWorkloads[index],
        };
      });
      riders.sort(
        (a, b) =>
          a.activeBookingCount - b.activeBookingCount ||
          a.id.localeCompare(b.id)
      );
      const selectedRider = riders[0];
      const riderName =
        selectedRider.data.name ||
        selectedRider.data.displayName ||
        selectedRider.data.firstName ||
        selectedRider.data.email ||
        "Rider";

      transaction.update(bookingRef, {
        staff_id: staffId,
        rider_id: selectedRider.id,
        rider_name: riderName,
        status: "Accepted",
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, "Accepted");
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

      transaction.update(bookingRef, {
        status: newStatus,
        updated_at: serverTimestamp(),
      });
      addBookingStatusNotification(transaction, booking, bookingId, newStatus);
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

    const paymentSnapshot = await getDocs(
      query(collection(db, "payments"), where("booking_id", "==", bookingId))
    );
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

    paymentSnapshot.docs.forEach((paymentDoc) => {
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
    const bookings = querySnapshot.docs.map((bookingDoc) => ({
      id: bookingDoc.id,
      ...bookingDoc.data(),
    }));
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
  let payments = [];

  const emitBookings = () => {
    const paymentByBooking = new Map(
      payments.map((payment) => [String(payment.booking_id), payment])
    );

    onBookings(
      bookings
        .map((booking) => ({
          ...booking,
          payment: paymentByBooking.get(String(booking.id)) || null,
        }))
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

  const bookingsUnsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      bookings = querySnapshot.docs.map((bookingDoc) => ({
        id: bookingDoc.id,
        ...bookingDoc.data(),
      }));
      emitBookings();
    },
    handleError
  );

  const paymentsUnsubscribe = includePayments
    ? onSnapshot(
        collection(db, "payments"),
        (snapshot) => {
          payments = snapshot.docs.map((paymentDoc) => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
          }));
          emitBookings();
        },
        handleError
      )
    : () => {};

  return () => {
    bookingsUnsubscribe();
    paymentsUnsubscribe();
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
      bookings.push({ id: doc.id, ...doc.data() });
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
