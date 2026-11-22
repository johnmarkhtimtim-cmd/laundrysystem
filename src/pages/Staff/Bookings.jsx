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
  acceptBooking,
  archiveBooking,
  declinePendingBooking,
  getLocalDateKey,
  subscribeToDailyBookingCapacityStatus,
  subscribeToStaffBookings,
  unarchiveBooking,
  updateStaffBookingDetails,
  updateStaffBookingStatus,
} from "../../services/bookingService";
import { subscribeToServices } from "../../services/laundryService";
import {
  calculateLaundrySubtotal,
  getWeightPricingLabel,
  validateLaundryWeight,
  WEIGHT_MAX_KG,
  calculateTotalAmount,
  formatCurrency,
  formatDate,
  formatShortBookingId,
  getAmountToBePaid,
  getBookingId,
  getContactNumber,
  getCustomerName,
  getDeliveryFee,
  getInitialPayment,
  getInitials,
  getPayment,
  getPickupLocation,
  getServiceArray,
  getServices,
  getStatusClass,
  getTotalAmount,
  getWeight,
} from "./bookingHelpers";

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

const STATUS_FILTER_OPTIONS = [
  "All",
  "Pending",
  "Accepted",
  "Ready for Pickup",
  "In Laundry",
  "To Deliver",
  "Delivered",
  "Declined",
];

function isBookingArchived(booking) {
  return Boolean(booking?.archived) || booking?.status === "Archived";
}

function normalizeFilterStatus(status) {
  if (["Picked Up", "Washing", "Drying", "Folding"].includes(status)) {
    return "In Laundry";
  }
  if (status === "Ready for Customer Pickup") {
    return "To Deliver";
  }
  if (status === "Completed") {
    return "Delivered";
  }
  return status || "Pending";
}

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

function getPaymentReference(booking) {
  const payment = getPayment(booking);

  return (
    payment?.reference_number ||
    payment?.referenceNumber ||
    payment?.gcashReference ||
    payment?.reference ||
    "N/A"
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capacityStatus, setCapacityStatus] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [listFilter, setListFilter] = useState("active");
  const [archivingId, setArchivingId] = useState(null);
  const [archiveConfirmBooking, setArchiveConfirmBooking] =
    useState(null);

  const [showStatusModal, setShowStatusModal] =
    useState(false);

  const [selectedBooking, setSelectedBooking] =
    useState(null);

  const [editableWeight, setEditableWeight] =
    useState("");

  const [weightError, setWeightError] =
    useState("");

  const [notification, setNotification] =
    useState("");

  const [updating, setUpdating] =
    useState(false);

  const [riderLocation, setRiderLocation] =
    useState(null);

  const [riderLocationError, setRiderLocationError] =
    useState("");

  const [services, setServices] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);

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

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  useEffect(() => {
    if (!user?.uid) return undefined;

    return subscribeToStaffBookings(
      user.uid,
      (staffBookings) => {
        setBookings(staffBookings);
        setSelectedBooking((selected) =>
          selected
            ? staffBookings.find((booking) => booking.id === selected.id) || selected
            : selected
        );
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load staff bookings:", error);
        setNotification("Unable to load bookings from Firestore.");
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

  useEffect(() => {
    if (
      !showStatusModal ||
      !["Ready for Pickup", "To Deliver"].includes(
        selectedBooking?.status
      )
    ) {
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
  }, [selectedBooking?.status, showStatusModal]);

  /* =======================================================
     OPEN STATUS MODAL
  ======================================================= */

  const handleUpdateStatus = (booking) => {
    setRiderLocation(null);
    setRiderLocationError("");
    setSelectedBooking(booking);
    setWeightError("");

    setEditableWeight(
      getWeight(booking)
        ? String(getWeight(booking))
        : ""
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
      if (newStatus === "Accepted") {
        await acceptBooking(bookingId, user.uid);
      } else if (selectedBooking?.status === "Pending") {
        await declinePendingBooking(bookingId, user.uid);
      } else {
        await updateStaffBookingStatus(
          bookingId,
          user.uid,
          newStatus
        );
      }

      const updatedBooking = {
        ...selectedBooking,
        staff_id: user.uid,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus !== "Ready for Pickup" && newStatus !== "To Deliver") {
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
     ACCEPT
  ======================================================= */

  const handleAcceptBooking = () => {
    if (!selectedBooking) return;

    updateBookingStatus(
      selectedBooking.id,
      "Accepted"
    );
  };

  /* =======================================================
     DECLINE
  ======================================================= */

  const handleDeclineBooking = () => {
    if (!selectedBooking) return;

    setConfirmAction({
      bookingId: selectedBooking.id,
      nextStatus: "Declined",
      variant: "danger",
      title: "Decline this booking?",
      message: "Are you sure you want to decline this booking?",
      confirmLabel: "Yes, Decline",
      loadingLabel: "Declining...",
      closeAfter: true,
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
      ],
    });
  };

  /* =======================================================
     READY FOR PICKUP
  ======================================================= */

  const handleReadyForPickup = () => {
    if (!selectedBooking) return;

    updateBookingStatus(
      selectedBooking.id,
      "Ready for Pickup"
    );
  };

  /* =======================================================
     PICKED UP
  ======================================================= */

  const handlePickedUp = () => {
    if (!selectedBooking) return;

    const weight = Number(
      getWeight(selectedBooking)
    );

    if (!weight || weight <= 0) {
      setNotification(
        "Please enter and save the laundry weight first."
      );

      return;
    }

    updateBookingStatus(
      selectedBooking.id,
      "In Laundry"
    );
  };

  /* =======================================================
     DELIVER
     
     IN LAUNDRY → TO DELIVER
  ======================================================= */

  const handleDeliver = () => {
    if (!selectedBooking) return;

    updateBookingStatus(
      selectedBooking.id,
      "To Deliver"
    );
  };

  /* =======================================================
     DELIVERED
     
     TO DELIVER → DELIVERED
  ======================================================= */

  const handleDelivered = () => {
    if (!selectedBooking) return;

    setConfirmAction({
      bookingId: selectedBooking.id,
      nextStatus: "Delivered",
      variant: "success",
      title: "Mark as delivered?",
      message:
        "Are you sure this laundry order has been delivered to the customer?",
      confirmLabel: "Yes, Delivered",
      loadingLabel: "Updating...",
      closeAfter: true,
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
        {
          label: "Amount Due",
          value: formatCurrency(getAmountToBePaid(selectedBooking)),
        },
      ],
    });
  };

  const closeConfirmAction = () => {
    if (updating) return;
    setConfirmAction(null);
  };

  const confirmStatusAction = async () => {
    if (!confirmAction?.bookingId || !confirmAction?.nextStatus) return;

    const result = await updateBookingStatus(
      confirmAction.bookingId,
      confirmAction.nextStatus
    );

    if (result) {
      setConfirmAction(null);
      if (confirmAction.closeAfter) {
        closeStatusModal();
      }
    }
  };

  /* =======================================================
     SAVE WEIGHT
  ======================================================= */

  const handleSaveWeight = async () => {
    if (!selectedBooking) return;

    const weight = Number(editableWeight);
    const weightValidationError = validateLaundryWeight(editableWeight);

    if (weightValidationError) {
      setWeightError(weightValidationError);
      return;
    }

    setWeightError("");
    setUpdating(true);

    try {
      const currentBooking = selectedBooking;

      const serviceRate =
        getServiceRate(currentBooking);

      const laundrySubtotal =
        calculateLaundrySubtotal(
          currentBooking,
          weight
        );

      const deliveryFee =
        getDeliveryFee(currentBooking);

      const totalAmount =
        laundrySubtotal + deliveryFee;

      const initialPayment =
        getInitialPayment(currentBooking);

      const amountToBePaid =
        Math.max(
          0,
          totalAmount - initialPayment
        );

      const bookingDetails = {
        weight,
        laundryWeight: weight,
        kg: weight,
        serviceRate,
        service_rate: serviceRate,
        laundrySubtotal,
        laundry_subtotal: laundrySubtotal,
        deliveryFee,
        delivery_fee: deliveryFee,
        totalAmount,
        total_amount: totalAmount,
        estimatedTotal: totalAmount,
        initialPayment,
        initial_payment: initialPayment,
        amountToBePaid,
        amount_to_be_paid: amountToBePaid,
      };

      await updateStaffBookingDetails(
        selectedBooking.id,
        user.uid,
        bookingDetails
      );

      const updatedBooking = {
        ...currentBooking,
        ...bookingDetails,
        updatedAt: new Date().toISOString(),
      };

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking
        )
      );
      setSelectedBooking(updatedBooking);

      window.dispatchEvent(
        new Event("laundrymateBookingUpdated")
      );

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
      console.error(error);

      setNotification(
        error.message || "Unable to update weight."
      );
    } finally {
      setUpdating(false);
    }
  };

  /* =======================================================
     ARCHIVE / RESTORE
  ======================================================= */

  const openArchiveConfirm = (booking) => {
    if (!booking?.id) return;
    setArchiveConfirmBooking(booking);
  };

  const closeArchiveConfirm = () => {
    if (archivingId) return;
    setArchiveConfirmBooking(null);
  };

  const confirmArchiveBooking = async () => {
    const booking = archiveConfirmBooking;
    if (!booking?.id) return;

    const archived = isBookingArchived(booking);

    setArchivingId(booking.id);
    try {
      if (archived) {
        await unarchiveBooking(booking.id);
        setNotification("Booking restored to active transactions.");
      } else {
        await archiveBooking(booking.id);
        setNotification("Booking archived.");
        if (selectedBooking?.id === booking.id) {
          closeStatusModal();
        }
      }
      setArchiveConfirmBooking(null);
    } catch (error) {
      console.error(error);
      setNotification(
        archived
          ? "Unable to restore booking."
          : "Unable to archive booking."
      );
    } finally {
      setArchivingId(null);
    }
  };

  /* =======================================================
     FILTER
  ======================================================= */

  
  useEffect(() => {
    return subscribeToDailyBookingCapacityStatus(
      getLocalDateKey(),
      (status) => setCapacityStatus(status),
      (error) => {
        console.error("Unable to load daily capacity:", error);
        setCapacityStatus(null);
      }
    );
  }, []);

  const activeBookingsCount = useMemo(
    () => bookings.filter((booking) => !isBookingArchived(booking)).length,
    [bookings]
  );

  const archivedBookingsCount = useMemo(
    () => bookings.filter((booking) => isBookingArchived(booking)).length,
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        const archived = isBookingArchived(booking);
        if (listFilter === "archived" ? !archived : archived) {
          return false;
        }

        const normalizedStatus = normalizeFilterStatus(booking.status);
        if (
          statusFilter !== "All" &&
          normalizedStatus !== statusFilter
        ) {
          return false;
        }

        const query = search.trim().toLowerCase();
        if (!query) return true;

        const bookingId = getBookingId(booking);
        const searchableText = [
          bookingId,
          formatShortBookingId(bookingId),
          booking.booking_id,
          booking.bookingId,
          getCustomerName(booking),
          getServices(booking),
          getPickupLocation(booking),
          getContactNumber(booking),
          getWeight(booking),
          booking.status,
        ]
          .filter(
            (value) =>
              value !== undefined &&
              value !== null
          )
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      })
      .sort((a, b) => {
        const dateA = a.booking_date || a.created_at || a.createdAt || a.schedule;
        const dateB = b.booking_date || b.created_at || b.createdAt || b.schedule;
        const timestampA =
          typeof dateA?.toDate === "function"
            ? dateA.toDate().getTime()
            : new Date(dateA || 0).getTime();
        const timestampB =
          typeof dateB?.toDate === "function"
            ? dateB.toDate().getTime()
            : new Date(dateB || 0).getTime();

        return timestampB - timestampA;
      });
  }, [bookings, search, statusFilter, listFilter]);

  /* =======================================================
     STATUS CLASS
  ======================================================= */

  const pickupCoordinates = selectedBooking
    ? getCoordinates(selectedBooking)
    : null;

  const mapCenter =
    pickupCoordinates || riderLocation;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="staff-bookings">

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
          <h1>
            {listFilter === "archived"
              ? "Archived Bookings"
              : "Assigned Bookings"}
          </h1>

          <p>
            {listFilter === "archived"
              ? "Restore archived transactions or keep them out of the active list."
              : "Manage customer bookings, laundry details, payments, and pickup status."}
          </p>
        </div>

        <div className="header-count-stack">
          <div className="booking-count">
            {filteredBookings.length}{" "}
            {filteredBookings.length === 1
              ? "Booking"
              : "Bookings"}
          </div>
          {capacityStatus && !capacityStatus.unlimited && (
            <div className={"booking-count" + (capacityStatus.isFull ? " capacity-full" : "")}>
              Today {capacityStatus.used}/{capacityStatus.max}
              {capacityStatus.closed || capacityStatus.max <= 0
                ? " CLOSED"
                : capacityStatus.isFull
                  ? " FULL"
                  : ""}
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          FILTERS
      ================================================= */}

      <div className="filters">
        <div className="booking-filter-tabs">
          <button
            type="button"
            className={listFilter === "active" ? "active" : ""}
            onClick={() => setListFilter("active")}
          >
            Active ({activeBookingsCount})
          </button>
          <button
            type="button"
            className={listFilter === "archived" ? "active" : ""}
            onClick={() => setListFilter("archived")}
          >
            Archived ({archivedBookingsCount})
          </button>
        </div>

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

          <div className="filter-select-wrapper">
            <label htmlFor="bookingStatusFilter">Status</label>
            <select
              id="bookingStatusFilter"
              className="filter-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "All" ? "All status" : status}
                </option>
              ))}
            </select>
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
                  Loading bookings from Firestore...
                </td>
              </tr>
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => {
                const customerName =
                  getCustomerName(booking);

                const weight =
                  getWeight(booking);

                const pickupLocation =
                  getPickupLocation(booking);

                const servicesLabel =
                  getServices(booking);

                const fullBookingId = getBookingId(booking);
                const bookingIdLabel = formatShortBookingId(fullBookingId);

                return (
                  <tr key={booking.id || fullBookingId}>
                    <td>
                      <span
                        className="booking-id"
                        title={`#${fullBookingId}`}
                      >
                        #{bookingIdLabel}
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
                          <div
                            className="customer-name"
                            title={customerName}
                          >
                            {customerName}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className="contact-number"
                        title={getContactNumber(booking)}
                      >
                        {getContactNumber(booking)}
                      </span>
                    </td>

                    <td>
                      <span
                        className="service-name"
                        title={servicesLabel}
                      >
                        {servicesLabel}
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
                      <div
                        className="pickup-location"
                        title={pickupLocation}
                      >
                        {pickupLocation}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status ${getStatusClass(
                          booking.status
                        )}`}
                      >
                        {booking.status ||
                          "Pending"}
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
                      <div className="booking-actions">
                        <button
                          type="button"
                          className="update-status-btn"
                          disabled={updating || archivingId === booking.id}
                          onClick={() =>
                            handleUpdateStatus(
                              booking
                            )
                          }
                          aria-label={`Review booking ${booking.id}, status ${booking.status || "Pending"}`}
                        >
                          {booking.status === "Pending"
                            ? "Review"
                            : booking.status === "Accepted"
                              ? "Continue"
                              : "Details"}
                        </button>

                        <button
                          type="button"
                          className="archive-booking-btn"
                          disabled={updating || archivingId === booking.id}
                          onClick={() =>
                            openArchiveConfirm(booking)
                          }
                          title={
                            isBookingArchived(booking)
                              ? "Restore booking"
                              : "Archive booking"
                          }
                          aria-label={
                            isBookingArchived(booking)
                              ? `Restore booking ${booking.id}`
                              : `Archive booking ${booking.id}`
                          }
                        >
                          {archivingId === booking.id
                            ? "…"
                            : isBookingArchived(booking)
                              ? "Restore"
                              : "Archive"}
                        </button>
                      </div>
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
                    {search || statusFilter !== "All"
                      ? "Try changing your search or filters."
                      : listFilter === "archived"
                        ? "No archived bookings yet."
                        : "Assigned bookings will appear here."}
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
                    {selectedBooking.status ||
                      "Booking Status"}
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
                    <button
                      type="button"
                      className="accept-btn"
                      onClick={
                        handleAcceptBooking
                      }
                      disabled={updating}
                    >
                      {updating
                        ? "Updating..."
                        : "Accept"}
                    </button>

                    <button
                      type="button"
                      className="decline-btn"
                      onClick={
                        handleDeclineBooking
                      }
                      disabled={updating}
                    >
                      Decline
                    </button>
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
                    <button
                      type="button"
                      className="pickup-btn"
                      onClick={
                        handleReadyForPickup
                      }
                      disabled={updating}
                    >
                      Ready for Pickup
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
                          Customer coordinates
                          were not saved.
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

                  {/* WEIGHT */}

                  <div className="pickup-summary">
                    <div className="pickup-summary-title">
                      Payment Calculation
                    </div>

                    <div className="weight-editor">
                      <label>
                        Actual Laundry Weight
                      </label>

                      <div className="weight-input-row">
                        <input
                          type="number"
                          min="0.1"
                          max={WEIGHT_MAX_KG}
                          step="0.1"
                          value={
                            editableWeight
                          }
                          onChange={(event) => {
                            const rawValue = event.target.value;

                            if (rawValue !== "" && Number(rawValue) <= 0) {
                              setWeightError(
                                "Weight must be greater than 0 kg."
                              );
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
                        Rate: {getWeightPricingLabel()}
                      </small>
                    </div>

                    <PaymentRow
                      label="Weight"
                      value={
                        editableWeight
                          ? `${editableWeight} kg`
                          : "Not set"
                      }
                    />

                    <PaymentRow
                      label="Laundry Subtotal"
                      value={formatCurrency(
                        calculateLaundrySubtotal(
                          selectedBooking,
                          editableWeight
                        )
                      )}
                    />

                    <PaymentRow
                      label="Delivery Fee"
                      value={formatCurrency(
                        getDeliveryFee(
                          selectedBooking
                        )
                      )}
                    />

                    <PaymentRow
                      label="Total Amount"
                      value={formatCurrency(
                        calculateTotalAmount(
                          selectedBooking,
                          editableWeight
                        )
                      )}
                      highlight
                    />

                    <PaymentRow
                      label="Initial Payment"
                      value={formatCurrency(
                        getInitialPayment(
                          selectedBooking
                        )
                      )}
                    />

                    <PaymentRow
                      label="Amount to be Paid"
                      value={formatCurrency(
                        Math.max(
                          0,
                          calculateTotalAmount(
                            selectedBooking,
                            editableWeight
                          ) -
                            getInitialPayment(
                              selectedBooking
                            )
                        )
                      )}
                      balance
                    />

                    {getInitialPayment(selectedBooking) >
                      calculateTotalAmount(
                        selectedBooking,
                        editableWeight
                      ) && (
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
                      onClick={
                        handleSaveWeight
                      }
                      disabled={updating}
                    >
                      {updating
                        ? "Updating..."
                        : "Update Weight & Amount"}
                    </button>
                  </div>

                  <div className="status-actions">
                    <button
                      type="button"
                      className="pickup-btn"
                      onClick={
                        handlePickedUp
                      }
                      disabled={
                        updating ||
                        !getWeight(
                          selectedBooking
                        )
                      }
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
                  
                  CLICK DELIVER → TO DELIVER
              ================================================= */}

              {selectedBooking.status ===
                "In Laundry" && (
                <div className="in-laundry-screen">

                  <div className="laundry-info-list">
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
                      value="In Laundry"
                      status
                    />
                  </div>

                  <div className="image-style-action">
                    <button
                      type="button"
                      className="deliver-btn"
                      onClick={
                        handleDeliver
                      }
                      disabled={updating}
                    >
                      {updating
                        ? "Updating..."
                        : "Deliver"}
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
                  TO DELIVER
                  
                  THIS IS THE SCREEN FROM YOUR IMAGE
              ================================================= */}

              {selectedBooking.status ===
                "To Deliver" && (
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

              {selectedBooking.status ===
                "Delivered" && (
                <>
                  <div className="completed-message">

                    <div className="completed-icon">
                      ✓
                    </div>

                    <h3>
                      Booking Completed
                    </h3>

                    <p>
                      The laundry order has
                      been successfully
                      delivered to the
                      customer.
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

      {/* =================================================
          ARCHIVE CONFIRM MODAL
      ================================================= */}

      {archiveConfirmBooking && (
        <div
          className="status-modal-overlay archive-confirm-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeArchiveConfirm();
            }
          }}
        >
          <div
            className="archive-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-confirm-title"
          >
            <div className="archive-confirm-icon-wrap">
              <span
                className={`archive-confirm-icon ${
                  isBookingArchived(archiveConfirmBooking)
                    ? "restore"
                    : "archive"
                }`}
                aria-hidden="true"
              >
                {isBookingArchived(archiveConfirmBooking) ? "↺" : "📦"}
              </span>
            </div>

            <h2 id="archive-confirm-title">
              {isBookingArchived(archiveConfirmBooking)
                ? "Restore booking?"
                : "Archive booking?"}
            </h2>

            <p className="archive-confirm-message">
              {isBookingArchived(archiveConfirmBooking)
                ? "This booking will return to the active transactions list."
                : "It will be hidden from the active transactions list. You can restore it anytime from Archived."}
            </p>

            <div className="archive-confirm-meta">
              <div>
                <span>Booking ID</span>
                <strong>#{formatShortBookingId(archiveConfirmBooking)}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>
                  {getCustomerName(archiveConfirmBooking)}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  {archiveConfirmBooking.status || "Pending"}
                </strong>
              </div>
            </div>

            <div className="archive-confirm-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={Boolean(archivingId)}
                onClick={closeArchiveConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  isBookingArchived(archiveConfirmBooking)
                    ? "accept-btn"
                    : "archive-confirm-btn"
                }
                disabled={Boolean(archivingId)}
                onClick={confirmArchiveBooking}
              >
                {archivingId
                  ? isBookingArchived(archiveConfirmBooking)
                    ? "Restoring..."
                    : "Archiving..."
                  : isBookingArchived(archiveConfirmBooking)
                    ? "Restore Booking"
                    : "Archive Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        loading={updating}
        variant={confirmAction?.variant || "danger"}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        loadingLabel={confirmAction?.loadingLabel}
        meta={confirmAction?.meta}
        onCancel={closeConfirmAction}
        onConfirm={confirmStatusAction}
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
   PAYMENT ROW
========================================================= */

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

export default Bookings;