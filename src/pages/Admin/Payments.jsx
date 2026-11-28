import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Wallet } from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import Summary from "../../components/admin/Summary";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import PaymentReceiptModal from "../../components/PaymentReceiptModal";
import {
  subscribeToAllPayments,
  updatePaymentStatus,
} from "../../services/paymentService";
import "../../styles/StaffPayments.css";

function formatCurrency(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToAllPayments(
      (list) => {
        setPayments(list);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        console.error("Admin payments load failed:", loadError);
        setError("Unable to load live payments.");
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesStatus =
        filterStatus === "All" || payment.payment_status === filterStatus;
      const haystack = [
        payment.booking_id,
        payment.customer_name,
        payment.customer?.name,
        payment.reference_number,
        payment.services,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        !searchTerm || haystack.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [payments, filterStatus, searchTerm]);

  const summaryItems = useMemo(() => {
    const paid = payments
      .filter((p) => p.payment_status === "Paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pending = payments
      .filter((p) => p.payment_status === "Pending")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const rejected = payments
      .filter((p) => p.payment_status === "Rejected")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return [
      [<Wallet key="rev" size={18} />, "Total Revenue", formatCurrency(paid)],
      [<CheckCircle2 key="paid" size={18} />, "Paid", formatCurrency(paid)],
      [<CreditCard key="pending" size={18} />, "Pending", formatCurrency(pending)],
      [<Wallet key="rejected" size={18} />, "Rejected", formatCurrency(rejected)],
    ];
  }, [payments]);

  const requestStatusChange = (payment, nextStatus) => {
    if (payment.payment_status === nextStatus) return;

    const bookingLabel = `#${payment.booking_id?.slice(-6) || "N/A"}`;
    const customerName =
      payment.customer_name || payment.customer?.name || "Unknown";

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
        { label: "Amount", value: formatCurrency(payment.amount) },
      ],
    });
  };

  const closeConfirmAction = () => {
    if (actionLoading) return;
    setConfirmAction(null);
  };

  const confirmStatusChange = async () => {
    if (!confirmAction) return;

    const { paymentId, nextStatus } = confirmAction;
    setActionLoading(paymentId);
    try {
      await updatePaymentStatus(paymentId, nextStatus);
      setConfirmAction(null);
    } catch (err) {
      console.error(err);
      alert("Could not update payment status.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Live GCash and cash payments from customers."
      />
      <Summary items={summaryItems} />

      <section className="portal-card staff-payments-page" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-message">Loading payments...</div>
        ) : (
          <div style={{ padding: 24 }}>
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
                  <option value="Unpaid">Unpaid (Cash)</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="filter-group">
                <input
                  type="search"
                  className="filter-input"
                  placeholder="Search customer, booking, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Customer</th>
                    <th>Services</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>GCash</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length ? (
                    filteredPayments.map((payment) => {
                      const isPaid = payment.payment_status === "Paid";
                      const isRejected = payment.payment_status === "Rejected";
                      return (
                        <tr key={payment.id}>
                          <td>
                            <strong>
                              #{payment.booking_id?.slice(-6) || "N/A"}
                            </strong>
                          </td>
                          <td>
                            {payment.customer_name ||
                              payment.customer?.name ||
                              "Unknown"}
                          </td>
                          <td>{payment.services || "—"}</td>
                          <td className="amount">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td>
                            <span
                              className={`method-badge ${
                                payment.payment_method === "GCash"
                                  ? "online"
                                  : "cash"
                              }`}
                            >
                              {payment.payment_method || "Cash"}
                            </span>
                          </td>
                          <td>
                            {payment.payment_method === "GCash" ? (
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
                              <span className="muted-cell">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${
                                isPaid
                                  ? "paid"
                                  : isRejected
                                    ? "rejected"
                                    : payment.payment_status === "Unpaid"
                                      ? "unpaid"
                                      : "pending"
                              }`}
                            >
                              {payment.payment_status || "Pending"}
                            </span>
                          </td>
                          <td>
                            {formatDate(
                              payment.payment_date || payment.created_at
                            )}
                          </td>
                          <td>
                            <div className="payment-actions">
                              <button
                                type="button"
                                className={`btn btn-small ${
                                  isPaid ? "btn-disabled" : "btn-success"
                                }`}
                                disabled={actionLoading === payment.id || isPaid}
                                onClick={() =>
                                  requestStatusChange(payment, "Paid")
                                }
                              >
                                {isPaid ? "Paid" : "Mark Paid"}
                              </button>
                              {!isPaid && (
                                <button
                                  type="button"
                                  className={`btn btn-small ${
                                    isRejected ? "btn-disabled" : "btn-danger"
                                  }`}
                                  disabled={
                                    actionLoading === payment.id || isRejected
                                  }
                                  onClick={() =>
                                    requestStatusChange(payment, "Rejected")
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
                      <td colSpan="9" className="empty-message">
                        No payments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <PaymentReceiptModal
        payment={selectedReceiptPayment}
        onClose={() => setSelectedReceiptPayment(null)}
        onMarkPaid={(p) => requestStatusChange(p, "Paid")}
        onReject={(p) => requestStatusChange(p, "Rejected")}
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
        onConfirm={confirmStatusChange}
      />
    </>
  );
}
