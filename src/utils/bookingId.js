/**
 * Shared booking ID helpers — keep Customer / Staff / Rider labels in sync.
 * Short label matches what riders and staff see (e.g. #2mkDRq).
 */

export function getBookingId(bookingOrId) {
  if (bookingOrId == null) return "N/A";

  if (typeof bookingOrId === "string" || typeof bookingOrId === "number") {
    const raw = String(bookingOrId).trim();
    return raw || "N/A";
  }

  const id =
    bookingOrId.id ||
    bookingOrId.bookingId ||
    bookingOrId.booking_id ||
    bookingOrId.booking?.id ||
    bookingOrId.booking?.bookingId ||
    bookingOrId.booking?.booking_id;

  return id ? String(id) : "N/A";
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
