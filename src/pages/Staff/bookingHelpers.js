/* =========================================================
   Shared staff booking helpers (Bookings page + Dashboard)
========================================================= */

export const DELIVERY_FEES = {
  "Pickup & Delivery": 30,
  "Pickup Only": 20,
};

// Fixed tiered rate: every 5 kg (or part thereof) costs ₱150.
// Laundry Subtotal = CEILING(Actual Weight / WEIGHT_TIER_KG) × WEIGHT_TIER_RATE
export const WEIGHT_TIER_KG = 5;
export const WEIGHT_TIER_RATE = 150;

export function getPayment(booking) {
  return booking?.payment || null;
}

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

  const pickupType =
    booking.pickupType ||
    booking.deliveryType ||
    "Pickup & Delivery";

  return DELIVERY_FEES[pickupType] || 0;
}

// The verified initial payment lives in the matching Firestore "payments"
// record; booking-level fields are only a legacy fallback.
export function getInitialPayment(booking) {
  if (!booking) return 0;

  const payment = getPayment(booking);

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

  if (!kg || kg <= 0 || Number.isNaN(kg)) return 0;

  return Math.ceil(kg / WEIGHT_TIER_KG) * WEIGHT_TIER_RATE;
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
