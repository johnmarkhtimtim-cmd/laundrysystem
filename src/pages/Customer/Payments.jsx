import { useEffect, useState } from "react";
import "../../styles/Payments.css";

function Payment() {
  const [paymentMethod, setPaymentMethod] = useState("Online Payment");
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);

  // =====================================
  // LOAD BOOKINGS + PAYMENTS AUTOMATICALLY
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

        // Latest booking
        if (savedBookings.length > 0) {
          const latestBooking =
            savedBookings[savedBookings.length - 1];

          setBooking(latestBooking);
        }

        // Convert saved payment records to history format
        const paymentHistory = savedPayments.map((payment) => ({
          id: `PAY-${payment.bookingId}`,
          booking: payment.bookingId,

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
              : "Online Payment",

          status:
            payment.paymentStatus === "Paid"
              ? "Paid"
              : "Pending",
        }));

        setPayments(paymentHistory);
      } catch (error) {
        console.error("Unable to load payment data:", error);
      }
    };

    loadPaymentData();

    // Automatically refresh when another component updates localStorage
    window.addEventListener("storage", loadPaymentData);

    return () => {
      window.removeEventListener("storage", loadPaymentData);
    };
  }, []);

  // =====================================
  // PAYMENT STATISTICS
  // =====================================

  const totalSpent = payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  const paidAmount = payments
    .filter((payment) => payment.status === "Paid")
    .reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

  const pendingAmount = payments
    .filter((payment) => payment.status === "Pending")
    .reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

  // =====================================
  // CURRENT BOOKING VALUES
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

  // =====================================
  // PAYMENT
  // =====================================

  const handlePayment = (e) => {
    e.preventDefault();

    if (!booking) {
      alert("Please confirm a booking first.");
      return;
    }

    const amount = Number(booking.estimatedTotal || 0);

    if (paymentMethod === "Online Payment") {
      alert(
        `Proceeding to online payment for ₱${amount.toFixed(2)}...`
      );
    } else {
      alert(
        `Cash payment selected. Please prepare ₱${amount.toFixed(
          2
        )} upon pickup or delivery.`
      );
    }
  };

  // =====================================
  // NO BOOKING
  // =====================================

  if (!booking) {
    return (
      <div className="payment-page">

        <div className="payment-page-header">
          <div>
            <p className="payment-eyebrow">
              LAUNDRYMATE
            </p>

            <h1>Payments</h1>

            <p>
              Manage your laundry payments securely and
              conveniently.
            </p>
          </div>

          <div className="payment-header-icon">
            ₱
          </div>
        </div>

        <div className="payment-card">
          <div
            style={{
              padding: "50px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                marginBottom: "15px",
              }}
            >
              🧺
            </div>

            <h2>No Confirmed Booking</h2>

            <p>
              Confirm a laundry booking first to view your
              payment summary.
            </p>
          </div>
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

      <div className="payment-page-header">

        <div>
          <p className="payment-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>Payments</h1>

          <p>
            Manage your laundry payments securely and
            conveniently.
          </p>
        </div>

        <div className="payment-header-icon">
          ₱
        </div>

      </div>

      {/* =====================================
          PAYMENT STATISTICS
      ===================================== */}

      <div className="payment-stat-grid">

        <div className="payment-stat-card">
          <div className="payment-stat-icon blue">
            ₱
          </div>

          <div>
            <span>Total Spent</span>

            <strong>
              ₱{totalSpent.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="payment-stat-card">
          <div className="payment-stat-icon green">
            ✓
          </div>

          <div>
            <span>Paid</span>

            <strong>
              ₱{paidAmount.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="payment-stat-card">
          <div className="payment-stat-icon orange">
            ◷
          </div>

          <div>
            <span>Pending</span>

            <strong>
              ₱{pendingAmount.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="payment-stat-card">
          <div className="payment-stat-icon purple">
            #
          </div>

          <div>
            <span>Transactions</span>

            <strong>
              {payments.length}
            </strong>
          </div>
        </div>

      </div>

      {/* =====================================
          MAIN PAYMENT AREA
      ===================================== */}

      <div className="payment-main-grid">

        {/* =====================================
            PAYMENT FORM
        ===================================== */}

        <div className="payment-card">

          <div className="payment-card-header">

            <div>
              <h2>Make a Payment</h2>

              <p>
                Complete your current laundry payment.
              </p>
            </div>

            <span className="secure-badge">
              🔒 Secure
            </span>

          </div>

          {/* CURRENT BOOKING */}

          <div className="payment-booking">

            <div className="payment-booking-icon">
              🧺
            </div>

            <div className="payment-booking-info">

              <span>
                Booking #{booking.id}
              </span>

              <strong>
                {services.join(", ")}
              </strong>

              <small>
                {booking.schedule} • {booking.time} •{" "}
                {booking.weight} kg
              </small>

            </div>

            <strong className="booking-price">
              ₱{bookingTotal.toLocaleString()}
            </strong>

          </div>

          {/* =====================================
              PAYMENT METHOD
          ===================================== */}

          <div className="payment-section">

            <h3>Payment Method</h3>

            <p>
              Choose how you want to pay.
            </p>

            <div className="payment-methods">

              {/* ONLINE */}

              <button
                type="button"
                className={
                  paymentMethod === "Online Payment"
                    ? "payment-method selected"
                    : "payment-method"
                }
                onClick={() =>
                  setPaymentMethod("Online Payment")
                }
              >
                <div className="method-icon online">
                  💳
                </div>

                <div>
                  <strong>Online Payment</strong>

                  <span>
                    Pay using card or e-wallet
                  </span>
                </div>

                <div className="method-radio">
                  {paymentMethod === "Online Payment" &&
                    "✓"}
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
                onClick={() =>
                  setPaymentMethod("Cash")
                }
              >
                <div className="method-icon cash">
                  💵
                </div>

                <div>
                  <strong>Cash</strong>

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
              ONLINE PAYMENT
          ===================================== */}

          {paymentMethod === "Online Payment" && (
            <div className="online-payment-box">

              <div className="online-payment-header">

                <div>
                  <strong>Online Payment</strong>

                  <span>
                    Secure payment processing
                  </span>
                </div>

                <div className="payment-logos">
                  VISA <span>GCash</span>
                </div>

              </div>

              <div className="card-input">

                <label>
                  Card / Account Number
                </label>

                <input
                  type="text"
                  placeholder="Enter card or account number"
                />

              </div>

              <div className="payment-form-row">

                <div className="card-input">

                  <label>
                    Expiry Date
                  </label>

                  <input
                    type="text"
                    placeholder="MM / YY"
                  />

                </div>

                <div className="card-input">

                  <label>
                    Security Code
                  </label>

                  <input
                    type="password"
                    placeholder="•••"
                  />

                </div>

              </div>

            </div>
          )}

          {/* =====================================
              CASH
          ===================================== */}

          {paymentMethod === "Cash" && (
            <div className="cash-payment-box">

              <div className="cash-icon">
                💵
              </div>

              <div>

                <strong>Cash Payment</strong>

                <p>
                  Please prepare the exact amount of{" "}
                  <strong>
                    ₱{bookingTotal.toFixed(2)}
                  </strong>
                  . Payment can be made when your laundry
                  is picked up or delivered.
                </p>

              </div>

            </div>
          )}

          {/* =====================================
              PAY BUTTON
          ===================================== */}

          <button
            type="button"
            className="pay-button"
            onClick={handlePayment}
          >
            {paymentMethod === "Online Payment"
              ? `Pay ₱${bookingTotal.toLocaleString()} Now`
              : "Confirm Cash Payment"}

            <span>→</span>
          </button>

        </div>

        {/* =====================================
            AUTOMATIC PAYMENT SUMMARY
        ===================================== */}

        <aside className="payment-summary">

          <div className="summary-title">

            <h2>Payment Summary</h2>

            <span>Current</span>

          </div>

          {/* SERVICES */}

          <div className="summary-service">

            <div className="summary-service-icon">
              🧺
            </div>

            <div>

              <span>Services</span>

              <strong>
                {services.join(", ")}
              </strong>

            </div>

          </div>

          {/* SUMMARY ITEMS */}

          <div className="summary-items">

            <div>
              <span>Booking ID</span>
              <strong>{booking.id}</strong>
            </div>

            <div>
              <span>Laundry Weight</span>

              <strong>
                {booking.weight} kg
              </strong>
            </div>

            <div>
              <span>Laundry Subtotal</span>

              <strong>
                ₱{laundrySubtotal.toFixed(2)}
              </strong>
            </div>

            <div>
              <span>
                {booking.pickupType ===
                "Pickup & Delivery"
                  ? "Pickup & Delivery Fee"
                  : "Pickup Fee"}
              </span>

              <strong>
                ₱{deliveryFee.toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Pickup Date</span>

              <strong>
                {booking.schedule}
              </strong>
            </div>

            <div>
              <span>Pickup Time</span>

              <strong>
                {booking.time}
              </strong>
            </div>

            <div>
              <span>Payment Status</span>

              <strong className="pending-text">
                Pending
              </strong>
            </div>

          </div>

          {/* TOTAL */}

          <div className="summary-total">

            <span>Total Amount</span>

            <strong>
              ₱{bookingTotal.toFixed(2)}
            </strong>

          </div>

          <div className="secure-payment">

            <span>🔒</span>

            <div>

              <strong>Secure Payment</strong>

              <p>
                Your payment information is protected.
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
            <h2>Payment History</h2>

            <p>
              View your previous laundry transactions.
            </p>
          </div>

          <button
            type="button"
            className="history-filter"
          >
            All Payments ▾
          </button>

        </div>

        <div className="payment-table-wrapper">

          <table className="payment-table">

            <thead>
              <tr>
                <th>Transaction</th>
                <th>Service</th>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              {payments.length === 0 ? (

                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    No payment transactions yet.
                  </td>
                </tr>

              ) : (

                payments.map((payment) => (

                  <tr key={payment.id}>

                    <td>
                      <strong>
                        {payment.id}
                      </strong>

                      <span>
                        {payment.booking}
                      </span>
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
                          ? "💵 Cash"
                          : "💳 Online"}
                      </span>

                    </td>

                    <td>

                      <strong className="table-amount">
                        ₱{Number(
                          payment.amount
                        ).toLocaleString()}
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

    </div>
  );
}

export default Payment;