import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getBooking } from "../services/bookingService";
import {
  formatCurrency,
  formatDate,
  formatShortBookingId,
  getBookingDisplayStatus,
  getContactNumber,
  getCustomerName,
  getPickupLocation,
  getPickupOption,
  getServices,
  getWeight,
} from "../pages/Staff/bookingHelpers";

export default function PaymentReceiptModal({
  payment,
  onClose,
  onMarkPaid,
  onReject,
  actionLoading = false,
}) {
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  const bookingId = payment?.booking_id || payment?.bookingId || "";

  useEffect(() => {
    if (!payment || !bookingId) return undefined;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadingBooking(true);
      setBooking(null);
    });

    getBooking(bookingId)
      .then((docData) => {
        if (!cancelled) {
          setBooking(docData || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBooking(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBooking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payment, bookingId]);

  useEffect(() => {
    if (!payment) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [payment, onClose]);

  if (!payment) return null;

  const shortBookingId = formatShortBookingId(bookingId || payment.id || "N/A");
  const customerName =
    payment.customer?.name ||
    payment.customer_name ||
    (booking ? getCustomerName(booking) : "") ||
    "Unknown Customer";
  const gcashAccountName = payment.gcash_customer_name || "—";
  const referenceNumber = payment.reference_number || "—";
  const contactNumber = booking ? getContactNumber(booking) : "—";
  const servicesLabel =
    payment.services || (booking ? getServices(booking) : "—");
  const pickupOption = booking ? getPickupOption(booking) : "—";
  const pickupAddress = booking ? getPickupLocation(booking) : "—";
  const weightValue = booking ? getWeight(booking) : "";
  const bookingStatus = booking ? getBookingDisplayStatus(booking) : "—";
  const paymentStatus = payment.payment_status || "Pending";
  const isPaid = paymentStatus === "Paid";
  const isRejected = paymentStatus === "Rejected";

  return (
    <div
      className="receipt-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="receipt-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
      >
        <div className="receipt-modal-header">
          <div>
            <span className="receipt-modal-eyebrow">
              GCash Payment &amp; Customer Details
            </span>
            <h2 id="receipt-modal-title">Booking #{shortBookingId}</h2>
          </div>

          <button
            type="button"
            className="receipt-modal-close"
            onClick={onClose}
            aria-label="Close receipt modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="receipt-modal-body">
          <div className="receipt-details-column">
            <h3 className="receipt-section-title">Customer &amp; Booking Info</h3>

            <div className="receipt-info-grid">
              <div className="receipt-info-item">
                <span>Customer Name</span>
                <strong>{customerName}</strong>
              </div>

              <div className="receipt-info-item">
                <span>Contact Number</span>
                <strong>
                  {loadingBooking ? "Loading..." : contactNumber}
                </strong>
              </div>

              <div className="receipt-info-item">
                <span>GCash Account Name</span>
                <strong>{gcashAccountName}</strong>
              </div>

              <div className="receipt-info-item">
                <span>Reference Number</span>
                <strong className="receipt-ref-code">{referenceNumber}</strong>
              </div>

              <div className="receipt-info-item">
                <span>Amount Submitted</span>
                <strong className="receipt-amount-highlight">
                  {formatCurrency(payment.amount ?? payment.total_amount ?? 0)}
                </strong>
              </div>

              <div className="receipt-info-item">
                <span>Payment Status</span>
                <strong>
                  <span
                    className={`status-badge ${
                      isPaid ? "paid" : isRejected ? "rejected" : "pending"
                    }`}
                  >
                    {paymentStatus}
                  </span>
                </strong>
              </div>

              <div className="receipt-info-item">
                <span>Services</span>
                <strong>{servicesLabel}</strong>
              </div>

              <div className="receipt-info-item">
                <span>Pickup Option</span>
                <strong>{loadingBooking ? "Loading..." : pickupOption}</strong>
              </div>

              {weightValue !== "" && weightValue !== null && (
                <div className="receipt-info-item">
                  <span>Laundry Weight</span>
                  <strong>{weightValue} kg</strong>
                </div>
              )}

              {booking && (
                <div className="receipt-info-item">
                  <span>Booking Status</span>
                  <strong>{bookingStatus}</strong>
                </div>
              )}

              <div className="receipt-info-item">
                <span>Date Submitted</span>
                <strong>
                  {formatDate(payment.payment_date || payment.created_at)}
                </strong>
              </div>

              <div className="receipt-info-item full-width">
                <span>Pickup Address</span>
                <strong>
                  {loadingBooking ? "Loading..." : pickupAddress}
                </strong>
              </div>
            </div>
          </div>

          <div className="receipt-preview-column">
            <h3 className="receipt-section-title">Uploaded GCash Receipt</h3>
            {payment.receipt_url ? (
              <div className="receipt-image-frame">
                <img
                  src={payment.receipt_url}
                  alt={`GCash receipt for booking #${shortBookingId}`}
                  className="receipt-preview-img"
                />
              </div>
            ) : (
              <div className="receipt-empty-box">
                No receipt screenshot uploaded.
              </div>
            )}
          </div>
        </div>

        <div className="receipt-modal-footer">
          <div className="receipt-modal-actions">
            {onMarkPaid && !isPaid && (
              <button
                type="button"
                className="btn btn-small btn-success"
                disabled={actionLoading}
                onClick={() => {
                  onClose?.();
                  onMarkPaid(payment);
                }}
              >
                Mark Paid
              </button>
            )}

            {onReject && !isPaid && !isRejected && (
              <button
                type="button"
                className="btn btn-small btn-danger"
                disabled={actionLoading}
                onClick={() => {
                  onClose?.();
                  onReject(payment);
                }}
              >
                Reject
              </button>
            )}
          </div>

          <button
            type="button"
            className="receipt-close-footer-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
