/**
 * Shared booking ID helpers — keep Customer / Staff / Rider labels in sync.
 * Short label matches what riders and staff see (e.g. #2mkDRq).
 */

export function getBookingId(bookingOrId) {
  if (bookingOrId == null) return "N/A";

  if (typeof bookingOrId === "string" || typeof bookingOrId === "number") {
    const raw = String(bookingOrId).trim().replace(/^#/, "");
    return raw || "N/A";
  }

  // When given a payment/transaction or notification object (`booking_id` points
  // to the booking while `id` is the payment/notification document ID), prefer
  // the explicit booking reference first. On booking documents `booking_id`,
  // `bookingId`, and `id` are normalized to the same booking ID.
  const id =
    bookingOrId.booking_id ||
    bookingOrId.bookingId ||
    bookingOrId.bookingNo ||
    bookingOrId.bookingNumber ||
    bookingOrId.booking?.booking_id ||
    bookingOrId.booking?.bookingId ||
    bookingOrId.booking?.id ||
    bookingOrId.id;

  return id ? String(id).trim().replace(/^#/, "") : "N/A";
}

export function formatShortBookingId(bookingOrId) {
  const raw = getBookingId(bookingOrId);
  if (!raw || raw === "N/A") return "N/A";
  return raw.slice(-6);
}

export function formatBookingIdLabel(bookingOrId) {
  const shortId = formatShortBookingId(bookingOrId);
  return shortId === "N/A" ? "N/A" : `#${shortId}`;
}
