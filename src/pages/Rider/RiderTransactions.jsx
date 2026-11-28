import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "../../styles/StaffBookings.css";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import { useAuth } from "../../context/AuthContext";
import {
  subscribeToRiderBookings,
  updateRiderBookingDetails,
  updateRiderBookingStatus,
} from "../../services/bookingService";
import { subscribeToServices } from "../../services/laundryService";
import { markCashPaymentCollected } from "../../services/paymentService";
import {
  formatShortBookingId,
  getBookingDisplayStatus,
  getBookingId,
  getPickupOption,
  isPickupOnlyBooking,
  isReadyForCustomerPickupStage,
  READY_FOR_PICKUP_ONLY_LABEL,
} from "../Staff/bookingHelpers";

/* =========================================================
   LEAFLET MARKER FIX
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const riderLocationIcon = L.icon({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
  className: "rider-location-marker",
});

function FitPickupAndRider({ pickupCoordinates, riderLocation }) {
  const map = useMap();
  const hasFittedLocations = useRef(false);

  useEffect(() => {
    if (hasFittedLocations.current || !riderLocation) return;

    const locations = [
      pickupCoordinates,
      riderLocation,
    ].filter(Boolean).map(({ latitude, longitude }) => [
      latitude,
      longitude,
    ]);

    if (locations.length > 1) {
      map.fitBounds(locations, {
        padding: [32, 32],
        maxZoom: 16,
      });
    } else {
      map.setView(locations[0], 16);
    }

    hasFittedLocations.current = true;
  }, [map, pickupCoordinates, riderLocation]);

  return null;
}

/* =========================================================
   DELIVERY FEES
========================================================= */

const DELIVERY_FEES = {
  "Pickup & Delivery": 30,
  "Pickup Only": 15,
};

/* =========================================================
   LAUNDRY WEIGHT PRICING (fixed rates — do not change)

   ≤5 kg       → ₱150 flat
   >5 and <10  → ₱150 + ₱27 × (kg − 5)
   exactly 10  → ₱300
   >10 and ≤50 → ₱300 + ₱27 × (kg − 10)
========================================================= */

const WEIGHT_TIER_RATE = 150;
const WEIGHT_TEN_KG_RATE = 300;
const WEIGHT_EXTRA_PER_KG = 27;
const WEIGHT_MAX_KG = 50;

/* =========================================================
   PAYMENT
========================================================= */

function getPayment(booking) {
  return booking?.payment || null;
}

// Cash bookings stay "Unpaid" until the rider (or staff) physically
// collects the money — this finds the collectible payment record.
function getCashPayment(booking) {
  const payment = getPayment(booking);
  if (!payment?.id) return null;

  const method = String(
    payment.payment_method ||
      payment.paymentMethod ||
      booking?.payment_method ||
      booking?.paymentMethod ||
      ""
  ).toLowerCase();
  const status = String(
    payment.payment_status || payment.paymentStatus || ""
  ).toLowerCase();

  return method === "cash" && status === "unpaid" ? payment : null;
}

/* =========================================================
   CUSTOMER
========================================================= */

function getCustomerName(booking) {
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

function getInitials(name) {
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

/* =========================================================
   SERVICES
========================================================= */

function getServiceArray(booking) {
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

function getServices(booking) {
  const services = getServiceArray(booking);

  return services.length
    ? services.join(", ")
    : "Laundry Service";
}

/* =========================================================
   WEIGHT
========================================================= */

function getWeight(booking) {
  if (!booking) return "";

  return (
    booking.weight ??
    booking.laundryWeight ??
    booking.kg ??
    ""
  );
}

/* =========================================================
   DELIVERY FEE
========================================================= */

function getDeliveryFee(booking) {
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

/* =========================================================
   INITIAL PAYMENT

   The customer's verified initial payment always lives in the
   matching Firestore "payments" record for this booking (created
   when the customer pays at booking time). Booking-level fields are
   kept only as a legacy fallback in case older bookings stored it
   differently.
========================================================= */

function getInitialPayment(booking) {
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
      booking.initial_payment ??
      booking.down_payment ??
      booking.paymentAmount ??
      booking.amountPaid ??
      booking.initialPaid ??
      0
  );

  return Number.isNaN(amount) ? 0 : amount;
}

/* =========================================================
   ADDRESS
========================================================= */

function getPickupLocation(booking) {
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

/* =========================================================
   CONTACT
========================================================= */

function getContactNumber(booking) {
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

/* =========================================================
   COORDINATES
========================================================= */

function getCoordinates(booking) {
  if (!booking) return null;

  const latitude = Number(
    booking.latitude ??
      booking.lat ??
      booking.location?.latitude ??
      booking.pickupLocation?.latitude
  );

  const longitude = Number(
    booking.longitude ??
      booking.lng ??
      booking.lon ??
      booking.location?.longitude ??
      booking.pickupLocation?.longitude
  );

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatCurrency(value) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "₱0.00";
  }

  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
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

function getDateMilliseconds(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getPaymentReference(booking) {
  const payment = getPayment(booking);

  return (
    payment?.reference_number ||
    payment?.referenceNumber ||
    payment?.gcashReference ||
    payment?.reference ||
    booking?.reference_number ||
    booking?.payment_reference ||
    booking?.paymentReference ||
    "N/A"
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function RiderTransactions() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showStatusModal, setShowStatusModal] =
    useState(false);

  const [selectedBooking, setSelectedBooking] =
    useState(null);

  const [notification, setNotification] =
    useState("");

  const [editableWeight, setEditableWeight] =
    useState("");

  const [weightError, setWeightError] =
    useState("");

  const [updating, setUpdating] =
    useState(false);

  const [riderLocation, setRiderLocation] =
    useState(null);

  const [riderLocationError, setRiderLocationError] =
    useState("");

  const [services, setServices] = useState([]);
  const [deliverConfirm, setDeliverConfirm] = useState(null);
  const [cashConfirm, setCashConfirm] = useState(null);
  const [collectingCash, setCollectingCash] = useState(false);

  /* =======================================================
     LOAD SERVICE PRICING (ADMIN SERVICES / PRICING MODULE)
  ======================================================= */

  useEffect(() => {
    const unsubscribe = subscribeToServices(
      (nextServices) => setServices(nextServices),
      (error) => {
        console.error("Unable to load service pricing:", error);
      }
    );

    return () => unsubscribe?.();
  }, []);

  // Live price-per-kg lookup, keyed by lowercased service name, sourced
  // directly from the Admin Services/Pricing collection. Never hardcode
  // prices here; this map is the single source of truth for rates.
  const servicePriceMap = useMemo(() => {
    const map = {};

    services.forEach((service) => {
      if (!service?.name || service.status === "Inactive") return;

      map[String(service.name).trim().toLowerCase()] =
        Number(service.price) || 0;
    });

    return map;
  }, [services]);

  /* =======================================================
     PRICE CALCULATIONS (depend on the live service pricing)
  ======================================================= */

  const getServiceRate = (booking) => {
    const bookingServices = getServiceArray(booking);

    return bookingServices.reduce((total, serviceName) => {
      const key = String(serviceName).trim().toLowerCase();
      return total + (servicePriceMap[key] || 0);
    }, 0);
  };

  // Weight pricing is fixed by kg band (not per selected service).
  const calculateLaundrySubtotal = (booking, weight) => {
    const kg = Number(weight);

    if (!kg || kg <= 0 || Number.isNaN(kg) || kg > WEIGHT_MAX_KG) return 0;

    if (kg <= 5) {
      return WEIGHT_TIER_RATE;
    }

    if (kg < 10) {
      return WEIGHT_TIER_RATE + (kg - 5) * WEIGHT_EXTRA_PER_KG;
    }

    if (kg <= 10) {
      return WEIGHT_TEN_KG_RATE;
    }

    return WEIGHT_TEN_KG_RATE + (kg - 10) * WEIGHT_EXTRA_PER_KG;
  };

  const calculateTotalAmount = (booking, weight) => {
    return (
      calculateLaundrySubtotal(booking, weight) +
      getDeliveryFee(booking)
    );
  };

  const getTotalAmount = (booking) => {
    if (!booking) return 0;

    const weight = getWeight(booking);

    if (weight !== "" && Number(weight) > 0) {
      return calculateTotalAmount(booking, weight);
    }

    const payment = getPayment(booking);

    const total = Number(
      booking.totalAmount ??
        booking.total_amount ??
        booking.total ??
        booking.amount ??
        booking.grandTotal ??
        booking.price ??
        booking.estimatedTotal ??
        payment?.total_amount ??
        payment?.totalAmount ??
        payment?.amount ??
        0
    );

    return Number.isNaN(total) ? 0 : total;
  };

  const getAmountToBePaid = (booking) => {
    const total = getTotalAmount(booking);
    const initial = getInitialPayment(booking);

    return Math.max(0, total - initial);
  };

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    return subscribeToRiderBookings(
      user.uid,
      (assignedBookings) => {
        setBookings(assignedBookings);
        setSelectedBooking((selected) =>
          selected
            ? assignedBookings.find(
                (booking) => booking.id === selected.id
              ) || selected
            : selected
        );
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load rider bookings:", error);
        setNotification("Unable to load assigned bookings.");
        setLoading(false);
      }
    );
  }, [user?.uid]);

  /* =======================================================
     NOTIFICATION
  ======================================================= */

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      setNotification("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [notification]);

  const selectedPickupOnly = isPickupOnlyBooking(selectedBooking);

  useEffect(() => {
    const needsLiveMap =
      selectedBooking?.status === "Ready for Pickup" ||
      (selectedBooking?.status === "To Deliver" && !selectedPickupOnly);

    if (!showStatusModal || !needsLiveMap) {
      return undefined;
    }

    if (!navigator.geolocation) {
      return undefined;
    }

    if (
      typeof window !== "undefined" &&
      typeof window.LaundryMateAndroid?.requestCurrentLocation === "function"
    ) {
      window.LaundryMateAndroid.requestCurrentLocation();
    } else if (
      typeof window !== "undefined" &&
      typeof window.LaundryMateAndroid?.hasLocationPermission === "function" &&
      !window.LaundryMateAndroid.hasLocationPermission()
    ) {
      window.LaundryMateAndroid.requestLocationPermission?.();
    }

    const onNativeLocation = (event) => {
      const detail = event?.detail;
      if (
        detail &&
        Number.isFinite(Number(detail.latitude)) &&
        Number.isFinite(Number(detail.longitude))
      ) {
        setRiderLocation({
          latitude: Number(detail.latitude),
          longitude: Number(detail.longitude),
        });
        setRiderLocationError("");
      }
    };

    window.addEventListener("laundrymateNativeLocation", onNativeLocation);

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        setRiderLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setRiderLocationError("");
      },
      () => {},
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 5000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setRiderLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setRiderLocationError("");
      },
      (error) => {
        const messages = {
          1: "Allow location access to show your live position.",
          2: "Your current location is unavailable.",
          3: "Location request timed out. Trying again...",
        };

        setRiderLocationError((current) =>
          current ||
          messages[error.code] ||
          "Unable to access your live location."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      window.removeEventListener("laundrymateNativeLocation", onNativeLocation);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [selectedBooking?.status, selectedPickupOnly, showStatusModal]);

  /* =======================================================
     OPEN STATUS MODAL
  ======================================================= */

  const handleUpdateStatus = (booking) => {
    setRiderLocation(null);
    setRiderLocationError("");
    setSelectedBooking(booking);
    setWeightError("");
    setEditableWeight(
      getWeight(booking) ? String(getWeight(booking)) : ""
    );

    setShowStatusModal(true);
  };

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  const closeStatusModal = () => {
    if (updating) return;

    setRiderLocation(null);
    setRiderLocationError("");
    setShowStatusModal(false);
    setSelectedBooking(null);
    setEditableWeight("");
    setWeightError("");
  };

  /* =======================================================
     UPDATE STATUS
  ======================================================= */

  const updateBookingStatus = async (
    bookingId,
    newStatus
  ) => {
    setUpdating(true);

    try {
      await updateRiderBookingStatus(
        bookingId,
        user.uid,
        newStatus
      );

      const updatedBooking = {
        ...selectedBooking,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (
        newStatus !== "Ready for Pickup" &&
        !(
          newStatus === "To Deliver" &&
          !isPickupOnlyBooking(selectedBooking)
        )
      ) {
        setRiderLocation(null);
        setRiderLocationError("");
      }

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingId ? updatedBooking : booking
        )
      );
      setSelectedBooking(updatedBooking);

      window.dispatchEvent(
        new Event("laundrymateBookingUpdated")
      );

      setNotification(
        `Booking status updated to "${newStatus}" and customer notified.`
      );

      return updatedBooking;
    } catch (error) {
      console.error(error);

      setNotification(
        error.message || "Unable to update booking status."
      );

      return null;
    } finally {
      setUpdating(false);
    }
  };

  /* =======================================================
     PICKED UP
  ======================================================= */

  const handlePickedUp = () => {
    if (!selectedBooking) return;

    const weight = Number(getWeight(selectedBooking));
    if (!weight || weight <= 0) {
      setNotification("Please enter and save the laundry weight first.");
      return;
    }

    updateBookingStatus(
      selectedBooking.id,
      "In Laundry"
    );
  };

  const handleSaveWeight = async () => {
    if (!selectedBooking) return;

    const weight = Number(editableWeight);
    if (
      editableWeight === "" ||
      Number.isNaN(weight) ||
      weight <= 0
    ) {
      setWeightError("Weight must be greater than 0 kg.");
      return;
    }

    if (weight > WEIGHT_MAX_KG) {
      setWeightError(`Weight cannot exceed ${WEIGHT_MAX_KG} kg.`);
      return;
    }

    setWeightError("");
    setUpdating(true);
    try {
      const serviceRate = getServiceRate(selectedBooking);
      const laundrySubtotal = calculateLaundrySubtotal(
        selectedBooking,
        weight
      );
      const deliveryFee = getDeliveryFee(selectedBooking);
      const totalAmount = laundrySubtotal + deliveryFee;
      const initialPayment = getInitialPayment(selectedBooking);
      const amountToBePaid = Math.max(
        0,
        totalAmount - initialPayment
      );
      const bookingDetails = {
        weight,
        laundryWeight: weight,
        kg: weight,
        serviceRate,
        laundrySubtotal,
        laundry_subtotal: laundrySubtotal,
        deliveryFee,
        delivery_fee: deliveryFee,
        totalAmount,
        total_amount: totalAmount,
        estimatedTotal: totalAmount,
        initialPayment,
        amountToBePaid,
      };

      await updateRiderBookingDetails(
        selectedBooking.id,
        user.uid,
        bookingDetails
      );

      const updatedBooking = {
        ...selectedBooking,
        ...bookingDetails,
        updatedAt: new Date().toISOString(),
      };
      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking
        )
      );
      setSelectedBooking(updatedBooking);
      window.dispatchEvent(new Event("laundrymateBookingUpdated"));
      setNotification(
        amountToBePaid > 0
          ? `Weight updated to ${weight} kg. Total amount is ${formatCurrency(
              totalAmount
            )}. Amount to be paid: ${formatCurrency(amountToBePaid)}.`
          : `Weight updated to ${weight} kg. Total amount is ${formatCurrency(
              totalAmount
            )}. Payment is fully settled.`
      );
    } catch (error) {
      console.error("Unable to update rider booking weight:", error);
      setNotification(error.message || "Unable to update weight.");
    } finally {
      setUpdating(false);
    }
  };

  /* =======================================================
     DELIVERED
     
     TO DELIVER → DELIVERED
  ======================================================= */

  const handleDelivered = () => {
    if (!selectedBooking) return;

    setDeliverConfirm({
      bookingId: selectedBooking.id,
      title: "Mark as delivered?",
      message:
        "Are you sure this laundry order has been delivered to the customer?",
      confirmLabel: "Yes, Delivered",
      loadingLabel: "Updating...",
      meta: [
        {
          label: "Booking",
          value: `#${formatShortBookingId(selectedBooking)}`,
        },
        {
          label: "Customer",
          value: getCustomerName(selectedBooking),
        },
        {
          label: "Service",
          value: getServices(selectedBooking),
        },
        {
          label: "Weight",
          value: (() => {
            const weight = getWeight(selectedBooking);
            return weight !== "" && weight !== null && weight !== undefined
              ? `${weight} kg`
              : "Not set";
          })(),
        },
      ],
    });
  };

  const closeDeliverConfirm = () => {
    if (updating) return;
    setDeliverConfirm(null);
  };

  const confirmDelivered = async () => {
    if (!deliverConfirm?.bookingId) return;

    const result = await updateBookingStatus(
      deliverConfirm.bookingId,
      "Delivered"
    );

    if (result) {
      setDeliverConfirm(null);
      closeStatusModal();
    }
  };

  /* =======================================================
     COLLECT CASH PAYMENT

     Marks an "Unpaid" cash payment as Paid once the rider has
     physically received the money from the customer.
  ======================================================= */

  const confirmCollectCash = async () => {
    if (!cashConfirm?.payment?.id) return;

    setCollectingCash(true);

    try {
      await markCashPaymentCollected(cashConfirm.payment.id);

      setCashConfirm(null);
      setNotification(
        `Cash payment of ${formatCurrency(
          Number(
            cashConfirm.payment.amount ??
              cashConfirm.payment.total_amount ??
              0
          )
        )} marked as collected.`
      );

      window.dispatchEvent(new Event("laundrymatePaymentUpdated"));
      window.dispatchEvent(new Event("laundrymateBookingUpdated"));
    } catch (error) {
      console.error("Unable to mark cash payment collected:", error);
      setNotification("Unable to mark the cash payment as collected.");
    } finally {
      setCollectingCash(false);
    }
  };

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        const query =
          search.trim().toLowerCase();

        const bookingId = getBookingId(booking);
        const searchableText = [
          bookingId,
          formatShortBookingId(bookingId),
          getCustomerName(booking),
          getServices(booking),
          getPickupOption(booking),
          getPickupLocation(booking),
          getContactNumber(booking),
          getWeight(booking),
          booking.status,
          getBookingDisplayStatus(booking),
        ]
          .filter(
            (value) =>
              value !== undefined &&
              value !== null
          )
          .join(" ")
          .toLowerCase();

        return (
          !query ||
          searchableText.includes(query)
        );
      })
      .sort((a, b) => {
        return getDateMilliseconds(
          b.booking_date || b.created_at || b.createdAt || b.schedule
        ) - getDateMilliseconds(
          a.booking_date || a.created_at || a.createdAt || a.schedule
        );
      });
  }, [bookings, search]);

  /* =======================================================
     STATUS CLASS
  ======================================================= */

  const getStatusClass = (status) => {
    return (
      status
        ?.toLowerCase()
        .replaceAll(" ", "-") ||
      "pending"
    );
  };

  const pickupCoordinates = selectedBooking
    ? getCoordinates(selectedBooking)
    : null;

  const mapCenter =
    pickupCoordinates || riderLocation;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="staff-bookings rider-transactions">

      {/* =================================================
          NOTIFICATION
      ================================================= */}

      {notification && (
        <div className="booking-notification">
          <span className="notification-check">
            ✓
          </span>

          <span>{notification}</span>

          <button
            type="button"
            onClick={() =>
              setNotification("")
            }
          >
            ×
          </button>
        </div>
      )}

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="section-header">
        <div>
          <h1>Assigned Bookings</h1>

          <p>
            View your assigned bookings and complete your pickup and delivery
            steps in the laundry workflow.
          </p>
        </div>

        <div className="booking-count">
          {filteredBookings.length}{" "}
          {filteredBookings.length === 1
            ? "Booking"
            : "Bookings"}
        </div>
      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <div className="filters">
        <div className="filters-row">
          <div className="search-wrapper">
            <span className="search-icon">
              ⌕
            </span>

            <input
              type="search"
              className="filter-input"
              placeholder="Search customer, booking ID, service..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="table-container">
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Contact Number</th>
              <th>Service Type</th>
              <th>Weight</th>
              <th>Total Amount</th>
              <th>Initial Payment</th>
              <th>Amount to be Paid</th>
              <th>Pickup Location</th>
              <th>Status</th>
              <th>Pickup Date</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="12" className="empty-state">
                  Loading assigned bookings...
                </td>
              </tr>
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => {
                const customerName =
                  getCustomerName(booking);

                const weight =
                  getWeight(booking);

                const cashPayment =
                  getCashPayment(booking);

                return (
                  <tr key={booking.id}>
                    <td>
                      <span
                        className="booking-id"
                        title={`#${getBookingId(booking)}`}
                      >
                        #{formatShortBookingId(booking)}
                      </span>
                    </td>

                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">
                          {getInitials(
                            customerName
                          )}
                        </div>

                        <div className="customer-info">
                          <div className="customer-name">
                            {customerName}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="contact-number">
                        {getContactNumber(booking)}
                      </span>
                    </td>

                    <td>
                      <span className="service-name">
                        {getServices(booking)}
                      </span>
                    </td>

                    <td>
                      <span className="weight-value">
                        {weight
                          ? `${weight} kg`
                          : "Not set"}
                      </span>
                    </td>

                    <td>
                      <span className="total-amount">
                        {formatCurrency(
                          getTotalAmount(
                            booking
                          )
                        )}
                      </span>
                    </td>

                    <td>
                      <span className="payment-amount">
                        {formatCurrency(
                          getInitialPayment(
                            booking
                          )
                        )}
                      </span>
                    </td>

                    <td>
                      <span className="amount-to-be-paid">
                        {formatCurrency(
                          getAmountToBePaid(
                            booking
                          )
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="pickup-location">
                        {getPickupLocation(
                          booking
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status ${getStatusClass(
                          getBookingDisplayStatus(booking)
                        )}`}
                      >
                        {getBookingDisplayStatus(booking)}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        booking.schedule ||
                          booking.pickup_date ||
                          booking.pickupDate
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="update-status-btn"
                        disabled={updating}
                        onClick={() =>
                          handleUpdateStatus(
                            booking
                          )
                        }
                        aria-label={`View booking ${booking.id}, status ${getBookingDisplayStatus(booking)}`}
                      >
                        {booking.status === "Ready for Pickup"
                          ? "Start Pickup"
                          : booking.status === "To Deliver" &&
                              !isPickupOnlyBooking(booking)
                            ? "Start Delivery"
                            : "View Details"}
                      </button>

                      {cashPayment && (
                        <div className="cash-collect-cell">
                          <small className="cash-to-collect">
                            Cash to Collect:{" "}
                            {formatCurrency(
                              cashPayment.amount ??
                                cashPayment.total_amount ??
                                getAmountToBePaid(booking)
                            )}
                          </small>
                          <button
                            type="button"
                            className="collect-cash-btn"
                            disabled={updating || collectingCash}
                            onClick={() =>
                              setCashConfirm({ booking, payment: cashPayment })
                            }
                          >
                            {collectingCash ? "Collecting..." : "Cash Collected"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="12"
                  className="empty-state"
                >
                  <div className="empty-icon">
                    📋
                  </div>

                  <strong>
                    No bookings found
                  </strong>

                  <span>
                    Try changing your search.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =================================================
          STATUS MODAL
      ================================================= */}

      {showStatusModal &&
        selectedBooking && (
          <div
            className="status-modal-overlay"
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeStatusModal();
              }
            }}
          >
            <div className="status-modal">

              {/* =================================================
                  MODAL HEADER
              ================================================= */}

              <div className="status-modal-header">
                <div>
                  <h2>
                    {getBookingDisplayStatus(
                      selectedBooking
                    )}
                  </h2>

                  <p>
                    Booking #
                    {formatShortBookingId(selectedBooking)}
                  </p>
                </div>

                <button
                  type="button"
                  className="status-close-btn"
                  onClick={
                    closeStatusModal
                  }
                  disabled={updating}
                >
                  ×
                </button>
              </div>

              <div className="status-divider" />

              {/* =================================================
                  PENDING
              ================================================= */}

              {selectedBooking.status ===
                "Pending" && (
                <>
                  <div className="status-details">
                    <Detail
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Initial Payment"
                      value={formatCurrency(
                        getInitialPayment(
                          selectedBooking
                        )
                      )}
                    />

                    <Detail
                      label="Reference Number"
                      value={getPaymentReference(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Pickup Address"
                      value={getPickupLocation(
                        selectedBooking
                      )}
                      full
                    />

                    <Detail
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Status"
                      value="Pending"
                      className="pending-status-text"
                    />
                  </div>

                  <div className="status-actions">
                    <p role="status">
                      This booking is assigned to you. Pickup actions will be
                      available when staff marks the laundry ready for pickup.
                    </p>
                  </div>
                </>
              )}

              {/* =================================================
                  ACCEPTED
              ================================================= */}

              {selectedBooking.status ===
                "Accepted" && (
                <>
                  <div className="status-details">
                    <Detail
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Initial Payment"
                      value={formatCurrency(
                        getInitialPayment(
                          selectedBooking
                        )
                      )}
                    />

                    <Detail
                      label="Reference Number"
                      value={getPaymentReference(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Pickup Address"
                      value={getPickupLocation(
                        selectedBooking
                      )}
                      full
                    />

                    <Detail
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Status"
                      value="Accepted"
                      className="accepted-status-text"
                    />
                  </div>

                  <div className="status-actions">
                    <p role="status">
                      Staff accepted this booking. Pickup actions will be
                      available when the laundry is ready for pickup.
                    </p>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={closeStatusModal}
                      disabled={updating}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}

              {/* =================================================
                  READY FOR PICKUP
              ================================================= */}

              {selectedBooking.status ===
                "Ready for Pickup" && (
                <>
                  <div className="status-details">
                    <Detail
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Pickup Address"
                      value={getPickupLocation(
                        selectedBooking
                      )}
                      full
                    />

                    <Detail
                      label="Status"
                      value="Ready for Pickup"
                      className="ready-status-text"
                    />
                  </div>

                  {/* MAP */}

                  <div className="pickup-map-section">
                    <div className="pickup-map-header">
                      <div>
                        <h3>
                          Pickup Location
                        </h3>

                        <p>
                          Customer pickup location
                        </p>
                      </div>

                      <span className="map-location-badge">
                        📍 GPS
                      </span>
                    </div>

                    {mapCenter ? (
                      <div className="pickup-map-wrapper">
                        <MapContainer
                          center={[
                            mapCenter.latitude,
                            mapCenter.longitude,
                          ]}
                          zoom={16}
                          scrollWheelZoom
                          className="pickup-status-map"
                        >
                          <FitPickupAndRider
                            pickupCoordinates={pickupCoordinates}
                            riderLocation={riderLocation}
                          />

                          <TileLayer
                            attribution="&copy; OpenStreetMap contributors"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />

                          {pickupCoordinates && (
                            <Marker
                              position={[
                                pickupCoordinates.latitude,
                                pickupCoordinates.longitude,
                              ]}
                            >
                              <Popup>
                                <div className="map-popup">
                                  <strong>
                                    {getCustomerName(
                                      selectedBooking
                                    )}
                                  </strong>

                                  <span>
                                    {getPickupLocation(
                                      selectedBooking
                                    )}
                                  </span>
                                </div>
                              </Popup>
                            </Marker>
                          )}

                          {riderLocation && (
                            <Marker
                              position={[
                                riderLocation.latitude,
                                riderLocation.longitude,
                              ]}
                              icon={riderLocationIcon}
                            >
                              <Popup>
                                <div className="map-popup">
                                  <strong>Your live location</strong>
                                  <span>Updated as you move</span>
                                </div>
                              </Popup>
                            </Marker>
                          )}
                        </MapContainer>
                      </div>
                    ) : (
                      <div className="pickup-map-empty">
                        <div>📍</div>

                        <strong>
                          Map unavailable
                        </strong>

                        <span>
                          Customer coordinates were not saved.
                        </span>
                      </div>
                    )}

                    <div
                      className={`rider-location-status ${
                        riderLocation
                          ? "is-live"
                          : "is-waiting"
                      }`}
                      role="status"
                    >
                      <span aria-hidden="true">
                        {riderLocation ? "●" : "○"}
                      </span>
                      {riderLocation
                        ? "Your live location is shown on the map."
                        : riderLocationError ||
                          (!navigator.geolocation
                            ? "Live location is not supported by this browser."
                            : null) ||
                          "Waiting for your live location..."}
                      {!riderLocation &&
                        riderLocationError &&
                        typeof window !== "undefined" &&
                        window.LaundryMateAndroid?.openAppSettings && (
                          <button
                            type="button"
                            className="rider-permission-settings-btn"
                            onClick={() =>
                              window.LaundryMateAndroid.openAppSettings()
                            }
                          >
                            ⚙️ Open Settings
                          </button>
                        )}
                    </div>
                  </div>

                  <div className="pickup-summary">
                    <div className="pickup-summary-title">
                      Payment Calculation
                    </div>

                    <div className="weight-editor">
                      <label htmlFor="rider-laundry-weight">
                        Actual Laundry Weight
                      </label>

                      <div className="weight-input-row">
                        <input
                          id="rider-laundry-weight"
                          type="number"
                          min="0.1"
                          max={WEIGHT_MAX_KG}
                          step="0.1"
                          value={editableWeight}
                          onChange={(event) => {
                            const rawValue = event.target.value;

                            if (rawValue !== "" && Number(rawValue) <= 0) {
                              setWeightError("Weight must be greater than 0 kg.");
                              return;
                            }

                            if (
                              rawValue !== "" &&
                              Number(rawValue) > WEIGHT_MAX_KG
                            ) {
                              setWeightError(
                                `Weight cannot exceed ${WEIGHT_MAX_KG} kg.`
                              );
                              return;
                            }

                            setWeightError("");
                            setEditableWeight(rawValue);
                          }}
                          placeholder="Enter weight"
                          disabled={updating}
                        />
                        <span>kg</span>
                      </div>

                      {weightError && (
                        <small className="weight-error-text">
                          {weightError}
                        </small>
                      )}

                      <small>
                        Rate: ₱{WEIGHT_TIER_RATE} for 1–5 kg · +₱
                        {WEIGHT_EXTRA_PER_KG}/kg above 5 · ₱{WEIGHT_TEN_KG_RATE}{" "}
                        at 10 kg · +₱{WEIGHT_EXTRA_PER_KG}/kg above 10 (max{" "}
                        {WEIGHT_MAX_KG} kg)
                      </small>
                    </div>

                    <PaymentRow
                      label="Weight"
                      value={editableWeight ? `${editableWeight} kg` : "Not set"}
                    />
                    <PaymentRow
                      label="Laundry Subtotal"
                      value={formatCurrency(
                        calculateLaundrySubtotal(selectedBooking, editableWeight)
                      )}
                    />
                    <PaymentRow
                      label={
                        isPickupOnlyBooking(selectedBooking)
                          ? "Pickup Fee"
                          : "Delivery Fee"
                      }
                      value={formatCurrency(getDeliveryFee(selectedBooking))}
                    />
                    <PaymentRow
                      label="Total Amount"
                      value={formatCurrency(
                        calculateTotalAmount(selectedBooking, editableWeight)
                      )}
                      highlight
                    />
                    <PaymentRow
                      label="Initial Payment"
                      value={formatCurrency(getInitialPayment(selectedBooking))}
                    />
                    <PaymentRow
                      label="Amount to be Paid"
                      value={formatCurrency(
                        Math.max(
                          0,
                          calculateTotalAmount(selectedBooking, editableWeight) -
                            getInitialPayment(selectedBooking)
                        )
                      )}
                      balance
                    />

                    {getInitialPayment(selectedBooking) >
                      calculateTotalAmount(selectedBooking, editableWeight) && (
                      <PaymentRow
                        label="Overpayment"
                        value={formatCurrency(
                          getInitialPayment(selectedBooking) -
                            calculateTotalAmount(
                              selectedBooking,
                              editableWeight
                            )
                        )}
                        balance
                      />
                    )}

                    <button
                      type="button"
                      className="save-weight-btn"
                      onClick={handleSaveWeight}
                      disabled={updating}
                    >
                      {updating ? "Updating..." : "Update Weight & Amount"}
                    </button>
                  </div>

                  <div className="status-actions">
                    <button
                      type="button"
                      className="pickup-btn"
                      onClick={
                        handlePickedUp
                      }
                      disabled={updating || !getWeight(selectedBooking)}
                    >
                      Picked Up
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={
                        closeStatusModal
                      }
                      disabled={updating}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}

              {/* =================================================
                  IN LAUNDRY
              ================================================= */}

              {[
                "In Laundry",
                "Picked Up",
                "Washing",
                "Drying",
                "Folding",
              ].includes(selectedBooking.status) && (
                <div className="in-laundry-screen">

                  <div className="laundry-info-list">
                    <InfoLine
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Pickup Option"
                      value={getPickupOption(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Weight"
                      value={
                        getWeight(
                          selectedBooking
                        )
                          ? `${getWeight(
                              selectedBooking
                            )} kg`
                          : "Not set"
                      }
                    />

                    <InfoLine
                      label="Total Amount"
                      value={formatCurrency(
                        getTotalAmount(
                          selectedBooking
                        )
                      )}
                    />

                    <InfoLine
                      label="Pickup Address"
                      value={getPickupLocation(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Status"
                      value="In Laundry"
                      status
                    />
                  </div>

                  <p>
                    {isPickupOnlyBooking(selectedBooking)
                      ? "Laundry processing is managed by staff. Once finished, it will be marked Ready for pick up at the shop."
                      : "Laundry processing is managed by staff."}
                  </p>

                  <button
                    type="button"
                    className="secondary-btn full-btn"
                    onClick={
                      closeStatusModal
                    }
                    disabled={updating}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* =================================================
                  READY FOR PICK UP (PICKUP ONLY FLOW)
              ================================================= */}

              {isReadyForCustomerPickupStage(
                selectedBooking
              ) && (
                <div className="to-deliver-screen">
                  <div className="delivery-info-list">
                    <InfoLine
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Pickup Option"
                      value={getPickupOption(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Weight"
                      value={
                        getWeight(
                          selectedBooking
                        )
                          ? `${getWeight(
                              selectedBooking
                            )} kg`
                          : "Not set"
                      }
                    />

                    <InfoLine
                      label="Total Amount"
                      value={formatCurrency(
                        getTotalAmount(
                          selectedBooking
                        )
                      )}
                    />

                    <InfoLine
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Status"
                      value={READY_FOR_PICKUP_ONLY_LABEL}
                      status
                    />
                  </div>

                  <div className="pickup-only-ready-notice" role="status">
                    <strong>📦 Ready for pick up</strong>
                    <p>
                      This is a Pickup Only order. The customer picks up their
                      laundry at the shop (managed by staff) — no rider delivery
                      is needed.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-btn full-btn"
                    onClick={closeStatusModal}
                    disabled={updating}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* =================================================
                  TO DELIVER (PICKUP & DELIVERY FLOW ONLY)
                  
                  THIS IS THE SCREEN FROM YOUR IMAGE
              ================================================= */}

              {selectedBooking.status ===
                "To Deliver" &&
                !isPickupOnlyBooking(
                  selectedBooking
                ) && (
                <div className="to-deliver-screen">

                  {/* CUSTOMER INFORMATION */}

                  <div className="delivery-info-list">

                    <InfoLine
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Service Type"
                      value={getServices(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Weight"
                      value={
                        getWeight(
                          selectedBooking
                        )
                          ? `${getWeight(
                              selectedBooking
                            )} kg`
                          : "Not set"
                      }
                    />

                    <InfoLine
                      label="Total Amount"
                      value={formatCurrency(
                        getTotalAmount(
                          selectedBooking
                        )
                      )}
                    />

                    <InfoLine
                      label="Pickup Address"
                      value={getPickupLocation(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Contact Number"
                      value={getContactNumber(
                        selectedBooking
                      )}
                    />

                    <InfoLine
                      label="Status"
                      value="To Deliver"
                      status
                    />

                  </div>

                  {/* =================================================
                      DELIVERY MAP
                  ================================================= */}

                  <div className="delivery-map-section">

                    {mapCenter ? (
                      <div className="delivery-map-wrapper">

                        <MapContainer
                          center={[
                            mapCenter.latitude,
                            mapCenter.longitude,
                          ]}
                          zoom={16}
                          scrollWheelZoom
                          className="delivery-map"
                        >

                          <FitPickupAndRider
                            pickupCoordinates={pickupCoordinates}
                            riderLocation={riderLocation}
                          />

                          <TileLayer
                            attribution="&copy; OpenStreetMap contributors"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />

                          {pickupCoordinates && (
                            <Marker
                              position={[
                                pickupCoordinates.latitude,
                                pickupCoordinates.longitude,
                              ]}
                            >

                              <Popup>
                                <div className="map-popup">
                                  <strong>
                                    Deliver To
                                  </strong>

                                  <span>
                                    {getCustomerName(
                                      selectedBooking
                                    )}
                                  </span>

                                  <span>
                                    {getPickupLocation(
                                      selectedBooking
                                    )}
                                  </span>

                                  <span>
                                    {getContactNumber(
                                      selectedBooking
                                    )}
                                  </span>
                                </div>
                              </Popup>

                            </Marker>
                          )}

                          {riderLocation && (
                            <Marker
                              position={[
                                riderLocation.latitude,
                                riderLocation.longitude,
                              ]}
                              icon={riderLocationIcon}
                            >
                              <Popup>
                                <div className="map-popup">
                                  <strong>Your live location</strong>
                                  <span>Updated as you move</span>
                                </div>
                              </Popup>
                            </Marker>
                          )}

                        </MapContainer>

                        <div className="delivery-map-overlay">
                          <span>📍</span>

                          <div>
                            <strong>
                              Customer Location
                            </strong>

                            <small>
                              Tap the marker for
                              delivery details
                            </small>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="delivery-map-empty">

                        <div className="map-empty-icon">
                          📍
                        </div>

                        <strong>
                          Map Location Unavailable
                        </strong>

                        <span>
                          No GPS coordinates were
                          saved for this booking.
                        </span>

                      </div>
                    )}

                    <div
                      className={`rider-location-status ${
                        riderLocation
                          ? "is-live"
                          : "is-waiting"
                      }`}
                      role="status"
                    >
                      <span aria-hidden="true">
                        {riderLocation ? "●" : "○"}
                      </span>
                      {riderLocation
                        ? "Your live location is shown on the map."
                        : riderLocationError ||
                          (!navigator.geolocation
                            ? "Live location is not supported by this browser."
                            : null) ||
                          "Waiting for your live location..."}
                      {!riderLocation &&
                        riderLocationError &&
                        typeof window !== "undefined" &&
                        window.LaundryMateAndroid?.openAppSettings && (
                          <button
                            type="button"
                            className="rider-permission-settings-btn"
                            onClick={() =>
                              window.LaundryMateAndroid.openAppSettings()
                            }
                          >
                            ⚙️ Open Settings
                          </button>
                        )}
                    </div>

                  </div>

                  {/* =================================================
                      DELIVERED BUTTON
                  ================================================= */}

                  <div className="delivery-action">

                    <button
                      type="button"
                      className="delivered-btn"
                      onClick={
                        handleDelivered
                      }
                      disabled={updating}
                    >
                      {updating
                        ? "Updating..."
                        : "Delivered"}
                    </button>

                  </div>

                  <button
                    type="button"
                    className="secondary-btn full-btn"
                    onClick={
                      closeStatusModal
                    }
                    disabled={updating}
                  >
                    Close
                  </button>

                </div>
              )}

              {/* =================================================
                  DELIVERED
              ================================================= */}

              {["Delivered", "Completed"].includes(
                selectedBooking.status
              ) && (
                <>
                  <div className="completed-message">

                    <div className="completed-icon">
                      ✓
                    </div>

                    <h3>
                      {isPickupOnlyBooking(selectedBooking) ||
                      selectedBooking.status === "Completed"
                        ? "Booking Completed"
                        : "Laundry Delivered"}
                    </h3>

                    <p>
                      {isPickupOnlyBooking(selectedBooking)
                        ? "This Pickup Only order has been picked up by the customer."
                        : selectedBooking.status === "Completed"
                          ? "Staff marked this booking as completed."
                          : "The laundry order has been successfully delivered to the customer."}
                    </p>

                    <div className="completed-payment">

                      <div>
                        <span>
                          Total Amount
                        </span>

                        <strong>
                          {formatCurrency(
                            getTotalAmount(
                              selectedBooking
                            )
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Amount to be Paid
                        </span>

                        <strong>
                          {formatCurrency(
                            getAmountToBePaid(
                              selectedBooking
                            )
                          )}
                        </strong>
                      </div>

                    </div>

                  </div>

                  <div className="status-actions">

                    <button
                      type="button"
                      className="secondary-btn full-btn"
                      onClick={
                        closeStatusModal
                      }
                    >
                      Close
                    </button>

                  </div>
                </>
              )}

              {/* =================================================
                  DECLINED
              ================================================= */}

              {selectedBooking.status ===
                "Declined" && (
                <>
                  <div className="status-details">

                    <Detail
                      label="Customer Name"
                      value={getCustomerName(
                        selectedBooking
                      )}
                    />

                    <Detail
                      label="Status"
                      value="Declined"
                      className="declined-status-text"
                    />

                  </div>

                  <div className="status-actions">

                    <button
                      type="button"
                      className="secondary-btn full-btn"
                      onClick={
                        closeStatusModal
                      }
                    >
                      Close
                    </button>

                  </div>
                </>
              )}

            </div>
          </div>
        )}

      <ConfirmActionModal
        open={Boolean(deliverConfirm)}
        loading={updating}
        variant="success"
        title={deliverConfirm?.title}
        message={deliverConfirm?.message}
        confirmLabel={deliverConfirm?.confirmLabel}
        loadingLabel={deliverConfirm?.loadingLabel}
        meta={deliverConfirm?.meta}
        onCancel={closeDeliverConfirm}
        onConfirm={confirmDelivered}
      />

      <ConfirmActionModal
        open={Boolean(cashConfirm)}
        loading={collectingCash}
        variant="success"
        title="Cash payment collected?"
        message="Confirm you received the cash from the customer. This marks the payment as Paid."
        confirmLabel="Yes, Collected"
        loadingLabel="Updating..."
        meta={
          cashConfirm
            ? [
                {
                  label: "Booking",
                  value: `#${formatShortBookingId(cashConfirm.booking)}`,
                },
                {
                  label: "Customer",
                  value: getCustomerName(cashConfirm.booking),
                },
                {
                  label: "Amount",
                  value: formatCurrency(
                    Number(
                      cashConfirm.payment.amount ??
                        cashConfirm.payment.total_amount ??
                        0
                    )
                  ),
                },
              ]
            : []
        }
        onCancel={() => {
          if (!collectingCash) setCashConfirm(null);
        }}
        onConfirm={confirmCollectCash}
      />
    </div>
  );
}

/* =========================================================
   DETAIL COMPONENT
========================================================= */

function Detail({
  label,
  value,
  full = false,
  className = "",
}) {
  return (
    <div
      className={`status-detail ${
        full ? "full-width" : ""
      }`}
    >
      <span>{label}:</span>

      <strong className={className}>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   INFORMATION LINE
========================================================= */

function InfoLine({
  label,
  value,
  status = false,
}) {
  return (
    <div className="image-info-line">

      <span>{label}:</span>

      <strong
        className={
          status
            ? "image-status-text"
            : ""
        }
      >
        {value}
      </strong>

    </div>
  );
}

function PaymentRow({
  label,
  value,
  highlight = false,
  balance = false,
}) {
  return (
    <div
      className={`pickup-summary-row ${
        highlight ? "highlight-row" : ""
      } ${balance ? "balance-row" : ""}`}
    >
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

export default RiderTransactions;