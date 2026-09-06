import { useEffect, useState } from "react";
import "../../styles/Payments.css";

function Payment() {
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [referenceNumber, setReferenceNumber] = useState("");

  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [submittedReference, setSubmittedReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =====================================
  // DEFAULT GCASH INFORMATION
  // =====================================

  const DEFAULT_GCASH_NUMBER = "0912 345 6789";
  const DEFAULT_GCASH_NAME = "Prince-Tyler Laundry Shop";
  const DEFAULT_GCASH_QR = "/images/gcash-qr.png";

  const [gcashSettings, setGcashSettings] = useState({
    name: DEFAULT_GCASH_NAME,
    number: DEFAULT_GCASH_NUMBER,
    qr: DEFAULT_GCASH_QR,
  });

  // =====================================
  // SERVICE PRICES
  // =====================================

  const servicePrices = {
    "Wash & Fold": 80,
    "Dry Cleaning": 150,
    Ironing: 60,
    "Bedding Care": 200,
  };

  // =====================================
  // FORMAT CURRENCY
  // =====================================

  const formatCurrency = (amount) => {
    return Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // =====================================
  // LOAD PAYMENT SETTINGS
  // =====================================

  const loadGcashSettings = () => {
    try {
      const savedSettings = JSON.parse(
        localStorage.getItem("laundrymatePaymentSettings") || "null"
      );

      if (savedSettings) {
        setGcashSettings({
          name: savedSettings.gcashName || DEFAULT_GCASH_NAME,
          number: savedSettings.gcashNumber || DEFAULT_GCASH_NUMBER,
          qr: savedSettings.gcashQr || DEFAULT_GCASH_QR,
        });
      } else {
        setGcashSettings({
          name: DEFAULT_GCASH_NAME,
          number: DEFAULT_GCASH_NUMBER,
          qr: DEFAULT_GCASH_QR,
        });
      }
    } catch (error) {
      console.error("Unable to load GCash settings:", error);
    }
  };

  // =====================================
  // FORMAT PAYMENT HISTORY
  // NEWEST TRANSACTION FIRST
  // =====================================

  const formatPayments = (savedPayments) => {
    return [...savedPayments]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      )
      .map((payment) => ({
        id: payment.id || `PAY-${payment.bookingId}`,

        booking: payment.bookingId || "—",

        service:
          payment.services?.length > 0
            ? payment.services.join(", ")
            : "Laundry Service",

        date: payment.createdAt
          ? new Date(payment.createdAt).toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              }
            )
          : "—",

        amount: Number(payment.totalAmount || 0),

        method:
          payment.paymentMethod === "Cash"
            ? "Cash"
            : "GCash",

        status:
          payment.paymentStatus === "Paid"
            ? "Paid"
            : "Pending",

        referenceNumber:
          payment.referenceNumber || "",

        createdAt: payment.createdAt || null,
      }));
  };

  // =====================================
  // LOAD BOOKINGS + PAYMENTS
  // =====================================

  useEffect(() => {
    const loadPaymentData = () => {
      try {
        const savedBookings = JSON.parse(
          localStorage.getItem("laundrymateBookings") || "[]"
        );

        const savedPayments = JSON.parse(
          localStorage.getItem("laundrymatePayments") || "[]"
        );

        if (savedBookings.length > 0) {
          const latestBooking =
            savedBookings[savedBookings.length - 1];

          setBooking(latestBooking);
        } else {
          setBooking(null);
        }

        setPayments(formatPayments(savedPayments));
      } catch (error) {
        console.error("Unable to load payment data:", error);
      }
    };

    loadPaymentData();
    loadGcashSettings();

    window.addEventListener("storage", loadPaymentData);
    window.addEventListener("storage", loadGcashSettings);

    window.addEventListener(
      "laundrymatePaymentUpdated",
      loadPaymentData
    );

    window.addEventListener(
      "laundrymatePaymentSettingsUpdated",
      loadGcashSettings
    );

    return () => {
      window.removeEventListener("storage", loadPaymentData);
      window.removeEventListener("storage", loadGcashSettings);

      window.removeEventListener(
        "laundrymatePaymentUpdated",
        loadPaymentData
      );

      window.removeEventListener(
        "laundrymatePaymentSettingsUpdated",
        loadGcashSettings
      );
    };
  }, []);

  // =====================================
  // PAYMENT STATISTICS
  // =====================================

  const totalSpent = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0
  );

  const paidAmount = payments
    .filter((payment) => payment.status === "Paid")
    .reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );

  const pendingAmount = payments
    .filter((payment) => payment.status === "Pending")
    .reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );

  // =====================================
  // MOST RECENT TRANSACTION
  // =====================================

  const recentPayment =
    payments.length > 0
      ? payments[0]
      : null;

  // =====================================
  // CURRENT BOOKING
  // =====================================

  const bookingTotal = Number(
    booking?.estimatedTotal || 0
  );

  const laundrySubtotal = Number(
    booking?.laundrySubtotal || 0
  );

  const deliveryFee = Number(
    booking?.deliveryFee || 0
  );

  const services = booking?.services || [];

  const numericWeight = Number(
    booking?.weight || 0
  );

  const minimumServicePrice = services.reduce(
    (total, serviceName) =>
      total + (servicePrices[serviceName] || 0),
    0
  );

  const displayedLaundryTotal =
    numericWeight > 0
      ? laundrySubtotal
      : minimumServicePrice;

  // =====================================
  // SAVE PAYMENT
  // =====================================

  const savePayment = ({
    method,
    status,
    reference = "",
  }) => {
    if (!booking) {
      return null;
    }

    try {
      const existingPayments = JSON.parse(
        localStorage.getItem("laundrymatePayments") || "[]"
      );

      const newPayment = {
        id: `PAY-${Date.now()}`,
        bookingId: booking.id,
        services: booking.services || [],
        totalAmount: bookingTotal,
        paymentMethod: method,
        paymentStatus: status,
        referenceNumber: reference,
        createdAt: new Date().toISOString(),
      };

      const updatedPayments = [
        ...existingPayments,
        newPayment,
      ];

      localStorage.setItem(
        "laundrymatePayments",
        JSON.stringify(updatedPayments)
      );

      setPayments(formatPayments(updatedPayments));

      window.dispatchEvent(
        new Event("laundrymatePaymentUpdated")
      );

      return newPayment;
    } catch (error) {
      console.error("Unable to save payment:", error);
      alert("Unable to save payment. Please try again.");
      return null;
    }
  };

  // =====================================
  // PAYMENT HANDLER
  // =====================================

  const handlePayment = (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!booking) {
      alert("Please confirm a booking first.");
      return;
    }

    const cleanReference =
      paymentMethod === "GCash"
        ? referenceNumber.trim()
        : "";

    // =====================================
    // GCASH VALIDATION
    // =====================================

    if (paymentMethod === "GCash") {
      if (!cleanReference) {
        alert("Please enter your GCash reference number.");
        return;
      }

      if (cleanReference.length < 6) {
        alert(
          "Please enter a valid GCash reference number."
        );
        return;
      }
    }

    // =====================================
    // CHECK DUPLICATE PENDING PAYMENT
    // =====================================

    try {
      const existingPayments = JSON.parse(
        localStorage.getItem("laundrymatePayments") || "[]"
      );

      const alreadySubmitted = existingPayments.some(
        (payment) =>
          payment.bookingId === booking.id &&
          payment.paymentStatus === "Pending"
      );

      if (alreadySubmitted) {
        alert(
          "A payment for this booking has already been submitted and is pending verification."
        );
        return;
      }
    } catch (error) {
      console.error("Payment validation error:", error);
    }

    setIsSubmitting(true);

    const newPayment = savePayment({
      method: paymentMethod,
      status: "Pending",
      reference: cleanReference,
    });

    if (newPayment) {
      setSubmittedReference(cleanReference);
      setShowPaymentSummary(true);
      setReferenceNumber("");
    }

    setIsSubmitting(false);
  };

  // =====================================
  // DONE BUTTON
  // =====================================

  const handleDone = () => {
    setShowPaymentSummary(false);
  };

  // =====================================
  // QR ERROR HANDLER
  // =====================================

  const handleQrError = (e) => {
    e.currentTarget.style.display = "none";

    const fallback =
      e.currentTarget.parentElement.querySelector(
        ".qr-fallback"
      );

    if (fallback) {
      fallback.style.display = "flex";
    }
  };

  // =====================================
  // NO BOOKING
  // =====================================

  if (!booking) {
    return (
      <div className="payment-page">

        <header className="payment-page-header">
          <div>
            <span className="payment-eyebrow">
              LAUNDRYMATE
            </span>

            <h1>Payments</h1>

            <p>
              Manage your laundry payments securely
              and conveniently.
            </p>
          </div>

          <div className="payment-header-icon">
            ₱
          </div>
        </header>

        <div className="empty-payment-card">

          <div className="empty-payment-icon">
            🧺
          </div>

          <h2>No Confirmed Booking</h2>

          <p>
            Confirm a laundry booking first to view
            your payment summary.
          </p>

        </div>
      </div>
    );
  }

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="payment-page">

      {/* =====================================
          HEADER
      ===================================== */}

      <header className="payment-page-header">

        <div>
          <span className="payment-eyebrow">
            LAUNDRYMATE
          </span>

          <h1>Payments</h1>

          <p>
            Complete your laundry payment securely.
          </p>
        </div>

        <div className="payment-header-icon">
          ₱
        </div>

      </header>

      {/* =====================================
          MAIN GRID
      ===================================== */}

      <div className="payment-main-grid">

        {/* =====================================
            LEFT CARD
        ===================================== */}

        <main className="payment-card">

          <div className="payment-card-header">

            <div>
              <span className="section-kicker">
                CHECKOUT
              </span>

              <h2>Make a Payment</h2>

              <p>
                Choose your preferred payment method.
              </p>
            </div>

            <span className="secure-badge">
              🔒 Secure
            </span>

          </div>

          {/* BOOKING */}

          <div className="payment-booking">

            <div className="payment-booking-icon">
              🧺
            </div>

            <div className="payment-booking-info">

              <span>
                Booking #{booking.id}
              </span>

              <strong>
                {services.length > 0
                  ? services.join(", ")
                  : "Laundry Service"}
              </strong>

              <small>
                {booking.schedule || "—"}{" "}
                •{" "}
                {booking.time || "—"}{" "}
                •{" "}
                {booking.weight || 0} kg
              </small>

            </div>

            <strong className="booking-price">
              ₱{formatCurrency(bookingTotal)}
            </strong>

          </div>

          {/* PAYMENT METHOD */}

          <div className="payment-section">

            <div className="payment-section-heading">

              <div>
                <h3>Payment Method</h3>

                <p>
                  Select how you want to pay.
                </p>
              </div>

            </div>

            <div className="payment-methods">

              {/* GCASH */}

              <button
                type="button"
                className={
                  paymentMethod === "GCash"
                    ? "payment-method selected"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("GCash")}
              >

                <div className="method-icon gcash-icon">
                  G
                </div>

                <div className="method-content">

                  <strong>
                    GCash
                  </strong>

                  <span>
                    Pay using your GCash account
                  </span>

                </div>

                <div className="method-radio">
                  {paymentMethod === "GCash" && "✓"}
                </div>

              </button>

              {/* CASH */}

              <button
                type="button"
                className={
                  paymentMethod === "Cash"
                    ? "payment-method selected"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("Cash")}
              >

                <div className="method-icon cash-icon-small">
                  ₱
                </div>

                <div className="method-content">

                  <strong>
                    Cash
                  </strong>

                  <span>
                    Pay upon pickup or delivery
                  </span>

                </div>

                <div className="method-radio">
                  {paymentMethod === "Cash" && "✓"}
                </div>

              </button>

            </div>
          </div>

          {/* =====================================
              GCASH
          ===================================== */}

          {paymentMethod === "GCash" && (

            <div className="gcash-payment-box">

              <div className="gcash-payment-header">

                <div className="gcash-logo">
                  G
                </div>

                <div>

                  <strong>
                    Pay with GCash
                  </strong>

                  <span>
                    Scan the QR code or send payment
                    directly.
                  </span>

                </div>

              </div>

              <div className="gcash-payment-content">

                {/* QR */}

                <div className="gcash-qr-section">

                  <div className="qr-frame">

                    <img
                      src={gcashSettings.qr}
                      alt={`${gcashSettings.name} GCash QR Code`}
                      className="gcash-qr"
                      onError={handleQrError}
                    />

                    <div
                      className="qr-fallback"
                      style={{ display: "none" }}
                    >

                      <span>
                        GCash
                      </span>

                      <small>
                        QR CODE
                      </small>

                      <em>
                        QR image unavailable
                      </em>

                    </div>

                  </div>

                  <p>
                    Scan using your GCash app
                  </p>

                </div>

                {/* ACCOUNT */}

                <div className="gcash-account">

                  <div className="gcash-account-label">
                    GCash Account
                  </div>

                  <div className="gcash-account-card">

                    <span>
                      Account Name
                    </span>

                    <strong>
                      {gcashSettings.name}
                    </strong>

                  </div>

                  <div className="gcash-account-card">

                    <span>
                      GCash Number
                    </span>

                    <strong className="gcash-number">
                      {gcashSettings.number}
                    </strong>

                  </div>

                  <div className="gcash-amount-card">

                    <span>
                      Amount to Pay
                    </span>

                    <strong>
                      ₱{formatCurrency(bookingTotal)}
                    </strong>

                  </div>

                </div>

              </div>

              {/* INSTRUCTIONS */}

              <div className="gcash-instructions">

                <div className="instruction-icon">
                  i
                </div>

                <div>

                  <strong>
                    Payment Instructions
                  </strong>

                  <ol>

                    <li>
                      Open your GCash application.
                    </li>

                    <li>
                      Scan the QR code or send{" "}
                      <strong>
                        ₱{formatCurrency(bookingTotal)}
                      </strong>{" "}
                      to{" "}
                      <strong>
                        {gcashSettings.number}
                      </strong>.
                    </li>

                    <li>
                      Enter your GCash reference
                      number below.
                    </li>

                    <li>
                      Click{" "}
                      <strong>
                        "Confirm GCash Payment"
                      </strong>.
                    </li>

                  </ol>

                </div>

              </div>

              {/* REFERENCE */}

              <div className="reference-input">

                <label>
                  GCash Reference Number
                </label>

                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) =>
                    setReferenceNumber(e.target.value)
                  }
                  placeholder="Enter your GCash reference number"
                  maxLength={30}
                  autoComplete="off"
                />

                <small>
                  You can find this number in your
                  GCash transaction receipt.
                </small>

              </div>

            </div>
          )}

          {/* =====================================
              CASH
          ===================================== */}

          {paymentMethod === "Cash" && (

            <div className="cash-payment-box">

              <div className="cash-payment-icon">
                ₱
              </div>

              <div>

                <strong>
                  Cash Payment
                </strong>

                <p>
                  Please prepare the exact amount of{" "}
                  <strong>
                    ₱{formatCurrency(bookingTotal)}
                  </strong>.
                  Payment can be made when your
                  laundry is picked up or delivered.
                </p>

              </div>

            </div>
          )}

          {/* =====================================
              CONFIRM BUTTON
          ===================================== */}

          <button
            type="button"
            className={
              paymentMethod === "GCash"
                ? "pay-button gcash-pay-button"
                : "pay-button"
            }
            onClick={handlePayment}
            disabled={isSubmitting}
          >

            <span>
              {isSubmitting
                ? "Processing..."
                : paymentMethod === "GCash"
                ? "Confirm GCash Payment"
                : "Confirm Cash Payment"}
            </span>

            {!isSubmitting && (
              <span className="pay-arrow">
                →
              </span>
            )}

          </button>

        </main>

        {/* =====================================
            RIGHT SUMMARY
        ===================================== */}

        <aside className="payment-summary">

          <div className="summary-title">

            <div>

              <span className="section-kicker">
                ORDER
              </span>

              <h2>
                Payment Summary
              </h2>

            </div>

            <span className="current-badge">
              Current
            </span>

          </div>

          <div className="payment-summary-section-label">
            Selected Services
          </div>

          <div className="payment-summary-services">

            {services.map((serviceName) => {

              const price =
                servicePrices[serviceName] || 0;

              const serviceTotal =
                numericWeight > 0
                  ? price * numericWeight
                  : price;

              return (
                <div
                  className="payment-summary-service-row"
                  key={serviceName}
                >

                  <div className="payment-summary-service-left">

                    <div className="summary-service-icon">
                      🧺
                    </div>

                    <div>

                      <strong>
                        {serviceName}
                      </strong>

                      <span>
                        ₱{formatCurrency(price)}/kg
                      </span>

                    </div>

                  </div>

                  <strong className="payment-summary-service-amount">
                    ₱{formatCurrency(serviceTotal)}
                  </strong>

                </div>
              );
            })}

          </div>

          {/* SUMMARY ITEMS */}

          <div className="summary-items">

            <div>
              <span>
                Laundry
              </span>

              <strong>
                ₱{formatCurrency(displayedLaundryTotal)}
              </strong>
            </div>

            <div>
              <span>
                Service Type
              </span>

              <strong>
                {booking.pickupType || "—"}
              </strong>
            </div>

            <div>
              <span>
                Pickup Date
              </span>

              <strong>
                {booking.schedule || "—"}
              </strong>
            </div>

            <div>
              <span>
                Pickup Time
              </span>

              <strong>
                {booking.time || "—"}
              </strong>
            </div>

            <div>
              <span>
                Pickup Location
              </span>

              <strong className="summary-long-text">
                {[
                  booking.address,
                  booking.barangay,
                  booking.city,
                  booking.province,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not provided"}
              </strong>
            </div>

            <div>
              <span>
                Landmark
              </span>

              <strong className="summary-long-text">
                {booking.landmark || "None"}
              </strong>
            </div>

            <div>
              <span>
                {booking.pickupType === "Pickup & Delivery"
                  ? "Pickup & Delivery Fee"
                  : "Pickup Fee"}
              </span>

              <strong>
                ₱{formatCurrency(deliveryFee)}
              </strong>
            </div>

          </div>

          {/* TOTAL */}

          <div className="summary-total">

            <div>

              <span>
                Estimated Total
              </span>

              <small>
                Based on selected weight and
                services
              </small>

            </div>

            <strong>
              ₱{formatCurrency(bookingTotal)}
            </strong>

          </div>

          {/* SECURITY */}

          <div className="secure-payment">

            <div className="secure-payment-icon">
              🔒
            </div>

            <div>

              <strong>
                Secure Payment
              </strong>

              <p>
                Your payment information is
                protected.
              </p>

            </div>

          </div>

        </aside>

      </div>


      {/* =====================================
          PAYMENT HISTORY
      ===================================== */}

      <section className="payment-history">

        <div className="history-header">

          <div>

            <span className="section-kicker">
              TRANSACTIONS
            </span>

            <h2>
              Payment History
            </h2>

            <p>
              View your previous laundry
              transactions.
            </p>

          </div>

          <div className="history-stats">

            <div>

              <span>
                Total
              </span>

              <strong>
                ₱{formatCurrency(totalSpent)}
              </strong>

            </div>

            <div>

              <span>
                Paid
              </span>

              <strong>
                ₱{formatCurrency(paidAmount)}
              </strong>

            </div>

            <div>

              <span>
                Pending
              </span>

              <strong>
                ₱{formatCurrency(pendingAmount)}
              </strong>

            </div>

          </div>

        </div>

        <div className="payment-table-wrapper">

          <table className="payment-table">

            <thead>

              <tr>
                <th>
                  Transaction
                </th>

                <th>
                  Service
                </th>

                <th>
                  Date
                </th>

                <th>
                  Method
                </th>

                <th>
                  Amount
                </th>

                <th>
                  Status
                </th>
              </tr>

            </thead>

            <tbody>

              {payments.length === 0 ? (

                <tr>

                  <td
                    colSpan="6"
                    className="empty-history"
                  >

                    <div>

                      <span>
                        💳
                      </span>

                      <strong>
                        No payment transactions yet
                      </strong>

                      <p>
                        Your completed payments will
                        appear here.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                payments.map((payment) => (

                  <tr key={payment.id}>

                    <td>

                      <div className="transaction-cell">

                        <strong>
                          {payment.id}
                        </strong>

                        <span>
                          {payment.booking}
                        </span>

                      </div>

                    </td>

                    <td>
                      {payment.service}
                    </td>

                    <td>
                      {payment.date}
                    </td>

                    <td>

                      <span className="method-label">

                        {payment.method === "Cash"
                          ? "₱ Cash"
                          : "GCash"}

                      </span>

                    </td>

                    <td>

                      <strong className="table-amount">
                        ₱{formatCurrency(payment.amount)}
                      </strong>

                    </td>

                    <td>

                      <span
                        className={
                          payment.status === "Paid"
                            ? "payment-status paid"
                            : "payment-status pending"
                        }
                      >
                        ● {payment.status}
                      </span>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </section>

      {/* =====================================
          PAYMENT CONFIRMATION MODAL
      ===================================== */}

      {showPaymentSummary && (

        <div
          className="payment-modal-overlay"
          onClick={handleDone}
        >

          <div
            className="payment-summary-modal"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="payment-summary-icon">
              ✓
            </div>

            <span className="payment-success-label">
              PAYMENT SUBMITTED
            </span>

            <h2>
              Payment Received
            </h2>

            <p className="payment-summary-subtitle">
              Your payment has been submitted and
              is waiting for verification.
            </p>

            <div className="payment-pending-banner">

              <span className="pending-dot">
                ●
              </span>

              <div>

                <strong>
                  Payment Pending
                </strong>

                <small>
                  The laundry shop will verify your
                  payment.
                </small>

              </div>

            </div>

            <div className="confirmation-details">

              <div className="confirmation-row">

                <span>
                  Booking ID
                </span>

                <strong>
                  {booking.id}
                </strong>

              </div>

              <div className="confirmation-row">

                <span>
                  Payment Method
                </span>

                <strong>
                  {paymentMethod}
                </strong>

              </div>

              {paymentMethod === "GCash" && (

                <div className="confirmation-row">

                  <span>
                    Reference Number
                  </span>

                  <strong className="reference-value">
                    {submittedReference || "Submitted"}
                  </strong>

                </div>

              )}

              <div className="confirmation-row">

                <span>
                  Services
                </span>

                <strong className="confirmation-long-text">
                  {services.length > 0
                    ? services.join(", ")
                    : "Laundry Service"}
                </strong>

              </div>

              <div className="confirmation-row">

                <span>
                  Laundry
                </span>

                <strong>
                  ₱{formatCurrency(displayedLaundryTotal)}
                </strong>

              </div>

              <div className="confirmation-row">

                <span>
                  Pickup / Delivery
                </span>

                <strong>
                  ₱{formatCurrency(deliveryFee)}
                </strong>

              </div>

              <div className="confirmation-total">

                <span>
                  Total Amount
                </span>

                <strong>
                  ₱{formatCurrency(bookingTotal)}
                </strong>

              </div>

            </div>

            <button
              type="button"
              className="payment-done-btn"
              onClick={handleDone}
            >
              Done
            </button>

            <p className="payment-modal-note">
              You can check your payment status in
              Payment History.
            </p>

          </div>

        </div>

      )}

    </div>
  );
}

export default Payment;