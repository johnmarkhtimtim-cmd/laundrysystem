import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { subscribeToCustomerPayments } from "../../services/paymentService";
import {
  formatBookingIdLabel,
  getBookingId as resolveBookingId,
} from "../../utils/bookingId";
import "../../styles/Transactions.css";

function Transactions() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(Boolean(user?.uid));
  const [loadError, setLoadError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // =========================================================
  // LIVE AUTO-FETCH TRANSACTIONS
  // =========================================================

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    const unsubscribe = subscribeToCustomerPayments(
      user.uid,
      (payments) => {
        setTransactions(payments);
        setLoadError("");
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load transactions:", error);
        setTransactions([]);
        setLoadError("Unable to load your transactions. Please try again later.");
        setLoading(false);
      }
    );

    const nudgeRefresh = () => {
      // Snapshot listener already streams updates; keep same-tab events in sync.
      setLoading((current) => current);
    };

    window.addEventListener("laundrymateBookingUpdated", nudgeRefresh);
    window.addEventListener("laundrymatePaymentUpdated", nudgeRefresh);

    return () => {
      unsubscribe?.();
      window.removeEventListener("laundrymateBookingUpdated", nudgeRefresh);
      window.removeEventListener("laundrymatePaymentUpdated", nudgeRefresh);
    };
  }, [user?.uid]);

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

    const parsed =
      typeof date.toDate === "function" ? date.toDate() : new Date(date);

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
  // GET PAYMENT ID
  // =========================================================

  const getPaymentId = (transaction) => {
    return (
      transaction.paymentId ||
      transaction.payment_id ||
      transaction.id ||
      "—"
    );
  };

  // =========================================================
  // GET BOOKING ID (same short label as My Bookings / rider)
  // =========================================================

  const getBookingId = (transaction) => {
    const label = formatBookingIdLabel(transaction);
    return label === "N/A" ? "—" : label;
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
      transaction.total_amount ??
      transaction.amount ??
      0
    );
  };

  // =========================================================
  // FILTERS
  // =========================================================

  const getTransactionDate = (transaction) => {
    const raw =
      transaction.createdAt ||
      transaction.created_at ||
      transaction.payment_date;

    if (!raw) return null;

    const parsed = typeof raw.toDate === "function" ? raw.toDate() : new Date(raw);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const filteredTransactions = transactions.filter((transaction) => {
    if (!dateFrom && !dateTo) return true;

    const date = getTransactionDate(transaction);
    if (!date) return false;

    if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && date > new Date(`${dateTo}T23:59:59.999`)) return false;

    return true;
  });

  const hasActiveFilters = dateFrom || dateTo;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
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
      {loadError && <p role="alert">{loadError}</p>}
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
            {filteredTransactions.length}{" "}
            {filteredTransactions.length === 1
              ? "Transaction"
              : "Transactions"}
          </div>

        </div>

        {transactions.length > 0 && (
          <div className="transaction-filters">

            <div className="transaction-filter-field">
              <label htmlFor="filter-from">From</label>
              <input
                id="filter-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="transaction-filter-field">
              <label htmlFor="filter-to">To</label>
              <input
                id="filter-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="transaction-filter-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}

          </div>
        )}

        {filteredTransactions.length === 0 ? (

          /* =================================================
             EMPTY STATE
             ================================================= */

          <div className="transactions-empty">

            <div className="empty-transaction-icon">
              💳
            </div>

            <h3>
              {transactions.length === 0
                ? "No Transactions Yet"
                : "No Matching Transactions"}
            </h3>

            <p>
              {transactions.length === 0
                ? "Your payment transactions will automatically appear here after you make a payment."
                : "No transactions match the selected date range."}
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

                {filteredTransactions.map(
                  (transaction) => {

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

                            {                            (transaction.referenceNumber ||
                              transaction.reference_number) && (
                              <small>
                                Ref:{" "}
                                {transaction.referenceNumber ||
                                  transaction.reference_number}
                              </small>
                            )}

                          </div>

                        </td>

                        {/* BOOKING */}

                        <td>

                          <span
                            className="transaction-booking-id"
                            title={`#${resolveBookingId(transaction)}`}
                          >
                            {getBookingId(transaction)}
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
                              transaction.createdAt ||
                                transaction.created_at
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
                                transaction.payment_method ||
                                ""
                            ).toLowerCase()}`}
                          >
                            {transaction.paymentMethod ||
                              transaction.payment_method ||
                              "—"}
                          </span>

                        </td>

                        <td>
                          <span
                            className={`transaction-status ${String(
                              transaction.paymentStatus ||
                                transaction.payment_status ||
                                "Pending"
                            ).toLowerCase()}`}
                          >
                            {transaction.paymentStatus ||
                              transaction.payment_status ||
                              "Pending"}
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