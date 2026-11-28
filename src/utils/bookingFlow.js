/* =========================================================
   Pickup Only vs Pickup & Delivery workflow helpers
========================================================= */

export const PICKUP_ONLY_OPTION = "Pickup Only";
export const PICKUP_AND_DELIVERY_OPTION = "Pickup & Delivery";

export const READY_FOR_CUSTOMER_PICKUP_STATUS = "Ready for Customer Pickup";
export const READY_FOR_PICKUP_ONLY_LABEL = "Ready for pick up";
export const PICKUP_ONLY_FINAL_CUSTOMER_LABEL = "Picked up";

/**
 * Resolve whether a booking is "Pickup Only" or "Pickup & Delivery".
 */
export function getPickupOption(booking) {
  if (!booking) return PICKUP_AND_DELIVERY_OPTION;

  const rawOption =
    booking.pickupType ??
    booking.pickup_type ??
    booking.pickupOption ??
    booking.pickup_option ??
    booking.deliveryType ??
    booking.delivery_type ??
    booking.pickup ??
    "";

  const trimmed = String(rawOption).trim();
  if (trimmed) {
    if (trimmed.toLowerCase().includes("pickup only")) {
      return PICKUP_ONLY_OPTION;
    }
    return trimmed;
  }

  // Legacy fallback if pickupType was omitted on an older booking
  const rawFee =
    booking.deliveryFee ??
    booking.delivery_fee ??
    booking.payment?.delivery_fee;

  if (
    rawFee !== undefined &&
    rawFee !== null &&
    rawFee !== "" &&
    Number(rawFee) === 15
  ) {
    return PICKUP_ONLY_OPTION;
  }

  return PICKUP_AND_DELIVERY_OPTION;
}

export function isPickupOnlyBooking(booking) {
  return getPickupOption(booking) === PICKUP_ONLY_OPTION;
}

/**
 * True when a Pickup Only order has finished laundry processing and is waiting
 * for the customer to pick it up at the shop.
 */
export function isReadyForCustomerPickupStage(booking) {
  if (!booking) return false;
  const status = String(booking.status || "").trim();

  if (status === READY_FOR_CUSTOMER_PICKUP_STATUS) {
    return true;
  }

  // Also treat legacy Pickup Only bookings that were previously set to "To Deliver"
  // as part of the Pickup Only "Ready for pick up" stage.
  return isPickupOnlyBooking(booking) && status === "To Deliver";
}

/**
 * User-facing status label that respects the Pickup Only vs Pickup & Delivery flow.
 */
export function getBookingDisplayStatus(booking) {
  if (!booking) return "Pending";

  const rawStatus = String(
    booking.status ||
      booking.bookingStatus ||
      booking.orderStatus ||
      "Pending"
  ).trim();

  if (isReadyForCustomerPickupStage(booking)) {
    return READY_FOR_PICKUP_ONLY_LABEL;
  }

  if (isPickupOnlyBooking(booking) && rawStatus === "Delivered") {
    return "Completed";
  }

  return rawStatus || "Pending";
}
