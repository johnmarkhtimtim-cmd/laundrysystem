import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getCustomerBookings } from "../../services/bookingService";
import {
  createPayment,
  getCustomerPayments,
  updateCustomerPayment,
} from "../../services/paymentService";
import "../../styles/Payments.css";

const DEFAULT_GCASH_NAME = "Prince-Tyler Laundry Shop";
const DEFAULT_GCASH_NUMBER = "";
const DEFAULT_GCASH_QR = "/images/gcash-qr.png";

const SERVICES = [
  {
    name: "Wash & Fold",
    price: 80,
  },
  {
    name: "Dry Cleaning",
    price: 150,
  },
  {
    name: "Ironing",
    price: 60,
  },
  {
    name: "Bedding Care",
    price: 200,
  },
];

function getDateMilliseconds(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();

  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
}

function normalizePayment(payment) {
  return {
    ...payment,
    paymentId: payment.payment_id || payment.id,
    bookingId: payment.booking_id || payment.bookingId,
    userId: payment.customer_id || payment.userId,
    paymentMethod: payment.payment_method || payment.paymentMethod,
    paymentStatus: payment.payment_status || payment.paymentStatus,
    referenceNumber: payment.reference_number || payment.referenceNumber,
    gcashCustomerName:
      payment.gcash_customer_name || payment.gcashCustomerName,
    totalAmount: payment.total_amount ?? payment.totalAmount ?? payment.amount,
    createdAt: payment.created_at || payment.createdAt,
  };
}

function Payment() {
  const { user } = useAuth();

  // =========================================================
  // STATE
  // =========================================================

  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState("GCash");

  // CUSTOMER GCASH NAME
  const [gcashCustomerName, setGcashCustomerName] =
    useState("");

  // GCASH REFERENCE
  const [referenceNumber, setReferenceNumber] =
    useState("");

  // SHOP GCASH SETTINGS
  const [gcashName, setGcashName] =
    useState(DEFAULT_GCASH_NAME);

  const [gcashNumber, setGcashNumber] =
    useState(DEFAULT_GCASH_NUMBER);

  const [gcashQr, setGcashQr] =
    useState(DEFAULT_GCASH_QR);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [showPaymentSummary, setShowPaymentSummary] =
    useState(false);

  const [submittedPayment, setSubmittedPayment] =
    useState(null);

  const [editingPayment, setEditingPayment] =
    useState(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setBooking(null);
      setPayments([]);
    } else {
      const [userBookings, storedPayments] = await Promise.all([
        getCustomerBookings(user.uid),
        getCustomerPayments(user.uid),
      ]);

      const sortedBookings = [...userBookings].sort(
        (a, b) =>
          getDateMilliseconds(b.booking_date || b.created_at || b.createdAt) -
          getDateMilliseconds(a.booking_date || a.created_at || a.createdAt)
      );
      setBooking(sortedBookings[0] || null);
      setPayments(storedPayments.map(normalizePayment));
    }

    const settings = JSON.parse(
      localStorage.getItem("laundrymatePaymentSettings") || "{}"
    );
    setGcashName(settings.gcashName || DEFAULT_GCASH_NAME);
    setGcashNumber(settings.gcashNumber || DEFAULT_GCASH_NUMBER);
    setGcashQr(settings.gcashQr || DEFAULT_GCASH_QR);
  }, [user]);

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    let isMounted = true;
    const refreshData = async () => {
      try {
        await loadData();
        if (isMounted) setError("");
      } catch (error) {
        console.error("Failed to load payment data:", error);
        if (isMounted) {
          setBooking(null);
          setPayments([]);
          setError("Unable to load your booking or payment records. Please refresh to try again.");
        }
      }
    };

    refreshData();

    window.addEventListener(
      "laundrymatePaymentUpdated",
      refreshData
    );

    window.addEventListener(
      "laundrymatePaymentSettingsUpdated",
      refreshData
    );

    window.addEventListener(
      "laundrymateBookingUpdated",
      refreshData
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "laundrymatePaymentUpdated",
        refreshData
      );

      window.removeEventListener(
        "laundrymatePaymentSettingsUpdated",
        refreshData
      );

      window.removeEventListener(
        "laundrymateBookingUpdated",
        refreshData
      );
    };
  }, [loadData]);

  // =========================================================
  // GET SERVICE PRICE
  // =========================================================

  const getServicePrice = (serviceName) => {
    const service = SERVICES.find(
      (item) =>
        item.name.toLowerCase() ===
        String(serviceName)
          .toLowerCase()
          .trim()
    );

    return service ? service.price : 0;
  };

  // =========================================================
  // GET BOOKING SERVICES
  // =========================================================

  const bookingServices = useMemo(() => {
    if (!booking) return [];

    if (Array.isArray(booking.services)) {
      return booking.services;
    }

    if (booking.services) {
      return String(booking.services)
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);
    }

    if (booking.service) {
      return String(booking.service)
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);
    }

    return [];
  }, [booking]);

  // =========================================================
  // CALCULATE LAUNDRY SUBTOTAL
  // =========================================================

  const laundrySubtotal = useMemo(() => {
    if (!booking) return 0;

    // Current Book Now does not require weight.
    // If a future booking contains weight, support it.
    const weight = Number(
      booking.weight || 0
    );

    if (
      weight > 0 &&
      bookingServices.length > 0
    ) {
      return bookingServices.reduce(
        (total, service) =>
          total +
          getServicePrice(service) *
            weight,
        0
      );
    }

    return bookingServices.reduce(
      (total, service) =>
        total +
        getServicePrice(service),
      0
    );
  }, [booking, bookingServices]);

  // =========================================================
  // PICKUP FEE
  // =========================================================

  const pickupFee = useMemo(() => {
    if (!booking) return 0;

    const pickupType =
      booking.pickupType ||
      booking.pickupOption ||
      booking.deliveryType ||
      booking.pickup ||
      "Pickup & Delivery";

    if (
      String(pickupType)
        .toLowerCase()
        .includes("pickup only")
    ) {
      return 20;
    }

    return 30;
  }, [booking]);

  // =========================================================
  // TOTAL
  // =========================================================

  const calculatedTotal = useMemo(() => {
    if (!booking) return 0;

    const savedTotal = Number(
      booking.total_amount ??
        booking.totalAmount ??
        booking.estimatedTotal ??
        0
    );

    if (savedTotal > 0) {
      return savedTotal;
    }

    return laundrySubtotal + pickupFee;
  }, [
    booking,
    laundrySubtotal,
    pickupFee,
  ]);

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (amount) => {
    return `₱${Number(
      amount || 0
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  };

  // =========================================================
  // BOOKING SCHEDULE
  // =========================================================

  const getBookingSchedule = () => {
    if (!booking) return "—";

    // New Book Now format
    if (
      booking.schedule &&
      booking.time
    ) {
      return `${formatDate(
        booking.schedule
      )} • ${booking.time}`;
    }

    return (
      booking.pickup_date ||
      booking.pickupDate ||
      booking.schedule ||
      booking.date ||
      "—"
    );
  };

  // =========================================================
  // ADDRESS
  // =========================================================

  const getAddress = () => {
    if (!booking) return "—";

    return (
      booking.address ||
      booking.pickupAddress ||
      booking.laundryAddress ||
      "—"
    );
  };

  // =========================================================
  // BARANGAY
  // =========================================================

  const getBarangay = () => {
    if (!booking) return "—";

    return (
      booking.barangay ||
      booking.addressBarangay ||
      "—"
    );
  };

  // =========================================================
  // CITY
  // =========================================================

  const getCity = () => {
    if (!booking) return "—";

    return (
      booking.city ||
      booking.addressCity ||
      "—"
    );
  };

  // =========================================================
  // PROVINCE
  // =========================================================

  const getProvince = () => {
    if (!booking) return "—";

    return (
      booking.province ||
      booking.addressProvince ||
      "—"
    );
  };

  // =========================================================
  // LANDMARK
  // =========================================================

  const getLandmark = () => {
    if (!booking) return "—";

    return (
      booking.landmark ||
      "—"
    );
  };

  // =========================================================
  // PAYMENT METHOD
  // =========================================================

  const handlePaymentMethodChange = (
    method
  ) => {
    setPaymentMethod(method);
    setError("");
  };

  // =========================================================
  // GCASH CUSTOMER NAME
  // =========================================================

  const handleGcashCustomerNameChange = (
    event
  ) => {
    setGcashCustomerName(
      event.target.value
    );

    if (error) {
      setError("");
    }
  };

  // =========================================================
  // GCASH REFERENCE
  // =========================================================

  const handleReferenceChange = (
    event
  ) => {
    setReferenceNumber(
      event.target.value
    );

    if (error) {
      setError("");
    }
  };

  // =========================================================
  // CONFIRM PAYMENT
  // =========================================================

  const handleConfirmPayment = async () => {
    if (!booking) {
      setError(
        "You do not have a booking to pay."
      );
      return;
    }

    if (isSubmitting) return;

    const bookingId =
      booking.bookingId ||
      booking.id;

    // =====================================================
    // DUPLICATE PENDING PAYMENT
    // =====================================================

    const duplicatePayment =
      payments.find(
        (payment) =>
          String(payment.bookingId) ===
            String(bookingId) &&
          String(
            payment.paymentStatus ||
              payment.status ||
              ""
          ).toLowerCase() ===
            "pending"
      );

    if (
      duplicatePayment &&
      editingPayment?.id !==
        duplicatePayment.id
    ) {
      setError(
        "This booking already has a pending payment."
      );
      return;
    }

    // =====================================================
    // GCASH VALIDATION
    // =====================================================

    if (paymentMethod === "GCash") {
      const cleanName =
        gcashCustomerName.trim();

      const cleanReference =
        referenceNumber.trim();

      if (!cleanName) {
        setError(
          "Please enter your GCash account name."
        );
        return;
      }

      if (cleanName.length < 2) {
        setError(
          "Please enter a valid GCash account name."
        );
        return;
      }

      if (!cleanReference) {
        setError(
          "Please enter your GCash reference number."
        );
        return;
      }

      if (cleanReference.length < 6) {
        setError(
          "GCash reference number must contain at least 6 characters."
        );
        return;
      }
    }

    // =====================================================
    // START SUBMIT
    // =====================================================

    setIsSubmitting(true);
    setError("");

    try {
      if (!user?.uid) {
        throw new Error("You must be signed in to submit a payment.");
      }

      const paymentDetails = {
        customer_name:
          user?.displayName ||
          user?.name ||
          booking.customer_name ||
          booking.customerName ||
          "Customer",
        gcash_customer_name:
          paymentMethod === "GCash"
            ? gcashCustomerName.trim()
            : "",
        reference_number:
          paymentMethod === "GCash"
            ? referenceNumber.trim()
            : "",
        services: bookingServices.join(", "),
        total_amount: calculatedTotal,
      };

      let paymentId;
      if (editingPayment?.id) {
        await updateCustomerPayment(editingPayment.id, {
            amount: calculatedTotal,
            payment_method: paymentMethod,
            ...paymentDetails,
          });
        paymentId = editingPayment.id;
      } else {
        paymentId = await createPayment(
            bookingId,
            user.uid,
            calculatedTotal,
            paymentMethod,
            "Pending",
            paymentDetails
          );
      }

      const paymentData = {
        id: paymentId,
        paymentId,
        bookingId,
        userId: user.uid,
        customerId: user.uid,
        customerName:
          user?.displayName ||
          user?.name ||
          booking.customer_name ||
          booking.customerName ||
          "Customer",
        gcashCustomerName: paymentDetails.gcash_customer_name,
        services: paymentDetails.services,
        totalAmount: calculatedTotal,
        amount: calculatedTotal,
        paymentMethod,
        paymentStatus: "Pending",
        status: "Pending",
        referenceNumber: paymentDetails.reference_number,
        createdAt:
          editingPayment?.createdAt ||
          new Date().toISOString(),
      };

      setPayments((currentPayments) =>
        [
          paymentData,
          ...currentPayments.filter((payment) => payment.id !== paymentId),
        ].sort(
          (a, b) =>
            getDateMilliseconds(b.createdAt) -
            getDateMilliseconds(a.createdAt)
        )
      );

      setSubmittedPayment(
        paymentData
      );

      setShowPaymentSummary(
        true
      );

      setReferenceNumber("");

      setGcashCustomerName("");

      setEditingPayment(null);

      setSuccessMessage(
        "Payment submitted successfully!"
      );

      // =====================================================
      // EVENTS
      // =====================================================

      window.dispatchEvent(
        new Event(
          "laundrymatePaymentUpdated"
        )
      );

      window.dispatchEvent(
        new Event(
          "laundrymateBookingUpdated"
        )
      );
    } catch (error) {
      console.error(
        "Payment submission error:",
        error
      );

      setError(
        "Something went wrong while submitting your payment. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // CANCEL EDIT
  // =========================================================

  const handleCancelEdit = () => {
    setEditingPayment(null);

    setPaymentMethod("GCash");

    setGcashCustomerName("");

    setReferenceNumber("");

    setError("");
  };

  // =========================================================
  // DONE
  // =========================================================

  const handleDone = () => {
    setShowPaymentSummary(false);

    setSubmittedPayment(null);

    setSuccessMessage("");

    setPaymentMethod("GCash");

    setGcashCustomerName("");

    setReferenceNumber("");

    setEditingPayment(null);

    loadData();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================================
  // NO BOOKING
  // =========================================================

  if (!booking) {
    return (
      <div className="payments-page">

        <div className="payments-header">
          <div>
            <span className="page-label">
              CUSTOMER PORTAL
            </span>

            <h1>Payments</h1>

            <p>
              Manage your laundry payments
              in one place.
            </p>
          </div>
        </div>

        <div className="empty-payment-card">

          <div className="empty-payment-icon">
            💳
          </div>

          <h2>
            No Confirmed Booking
          </h2>

          <p>
            You need to create a booking
            before making a payment.
          </p>

        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="payments-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="payments-header">

        <div>

          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>
            Payments
          </h1>

          <p>
            Review your booking and
            complete your payment.
          </p>

        </div>

      </div>

      {/* =====================================================
          SUCCESS ALERT
      ===================================================== */}

      {successMessage && (
        <div className="payment-success-alert">

          <span>✓</span>

          <div>
            <strong>
              {successMessage}
            </strong>

            <p>
              Your payment is now pending
              verification by the laundry
              staff.
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          EDIT MODE
      ===================================================== */}

      {editingPayment && (
        <div className="edit-payment-alert">

          <div>
            <strong>
              Editing Pending Payment
            </strong>

            <p>
              Update your payment details
              and confirm again.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleCancelEdit
            }
            className="cancel-edit-btn"
          >
            Cancel
          </button>

        </div>
      )}

      {/* =====================================================
          MAIN GRID
      ===================================================== */}

      <div className="payment-main-grid">

        {/* ===================================================
            BOOKING SUMMARY
        =================================================== */}

        <div className="payment-card booking-summary-card">

          <div className="payment-card-header">

            <div>

              <span className="card-label">
                CURRENT BOOKING
              </span>

              <h2>
                Booking Summary
              </h2>

            </div>

            <span className="booking-status">
              {booking.status ||
                "Pending"}
            </span>

          </div>

          {/* BOOKING ID */}

          <div className="booking-id-box">

            <span>
              Booking ID
            </span>

            <strong>
              {booking.bookingId ||
                booking.id ||
                "—"}
            </strong>

          </div>

          {/* SERVICES */}

          <div className="summary-group">

            <span className="summary-label">
              Laundry Services
            </span>

            <div className="service-list">

              {bookingServices.length >
              0 ? (
                bookingServices.map(
                  (
                    service,
                    index
                  ) => (
                    <div
                      key={`${service}-${index}`}
                      className="service-row"
                    >

                      <span>
                        {service}
                      </span>

                      <strong>
                        {formatCurrency(
                          getServicePrice(
                            service
                          )
                        )}
                        {Number(
                          booking.weight
                        ) > 0
                          ? "/kg"
                          : ""}
                      </strong>

                    </div>
                  )
                )
              ) : (
                <span>
                  No service information
                </span>
              )}

            </div>

          </div>

          {/* SCHEDULE */}

          <div className="summary-info-grid">

            <div className="summary-info-item">

              <span>
                📅 Pickup Schedule
              </span>

              <strong>
                {getBookingSchedule()}
              </strong>

            </div>

            <div className="summary-info-item">

              <span>
                🚚 Pickup Option
              </span>

              <strong>
                {booking.pickupType ||
                  booking.pickupOption ||
                  booking.deliveryType ||
                  "Pickup & Delivery"}
              </strong>

            </div>

          </div>

          {/* ADDRESS */}

          <div className="summary-address">

            <span className="summary-label">
              Pickup Address
            </span>

            <strong>
              {getAddress()}
            </strong>

            <p>
              {getBarangay()}
              {getBarangay() !== "—" &&
                ", "}
              {getCity()}
              {getCity() !== "—" &&
                ", "}
              {getProvince()}
            </p>

            {getLandmark() !==
              "—" && (
              <small>
                📍 Landmark:{" "}
                {getLandmark()}
              </small>
            )}

          </div>

          {/* PRICE BREAKDOWN */}

          <div className="payment-price-breakdown">

            <div>
              <span>
                Laundry Services
              </span>

              <strong>
                {formatCurrency(
                  laundrySubtotal
                )}
              </strong>
            </div>

            <div>
              <span>
                {booking.pickupType ===
                "Pickup Only"
                  ? "Pickup Fee"
                  : "Pickup & Delivery Fee"}
              </span>

              <strong>
                {formatCurrency(
                  pickupFee
                )}
              </strong>
            </div>

          </div>

          {/* TOTAL */}

          <div className="booking-total-box">

            <div>

              <span>
                Total Amount
              </span>

              <small>
                Final amount for this
                booking
              </small>

            </div>

            <strong>
              {formatCurrency(
                calculatedTotal
              )}
            </strong>

          </div>

        </div>

        {/* ===================================================
            PAYMENT FORM
        =================================================== */}

        <div className="payment-card payment-form-card">

          <div className="payment-card-header">

            <div>

              <span className="card-label">
                PAYMENT
              </span>

              <h2>
                Payment Method
              </h2>

            </div>

          </div>

          {/* PAYMENT OPTIONS */}

          <div className="payment-methods">

            <button
              type="button"
              className={`payment-method ${
                paymentMethod ===
                "GCash"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handlePaymentMethodChange(
                  "GCash"
                )
              }
            >

              <span className="method-icon">
                G
              </span>

              <span>

                <strong>
                  GCash
                </strong>

                <small>
                  Online payment
                </small>

              </span>

              <span className="radio-circle">
                {paymentMethod ===
                  "GCash" &&
                  "✓"}
              </span>

            </button>

            <button
              type="button"
              className={`payment-method ${
                paymentMethod ===
                "Cash"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handlePaymentMethodChange(
                  "Cash"
                )
              }
            >

              <span className="method-icon cash-icon">
                ₱
              </span>

              <span>

                <strong>
                  Cash
                </strong>

                <small>
                  Pay upon pickup
                </small>

              </span>

              <span className="radio-circle">
                {paymentMethod ===
                  "Cash" &&
                  "✓"}
              </span>

            </button>

          </div>

          {/* =================================================
              GCASH
          ================================================= */}

          {paymentMethod ===
            "GCash" && (
            <div className="gcash-payment-box">

              <div className="gcash-header">

                <div>

                  <h3>
                    Pay using GCash
                  </h3>

                  <p>
                    Scan the QR code,
                    send the exact amount,
                    then enter your payment
                    details.
                  </p>

                </div>

              </div>

              <div className="gcash-content">

                {/* QR */}

                <div className="gcash-qr-wrapper">

                  {gcashQr ? (
                    <img
                      src={gcashQr}
                      alt="Prince-Tyler Laundry Shop GCash QR"
                      className="gcash-qr"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";

                        const fallback =
                          event.currentTarget
                            .nextElementSibling;

                        if (fallback) {
                          fallback.style.display =
                            "flex";
                        }
                      }}
                    />
                  ) : null}

                  <div
                    className="gcash-qr-fallback"
                    style={{
                      display:
                        gcashQr
                          ? "none"
                          : "flex",
                    }}
                  >
                    <span>
                      QR
                    </span>

                    <small>
                      GCash QR
                      unavailable
                    </small>
                  </div>

                </div>

                {/* SHOP DETAILS */}

                <div className="gcash-details">

                  <div>

                    <span>
                      Account Name
                    </span>

                    <strong>
                      {gcashName}
                    </strong>

                  </div>

                  {gcashNumber && (
                    <div>

                      <span>
                        GCash Number
                      </span>

                      <strong>
                        {gcashNumber}
                      </strong>

                    </div>
                  )}

                  <div>

                    <span>
                      Amount to Send
                    </span>

                    <strong>
                      {formatCurrency(
                        calculatedTotal
                      )}
                    </strong>

                  </div>

                </div>

              </div>

              {/* CUSTOMER GCASH NAME */}

              <div className="form-group">

                <label htmlFor="gcashCustomerName">
                  Your GCash Name
                  <span>*</span>
                </label>

                <input
                  id="gcashCustomerName"
                  type="text"
                  value={
                    gcashCustomerName
                  }
                  onChange={
                    handleGcashCustomerNameChange
                  }
                  placeholder="Enter the name on your GCash account"
                  maxLength={50}
                />

                <small>
                  Enter the GCash account name
                  used to make the payment.
                </small>

              </div>

              {/* REFERENCE NUMBER */}

              <div className="form-group">

                <label htmlFor="referenceNumber">
                  GCash Reference Number
                  <span>*</span>
                </label>

                <input
                  id="referenceNumber"
                  type="text"
                  value={
                    referenceNumber
                  }
                  onChange={
                    handleReferenceChange
                  }
                  placeholder="Enter your GCash reference number"
                  maxLength={30}
                />

                <small>
                  The reference number can
                  be found on your GCash
                  payment receipt.
                </small>

              </div>

            </div>
          )}

          {/* =================================================
              CASH
          ================================================= */}

          {paymentMethod ===
            "Cash" && (
            <div className="cash-payment-box">

              <div className="cash-icon-large">
                ₱
              </div>

              <div>

                <h3>
                  Cash Payment
                </h3>

                <p>
                  You selected cash payment.
                  Please prepare the exact
                  amount when your laundry is
                  picked up or delivered.
                </p>

                <strong>
                  Amount to prepare:{" "}
                  {formatCurrency(
                    calculatedTotal
                  )}
                </strong>

              </div>

            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="payment-error">

              <span>!</span>

              <p>
                {error}
              </p>

            </div>
          )}

          {/* TOTAL */}

          <div className="payment-total">

            <span>
              Amount to Pay
            </span>

            <strong>
              {formatCurrency(
                calculatedTotal
              )}
            </strong>

          </div>

          {/* CONFIRM */}

          <button
            type="button"
            className="confirm-payment-btn"
            onClick={
              handleConfirmPayment
            }
            disabled={isSubmitting}
          >

            {isSubmitting ? (
              <>
                <span className="spinner" />
                Submitting...
              </>
            ) : editingPayment ? (
              "Update Payment"
            ) : (
              "Confirm Payment"
            )}

          </button>

          <p className="payment-note">
            Your payment will be marked as
            <strong>
              {" "}
              Pending
            </strong>{" "}
            until it is verified by the
            laundry staff.
          </p>

        </div>

      </div>

      {/* =====================================================
          PAYMENT SUMMARY MODAL
      ===================================================== */}

      {showPaymentSummary &&
        submittedPayment && (
          <div className="payment-modal-overlay">

            <div className="payment-summary-modal">

              {/* SUCCESS ICON */}

              <div className="submitted-icon">
                ✓
              </div>

              <h2>
                Payment Submitted!
              </h2>

              <p className="submitted-message">
                Your booking payment has
                been successfully recorded.
                It is now pending verification.
              </p>

              {/* STATUS */}

              <div className="submitted-status">

                <span>
                  Payment Status
                </span>

                <strong>
                  Pending
                </strong>

              </div>

              {/* DETAILS */}

              <div className="submitted-details">

                <div>

                  <span>
                    Booking ID
                  </span>

                  <strong>
                    {
                      submittedPayment.bookingId
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Payment ID
                  </span>

                  <strong>
                    {
                      submittedPayment.paymentId
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Payment Method
                  </span>

                  <strong>
                    {
                      submittedPayment.paymentMethod
                    }
                  </strong>

                </div>

                {submittedPayment.gcashCustomerName && (
                  <div>

                    <span>
                      GCash Name
                    </span>

                    <strong>
                      {
                        submittedPayment.gcashCustomerName
                      }
                    </strong>

                  </div>
                )}

                {submittedPayment.referenceNumber && (
                  <div>

                    <span>
                      GCash Reference
                    </span>

                    <strong>
                      {
                        submittedPayment.referenceNumber
                      }
                    </strong>

                  </div>
                )}

                <div>

                  <span>
                    Pickup Schedule
                  </span>

                  <strong>
                    {getBookingSchedule()}
                  </strong>

                </div>

                <div>

                  <span>
                    Services
                  </span>

                  <strong>
                    {
                      submittedPayment.services
                    }
                  </strong>

                </div>

              </div>

              {/* TOTAL */}

              <div className="submitted-total">

                <span>
                  Total Amount
                </span>

                <strong>
                  {formatCurrency(
                    submittedPayment.totalAmount
                  )}
                </strong>

              </div>

              {/* DONE */}

              <button
                type="button"
                className="done-payment-btn"
                onClick={
                  handleDone
                }
              >
                Done
              </button>

            </div>

          </div>
        )}

    </div>
  );
}

export default Payment;