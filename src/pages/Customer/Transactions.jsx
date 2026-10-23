import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Transactions.css";

function Transactions() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // LOAD TRANSACTIONS
  // =========================================================

  const loadTransactions = () => {
    try {
      const storedPayments = JSON.parse(
        localStorage.getItem("laundrymatePayments") || "[]"
      );

      let userPayments = storedPayments;

      // Show only current customer's transactions
      if (user?.uid) {
        userPayments = storedPayments.filter(
          (payment) =>
            !payment.userId ||
            payment.userId === user.uid
        );
      }

      // Latest transaction first
      const sortedTransactions = [...userPayments].sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      setTransactions(sortedTransactions);
    } catch (error) {
      console.error(
        "Failed to load transactions:",
        error
      );

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD ON PAGE OPEN
  // =========================================================

  useEffect(() => {
    loadTransactions();

    // Payment updated
    window.addEventListener(
      "laundrymatePaymentUpdated",
      loadTransactions
    );

    // Booking updated
    window.addEventListener(
      "laundrymateBookingUpdated",
      loadTransactions
    );

    return () => {
      window.removeEventListener(
        "laundrymatePaymentUpdated",
        loadTransactions
      );

      window.removeEventListener(
        "laundrymateBookingUpdated",
        loadTransactions
      );
    };
  }, [user]);

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (amount) => {
    return `₱${Number(amount || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
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

    return parsed.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // =========================================================
  // GET STATUS
  // =========================================================

  const getStatus = (transaction) => {
    return (
      transaction.paymentStatus ||
      transaction.status ||
      "Pending"
    );
  };

  // =========================================================
  // GET STATUS CLASS
  // =========================================================

  const getStatusClass = (transaction) => {
    return String(
      getStatus(transaction)
    ).toLowerCase();
  };

  // =========================================================
  // GET PAYMENT ID
  // =========================================================

  const getPaymentId = (transaction) => {
    return (
      transaction.paymentId ||
      transaction.id ||
      "—"
    );
  };

  // =========================================================
  // GET BOOKING ID
  // =========================================================

  const getBookingId = (transaction) => {
    return (
      transaction.bookingId ||
      transaction.booking?.id ||
      "—"
    );
  };

  // =========================================================
  // GET SERVICE
  // =========================================================

  const getServices = (transaction) => {
    return (
      transaction.services ||
      transaction.booking?.services ||
      "Laundry Service"
    );
  };

  // =========================================================
  // GET AMOUNT
  // =========================================================

  const getAmount = (transaction) => {
    return (
      transaction.totalAmount ??
      transaction.amount ??
      0
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="transactions-page">

        <div className="transactions-header">
          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>Transactions</h1>

          <p>
            View your payment transaction history.
          </p>
        </div>

        <div className="transactions-loading">
          <span className="transaction-spinner" />

          <p>
            Loading transactions...
          </p>
        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN
  // =========================================================

  return (
    <div className="transactions-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="transactions-header">

        <div>
          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>
            Transactions
          </h1>

          <p>
            View and monitor your payment
            transaction history.
          </p>
        </div>

        <div className="transaction-total-count">
          <span>
            Transactions
          </span>

          <strong>
            {transactions.length}
          </strong>
        </div>

      </div>    
      {/* =====================================================
          TRANSACTION HISTORY
      ===================================================== */}

      <div className="transactions-card">

        <div className="transactions-card-header">

          <div>
            <span className="card-label">
              PAYMENT RECORDS
            </span>

            <h2>
              Transaction History
            </h2>

            <p>
              Your recent payment transactions
              are shown below.
            </p>
          </div>

          <div className="transaction-count">
            {transactions.length}{" "}
            {transactions.length === 1
              ? "Transaction"
              : "Transactions"}
          </div>

        </div>

        {transactions.length === 0 ? (

          /* =================================================
             EMPTY STATE
             ================================================= */

          <div className="transactions-empty">

            <div className="empty-transaction-icon">
              💳
            </div>

            <h3>
              No Transactions Yet
            </h3>

            <p>
              Your payment transactions will
              automatically appear here after
              you make a payment.
            </p>

          </div>

        ) : (

          /* =================================================
             TABLE
             ================================================= */

          <div className="transactions-table-wrapper">

            <table className="transactions-table">

              <thead>

                <tr>
                  <th>
                    Transaction
                  </th>

                  <th>
                    Booking ID
                  </th>

                  <th>
                    Service
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Method
                  </th>

                  <th>
                    Status
                  </th>
                </tr>

              </thead>

              <tbody>

                {transactions.map(
                  (transaction) => {

                    const status =
                      getStatus(transaction);

                    const statusClass =
                      getStatusClass(
                        transaction
                      );

                    return (
                      <tr
                        key={
                          transaction.id ||
                          transaction.paymentId
                        }
                      >

                        {/* TRANSACTION */}

                        <td>

                          <div className="transaction-id">

                            <strong>
                              {getPaymentId(
                                transaction
                              )}
                            </strong>

                            {transaction.referenceNumber && (
                              <small>
                                Ref:{" "}
                                {
                                  transaction.referenceNumber
                                }
                              </small>
                            )}

                          </div>

                        </td>

                        {/* BOOKING */}

                        <td>

                          <span className="transaction-booking-id">
                            {getBookingId(
                              transaction
                            )}
                          </span>

                        </td>

                        {/* SERVICE */}

                        <td>

                          <span className="transaction-service">
                            {getServices(
                              transaction
                            )}
                          </span>

                        </td>

                        {/* DATE */}

                        <td>

                          <span className="transaction-date">
                            {formatDate(
                              transaction.createdAt
                            )}
                          </span>

                        </td>

                        {/* AMOUNT */}

                        <td>

                          <strong className="transaction-amount">
                            {formatCurrency(
                              getAmount(
                                transaction
                              )
                            )}
                          </strong>

                        </td>

                        {/* METHOD */}

                        <td>

                          <span
                            className={`transaction-method ${String(
                              transaction.paymentMethod ||
                                ""
                            ).toLowerCase()}`}
                          >
                            {transaction.paymentMethod ||
                              "—"}
                          </span>

                        </td>

                        {/* STATUS */}

                        <td>

                          <span
                            className={`transaction-status ${statusClass}`}
                          >

                            <span className="transaction-status-dot" />

                            {status}

                          </span>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}

export default Transactions;