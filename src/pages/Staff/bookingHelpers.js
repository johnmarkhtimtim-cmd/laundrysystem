/* =========================================================
   Shared staff booking helpers (Bookings page + Dashboard)
========================================================= */

export const DELIVERY_FEES = {
  "Pickup & Delivery": 30,
  "Pickup Only": 15,
};

// Weight pricing (fixed rates — do not change):
// ≤5 kg        → ₱150 flat
// >5 and <10   → ₱150 + ₱27 × (kg − 5)   [decimal kg proportional]
// exactly 10   → ₱300
// >10 and ≤50  → ₱300 + ₱27 × (kg − 10)
// ≤0 or >50    → invalid
export const WEIGHT_TIER_KG = 5;
export const WEIGHT_TIER_RATE = 150;
export const WEIGHT_TEN_KG_RATE = 300;
export const WEIGHT_EXTRA_PER_KG = 27;
export const WEIGHT_MAX_KG = 50;

export function getWeightPricingLabel() {
  return `₱${WEIGHT_TIER_RATE} for 1–5 kg · +₱${WEIGHT_EXTRA_PER_KG}/kg above 5 (until 10) · ₱${WEIGHT_TEN_KG_RATE} at 10 kg · +₱${WEIGHT_EXTRA_PER_KG}/kg above 10 (max ${WEIGHT_MAX_KG} kg)`;
}

/** Returns an error message for invalid weight, or "" if valid. */
export function validateLaundryWeight(weight) {
  const kg = Number(weight);

  if (weight === "" || weight === null || weight === undefined) {
    return "Please enter the laundry weight.";
  }

  if (Number.isNaN(kg)) {
    return "Please enter a valid weight in kilograms.";
  }

  if (kg <= 0) {
    return "Weight must be greater than 0 kg.";
  }

  if (kg > WEIGHT_MAX_KG) {
    return `Weight cannot exceed ${WEIGHT_MAX_KG} kg.`;
  }

  return "";
}

export function getPayment(booking) {
  return booking?.payment || null;
}

export {
  formatBookingIdLabel,
  formatShortBookingId,
  getBookingId,
} from "../../utils/bookingId";

export {
  PICKUP_AND_DELIVERY_OPTION,
  PICKUP_ONLY_OPTION,
  READY_FOR_CUSTOMER_PICKUP_STATUS,
  READY_FOR_PICKUP_ONLY_LABEL,
  getBookingDisplayStatus,
  getPickupOption,
  isPickupOnlyBooking,
  isReadyForCustomerPickupStage,
} from "../../utils/bookingFlow";
import { getPickupOption } from "../../utils/bookingFlow";

export function getCustomerName(booking) {
  if (!booking) return "Unknown Customer";

  const name =
    booking.customerName ||
    booking.customer_name ||
    booking.name ||
    booking.fullName ||
    booking.displayName ||
    booking.customer?.name ||
    booking.customer?.fullName ||
    booking.userName ||
    [booking.customer?.firstName, booking.customer?.lastName]
      .filter(Boolean)
      .join(" ") ||
    booking.payment?.customer_name ||
    booking.payment?.customerName;

  return name ? String(name).trim() : "Unknown Customer";
}

export function getContactNumber(booking) {
  if (!booking) return "N/A";

  return (
    booking.contactNumber ||
    booking.contact_number ||
    booking.phone_number ||
    booking.phone ||
    booking.mobileNumber ||
    booking.phoneNumber ||
    booking.customer?.contactNumber ||
    booking.customer?.phone ||
    "N/A"
  );
}

export function getInitials(name) {
  if (!name) return "C";

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export function getServiceArray(booking) {
  if (!booking) return [];

  const normalize = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : String(item?.name || item?.serviceName || "").trim()
        )
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  };

  const candidates = [
    booking.services,
    booking.selectedServices,
    booking.service,
    booking.serviceName,
    booking.service_name,
    booking.serviceType,
    booking.service_type,
    booking.payment?.services,
  ];

  for (const candidate of candidates) {
    const services = normalize(candidate);

    if (services.length) return services;
  }

  return [];
}

export function getServices(booking) {
  const services = getServiceArray(booking);

  return services.length
    ? services.join(", ")
    : "Laundry Service";
}

export function getWeight(booking) {
  if (!booking) return "";

  return (
    booking.weight ??
    booking.laundryWeight ??
    booking.kg ??
    ""
  );
}

export function getDeliveryFee(booking) {
  if (!booking) return 0;

  if (
    booking.deliveryFee !== undefined &&
    booking.deliveryFee !== null &&
    booking.deliveryFee !== ""
  ) {
    const savedFee = Number(booking.deliveryFee);

    if (!Number.isNaN(savedFee)) {
      return savedFee;
    }
  }

  const pickupType = getPickupOption(booking);

  return DELIVERY_FEES[pickupType] || 0;
}

// The verified initial payment lives in the matching Firestore "payments"
// record; booking-level fields are only a legacy fallback.
export function getInitialPayment(booking) {
  if (!booking) return 0;

  const payment = getPayment(booking);

  // Uncollected payments (cash "Unpaid", unverified "Pending", "Rejected")
  // must not count as money already received.
  const paymentStatus = String(
    payment?.payment_status || payment?.paymentStatus || ""
  ).toLowerCase();
  if (["unpaid", "pending", "rejected"].includes(paymentStatus)) {
    return 0;
  }

  const amount = Number(
    payment?.initial_payment ??
      payment?.initialPayment ??
      payment?.amount ??
      payment?.total_amount ??
      payment?.totalAmount ??
      booking.initialPayment ??
      booking.downPayment ??
      booking.paymentAmount ??
      booking.amountPaid ??
      booking.initialPaid ??
      0
  );

  return Number.isNaN(amount) ? 0 : amount;
}

export function getPickupLocation(booking) {
  if (!booking) return "N/A";

  if (booking.pickupAddress) {
    return String(booking.pickupAddress);
  }

  if (
    booking.pickupLocation &&
    typeof booking.pickupLocation === "string"
  ) {
    return booking.pickupLocation;
  }

  return (
    [
      booking.address,
      booking.pickup_address,
      booking.barangay,
      booking.barangay_name,
      booking.city,
      booking.city_name,
      booking.province,
      booking.province_name,
      booking.landmark,
    ]
      .filter(Boolean)
      .join(", ") || "N/A"
  );
}

export function formatCurrency(value) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "₱0.00";
  }

  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return "N/A";

  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getStatusClass(status) {
  return (
    status
      ?.toLowerCase()
      .replaceAll(" ", "-") ||
    "pending"
  );
}

export function calculateLaundrySubtotal(booking, weight) {
  const kg = Number(weight);

  if (!kg || kg <= 0 || Number.isNaN(kg) || kg > WEIGHT_MAX_KG) return 0;

  // 1–5 kg: flat ₱150
  if (kg <= 5) {
    return WEIGHT_TIER_RATE;
  }

  // Above 5 kg but below 10 kg: ₱150 + ₱27 per additional kg (proportional)
  if (kg < 10) {
    return WEIGHT_TIER_RATE + (kg - 5) * WEIGHT_EXTRA_PER_KG;
  }

  // Exactly 10 kg: ₱300
  if (kg <= 10) {
    return WEIGHT_TEN_KG_RATE;
  }

  // Above 10 kg up to 50 kg: ₱300 + ₱27 per additional kg (proportional)
  return WEIGHT_TEN_KG_RATE + (kg - 10) * WEIGHT_EXTRA_PER_KG;
}

export function calculateTotalAmount(booking, weight) {
  return (
    calculateLaundrySubtotal(booking, weight) +
    getDeliveryFee(booking)
  );
}

export function getTotalAmount(booking) {
  if (!booking) return 0;

  const weight = getWeight(booking);

  if (weight !== "" && Number(weight) > 0) {
    return calculateTotalAmount(booking, weight);
  }

  const payment = getPayment(booking);

  const total = Number(
    booking.totalAmount ??
      booking.total ??
      booking.amount ??
      booking.grandTotal ??
      booking.price ??
      booking.estimatedTotal ??
      booking.total_amount ??
      payment?.total_amount ??
      payment?.totalAmount ??
      payment?.amount ??
      0
  );

  return Number.isNaN(total) ? 0 : total;
}

export function getAmountToBePaid(booking) {
  const total = getTotalAmount(booking);
  const initial = getInitialPayment(booking);

  return Math.max(0, total - initial);
}
