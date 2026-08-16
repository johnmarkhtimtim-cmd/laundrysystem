import { useState } from "react";
import "../../styles/Payments.css";

function Payment() {
  const [paymentMethod, setPaymentMethod] = useState("Online Payment");

  const [booking] = useState({
    id: "LM-2026-001",
    service: "Wash & Fold",
    date: "August 16, 2026",
    weight: "5 kg",
    amount: 400,
  });

  const [payments] = useState([
    {
      id: "PAY-001",
      booking: "LM-2026-001",
      service: "Wash & Fold",
      date: "August 16, 2026",
      amount: "₱400",
      method: "Online Payment",
      status: "Paid",
    },
    {
      id: "PAY-002",
      booking: "LM-2026-002",
      service: "Bedding Care",
      date: "August 14, 2026",
      amount: "₱600",
      method: "Cash",
      status: "Paid",
    },
    {
      id: "PAY-003",
      booking: "LM-2026-003",
      service: "Dry Cleaning",
      date: "August 18, 2026",
      amount: "₱300",
      method: "Cash",
      status: "Pending",
    },
  ]);

  const handlePayment = (e) => {
    e.preventDefault();

    if (paymentMethod === "Online Payment") {
      alert("Proceeding to online payment...");
    } else {
      alert(
        "Cash payment selected. Please pay upon pickup or delivery."
      );
    }
  };

  return (
    <div className="payment-page">

      {/* HEADER */}
      <div className="payment-page-header">

        <div>
          <p className="payment-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            Payments
          </h1>

          <p>
            Manage your laundry payments securely and conveniently.
          </p>
        </div>

        <div className="payment-header-icon">
          ₱
        </div>

      </div>


      {/* PAYMENT STATISTICS */}
      <div className="payment-stat-grid">

        <div className="payment-stat-card">

          <div className="payment-stat-icon blue">
            ₱
          </div>

          <div>
            <span>
              Total Spent
            </span>

            <strong>
              ₱1,300
            </strong>
          </div>

        </div>


        <div className="payment-stat-card">

          <div className="payment-stat-icon green">
            ✓
          </div>

          <div>
            <span>
              Paid
            </span>

            <strong>
              ₱1,000
            </strong>
          </div>

        </div>


        <div className="payment-stat-card">

          <div className="payment-stat-icon orange">
            ◷
          </div>

          <div>
            <span>
              Pending
            </span>

            <strong>
              ₱300
            </strong>
          </div>

        </div>


        <div className="payment-stat-card">

          <div className="payment-stat-icon purple">
            #
          </div>

          <div>
            <span>
              Transactions
            </span>

            <strong>
              3
            </strong>
          </div>

        </div>

      </div>


      {/* MAIN PAYMENT AREA */}
      <div className="payment-main-grid">

        {/* PAYMENT FORM */}
        <div className="payment-card">

          <div className="payment-card-header">

            <div>
              <h2>
                Make a Payment
              </h2>

              <p>
                Complete your current laundry payment.
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
                {booking.service}
              </strong>

              <small>
                {booking.date} • {booking.weight}
              </small>

            </div>

            <strong className="booking-price">
              ₱{booking.amount.toLocaleString()}
            </strong>

          </div>


          {/* PAYMENT METHOD */}
          <div className="payment-section">

            <h3>
              Payment Method
            </h3>

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
                  <strong>
                    Online Payment
                  </strong>

                  <span>
                    Pay using card or e-wallet
                  </span>
                </div>

                <div className="method-radio">
                  {paymentMethod === "Online Payment" && "✓"}
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


          {/* ONLINE PAYMENT DETAILS */}
          {paymentMethod === "Online Payment" && (

            <div className="online-payment-box">

              <div className="online-payment-header">

                <div>
                  <strong>
                    Online Payment
                  </strong>

                  <span>
                    Secure payment processing
                  </span>
                </div>

                <div className="payment-logos">
                  VISA
                  <span>GCash</span>
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


          {/* CASH INFORMATION */}
          {paymentMethod === "Cash" && (

            <div className="cash-payment-box">

              <div className="cash-icon">
                💵
              </div>

              <div>
                <strong>
                  Cash Payment
                </strong>

                <p>
                  Please prepare the exact amount of
                  <strong> ₱{booking.amount}</strong>.
                  Payment can be made when your laundry
                  is picked up or delivered.
                </p>
              </div>

            </div>

          )}


          {/* PAY BUTTON */}
          <button
            className="pay-button"
            onClick={handlePayment}
          >

            {paymentMethod === "Online Payment"
              ? "Pay ₱400 Now"
              : "Confirm Cash Payment"}

            <span>
              →
            </span>

          </button>

        </div>


        {/* PAYMENT SUMMARY */}
        <aside className="payment-summary">

          <div className="summary-title">

            <h2>
              Payment Summary
            </h2>

            <span>
              Current
            </span>

          </div>


          <div className="summary-service">

            <div className="summary-service-icon">
              🧺
            </div>

            <div>
              <span>
                Service
              </span>

              <strong>
                {booking.service}
              </strong>
            </div>

          </div>


          <div className="summary-items">

            <div>
              <span>
                Booking ID
              </span>

              <strong>
                {booking.id}
              </strong>
            </div>


            <div>
              <span>
                Laundry Weight
              </span>

              <strong>
                {booking.weight}
              </strong>
            </div>


            <div>
              <span>
                Service Fee
              </span>

              <strong>
                ₱{booking.amount}
              </strong>
            </div>

          </div>


          <div className="summary-total">

            <span>
              Total Amount
            </span>

            <strong>
              ₱{booking.amount.toLocaleString()}
            </strong>

          </div>


          <div className="secure-payment">

            <span>
              🔒
            </span>

            <div>
              <strong>
                Secure Payment
              </strong>

              <p>
                Your payment information is protected.
              </p>
            </div>

          </div>

        </aside>

      </div>


      {/* PAYMENT HISTORY */}
      <section className="payment-history">

        <div className="history-header">

          <div>
            <h2>
              Payment History
            </h2>

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

              {payments.map((payment) => (

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
                      {payment.amount}
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

              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default Payment;