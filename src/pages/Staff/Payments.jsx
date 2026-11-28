import { useEffect, useState } from "react";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import PaymentReceiptModal from "../../components/PaymentReceiptModal";
import {
  subscribeToAllPayments,
  updatePaymentStatus,
} from "../../services/paymentService";
import "../../styles/StaffPayments.css";

function StaffPayments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToAllPayments(
      (paymentList) => {
        setPayments(paymentList);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        console.error("Error fetching payments:", loadError);
        setError("Unable to load payments. Please refresh and try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, []);

  const requestUpdatePaymentStatus = (payment, nextStatus) => {
    if (payment.payment_status === nextStatus) {
      alert(`Payment is already marked as ${nextStatus}.`);
      return;
    }

    const bookingLabel = `#${payment.booking_id?.slice(-6) || "N/A"}`;
    const customerName =
      payment.customer?.name || payment.customer_name || "Unknown";

    setConfirmAction({
      paymentId: payment.id,
      nextStatus,
      variant: nextStatus === "Paid" ? "success" : "danger",
      title:
        nextStatus === "Paid" ? "Mark payment as paid?" : "Reject this payment?",
      message:
        nextStatus === "Paid"
          ? "Confirm that this payment has been received. This cannot be easily undone."
          : "The customer will be asked to resubmit. Continue only if this payment is invalid.",
      confirmLabel: nextStatus === "Paid" ? "Mark Paid" : "Reject Payment",
      loadingLabel: nextStatus === "Paid" ? "Marking paid..." : "Rejecting...",
      meta: [
        { label: "Booking", value: bookingLabel },
        { label: "Customer", value: customerName },
        {
          label: "Amount",
          value: `₱${Number(payment.amount || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        },
      ],
    });
  };

  const closeConfirmAction = () => {
    if (actionLoading) return;
    setConfirmAction(null);
  };

  const confirmUpdatePaymentStatus = async () => {
    if (!confirmAction) return;

    const { paymentId, nextStatus } = confirmAction;
    setActionLoading(paymentId);
    try {
      await updatePaymentStatus(paymentId, nextStatus);
      setConfirmAction(null);
    } catch (updateError) {
      console.error("Error updating payment status:", updateError);
      alert("Error updating payment status. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesStatus =
      filterStatus === "All" || payment.payment_status === filterStatus;
    const haystack = [
      payment.booking_id,
      payment.customer?.name,
      payment.customer_name,
      payment.reference_number,
      payment.gcash_customer_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      searchTerm === "" || haystack.includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const methodClass = (method) => {
    if (method === "GCash") return "online";
    return "cash";
  };

  const statusClass = (status) => {
    if (status === "Paid") return "paid";
    if (status === "Rejected") return "rejected";
    return "pending";
  };

  return (
    <div className="staff-payments-page">
      <div className="page-header">
        <h1>Payments Management</h1>
        <p>Track and verify GCash references and cash payments</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading payments...</div>
      ) : (
        <>
          {error && <div className="payment-load-error">{error}</div>}

          <div className="payment-filters">
            <div className="filter-group">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="filter-group">
              <input
                type="search"
                placeholder="Search booking, customer, GCash name, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>

          <div className="payments-section">
            <h2>Payment Records</h2>
            <div className="table-wrapper">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>GCash Details</th>
                    <th>Status</th>
                    <th>Payment Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => {
                      const isPaid = payment.payment_status === "Paid";
                      const isRejected = payment.payment_status === "Rejected";
                      const isGCash = payment.payment_method === "GCash";

                      return (
                        <tr key={payment.id}>
                          <td>
                            <strong>
                              #{payment.booking_id?.slice(-6) || "N/A"}
                            </strong>
                          </td>
                          <td>
                            {payment.customer?.name ||
                              payment.customer_name ||
                              "Unknown"}
                          </td>
                          <td className="amount">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td>
                            <span
                              className={`method-badge ${methodClass(
                                payment.payment_method
                              )}`}
                            >
                              {payment.payment_method || "Cash"}
                            </span>
                          </td>
                          <td>
                            {isGCash ? (
                              <div className="gcash-verify-cell">
                                <strong>
                                  {payment.gcash_customer_name || "—"}
                                </strong>
                                <small>
                                  Ref: {payment.reference_number || "—"}
                                </small>
                                {payment.receipt_url ? (
                                  <button
                                    type="button"
                                    className="view-receipt-btn"
                                    onClick={() =>
                                      setSelectedReceiptPayment(payment)
                                    }
                                  >
                                    View receipt
                                  </button>
                                ) : (
                                  <small>No receipt uploaded</small>
                                )}
                              </div>
                            ) : (
                              <span className="muted-cell">Pay on pickup</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${statusClass(
                                payment.payment_status
                              )}`}
                            >
                              {payment.payment_status || "Pending"}
                            </span>
                          </td>
                          <td>
                            {isPaid ? formatDate(payment.payment_date) : "—"}
                          </td>
                          <td>
                            <div className="payment-actions">
                              <button
                                className={`btn btn-small ${
                                  isPaid ? "btn-disabled" : "btn-success"
                                }`}
                                onClick={() =>
                                  requestUpdatePaymentStatus(payment, "Paid")
                                }
                                disabled={
                                  actionLoading === payment.id || isPaid
                                }
                              >
                                {isPaid ? "Paid" : "Mark Paid"}
                              </button>
                              {!isPaid && (
                                <button
                                  className={`btn btn-small ${
                                    isRejected ? "btn-disabled" : "btn-danger"
                                  }`}
                                  onClick={() =>
                                    requestUpdatePaymentStatus(
                                      payment,
                                      "Rejected"
                                    )
                                  }
                                  disabled={
                                    actionLoading === payment.id || isRejected
                                  }
                                >
                                  {isRejected ? "Rejected" : "Reject"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="empty-message">
                        No payments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <PaymentReceiptModal
        payment={selectedReceiptPayment}
        onClose={() => setSelectedReceiptPayment(null)}
        onMarkPaid={(p) => requestUpdatePaymentStatus(p, "Paid")}
        onReject={(p) => requestUpdatePaymentStatus(p, "Rejected")}
        actionLoading={Boolean(actionLoading)}
      />

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        loading={Boolean(actionLoading)}
        variant={confirmAction?.variant || "danger"}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        loadingLabel={confirmAction?.loadingLabel}
        meta={confirmAction?.meta}
        onCancel={closeConfirmAction}
        onConfirm={confirmUpdatePaymentStatus}
      />
    </div>
  );
}

export default StaffPayments;
