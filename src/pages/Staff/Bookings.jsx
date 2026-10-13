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
import { notifyBookingStatusChanged } from "../../services/notificationService";

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
   STATUS FLOW
========================================================= */

const STATUS_FLOW = [
  "Pending",
  "Accepted",
  "Ready for Pickup",
  "Picked Up",
  "In Laundry",
  "To Deliver",
  "Delivered",
];

/* =========================================================
   SERVICE PRICES
========================================================= */

const SERVICE_PRICES = {
  "Wash & Fold": 80,
  "Dry Cleaning": 150,
  Ironing: 60,
  "Bedding Care": 200,
};

/* =========================================================
   DELIVERY FEES
========================================================= */

const DELIVERY_FEES = {
  "Pickup & Delivery": 30,
  "Pickup Only": 20,
};

/* =========================================================
   STORAGE
========================================================= */

function readBookings() {
  try {
    const data = JSON.parse(
      localStorage.getItem("laundrymateBookings") || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Unable to read bookings:", error);
    return [];
  }
}

function readPayments() {
  try {
    const data = JSON.parse(
      localStorage.getItem("laundrymatePayments") || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Unable to read payments:", error);
    return [];
  }
}

/* =========================================================
   PAYMENT
========================================================= */

function getPayment(bookingId) {
  const payments = readPayments();

  return (
    payments.find(
      (payment) =>
        String(payment.bookingId) === String(bookingId) ||
        String(payment.bookingID) === String(bookingId)
    ) || null
  );
}

/* =========================================================
   CUSTOMER
========================================================= */

function getCustomerName(booking) {
  if (!booking) return "Unknown Customer";

  const name =
    booking.customerName ||
    booking.name ||
    booking.fullName ||
    booking.displayName ||
    booking.customer?.name ||
    booking.customer?.fullName ||
    booking.userName;

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

  if (Array.isArray(booking.services)) {
    return booking.services;
  }

  if (typeof booking.services === "string") {
    return booking.services
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (booking.service) {
    return [booking.service];
  }

  return [];
}

function getServices(booking) {
  const services = getServiceArray(booking);

  return services.length
    ? services.join(", ")
    : "Laundry Service";
}

function getServiceRate(booking) {
  const services = getServiceArray(booking);

  return services.reduce((total, service) => {
    return total + (SERVICE_PRICES[service] || 0);
  }, 0);
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

  const pickupType =
    booking.pickupType ||
    booking.deliveryType ||
    "Pickup & Delivery";

  return DELIVERY_FEES[pickupType] || 0;
}

/* =========================================================
   PRICE CALCULATIONS
========================================================= */

function calculateLaundrySubtotal(booking, weight) {
  const kg = Number(weight);

  if (!kg || kg <= 0) return 0;

  return kg * getServiceRate(booking);
}

function calculateTotalAmount(booking, weight) {
  return (
    calculateLaundrySubtotal(booking, weight) +
    getDeliveryFee(booking)
  );
}

/* =========================================================
   INITIAL PAYMENT
========================================================= */

function getInitialPayment(booking) {
  if (!booking) return 0;

  const payment = getPayment(booking.id);

  const amount = Number(
    booking.initialPayment ??
      booking.downPayment ??
      booking.paymentAmount ??
      booking.amountPaid ??
      booking.initialPaid ??
      payment?.initialPayment ??
      payment?.amountPaid ??
      payment?.amount ??
      0
  );

  return Number.isNaN(amount) ? 0 : amount;
}

/* =========================================================
   TOTAL
========================================================= */

function getTotalAmount(booking) {
  if (!booking) return 0;

  const weight = getWeight(booking);

  if (weight !== "" && Number(weight) > 0) {
    return calculateTotalAmount(booking, weight);
  }

  const payment = getPayment(booking.id);

  const total = Number(
    booking.totalAmount ??
      booking.total ??
      booking.amount ??
      booking.grandTotal ??
      booking.price ??
      booking.estimatedTotal ??
      payment?.totalAmount ??
      payment?.amount ??
      0
  );

  return Number.isNaN(total) ? 0 : total;
}

function getAmountToBePaid(booking) {
  const total = getTotalAmount(booking);
  const initial = getInitialPayment(booking);

  return Math.max(0, total - initial);
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
      booking.barangay,
      booking.city,
      booking.province,
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getPaymentReference(bookingId) {
  const payment = getPayment(bookingId);

  return (
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
  const [bookings, setBookings] = useState(readBookings);
  const [search, setSearch] = useState("");

  const [showStatusModal, setShowStatusModal] =
    useState(false);

  const [selectedBooking, setSelectedBooking] =
    useState(null);

  const [editableWeight, setEditableWeight] =
    useState("");

  const [notification, setNotification] =
    useState("");

  const [updating, setUpdating] =
    useState(false);

  const [riderLocation, setRiderLocation] =
    useState(null);

  const [riderLocationError, setRiderLocationError] =
    useState("");

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  const loadBookings = () => {
    setBookings(readBookings());
  };

  useEffect(() => {
    const handleUpdate = () => {
      loadBookings();
    };

    window.addEventListener(
      "storage",
      handleUpdate
    );

    window.addEventListener(
      "laundrymateBookingUpdated",
      handleUpdate
    );

    window.addEventListener(
      "laundrymatePaymentUpdated",
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleUpdate
      );

      window.removeEventListener(
        "laundrymateBookingUpdated",
        handleUpdate
      );

      window.removeEventListener(
        "laundrymatePaymentUpdated",
        handleUpdate
      );
    };
  }, []);

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

        setRiderLocationError(
          messages[error.code] ||
            "Unable to access your live location."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
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
      const storedBookings = readBookings();

      const updatedBookings =
        storedBookings.map((booking) => {
          if (
            String(booking.id) !==
            String(bookingId)
          ) {
            return booking;
          }

          return {
            ...booking,
            status: newStatus,
            updatedAt:
              new Date().toISOString(),
          };
        });

      localStorage.setItem(
        "laundrymateBookings",
        JSON.stringify(updatedBookings)
      );

      /* Update payment status */

      const payments = readPayments();

      const updatedPayments =
        payments.map((payment) => {
          if (
            String(payment.bookingId) !==
              String(bookingId) &&
            String(payment.bookingID) !==
              String(bookingId)
          ) {
            return payment;
          }

          return {
            ...payment,
            bookingStatus: newStatus,
            updatedAt:
              new Date().toISOString(),
          };
        });

      localStorage.setItem(
        "laundrymatePayments",
        JSON.stringify(updatedPayments)
      );

      const updatedBooking =
        updatedBookings.find(
          (booking) =>
            String(booking.id) ===
            String(bookingId)
        );

      if (newStatus !== "Ready for Pickup" && newStatus !== "To Deliver") {
        setRiderLocation(null);
        setRiderLocationError("");
      }

      setBookings(updatedBookings);
      setSelectedBooking(updatedBooking);

      window.dispatchEvent(
        new Event("laundrymateBookingUpdated")
      );

      window.dispatchEvent(
        new Event("laundrymatePaymentUpdated")
      );

      const relatedPayment = payments.find(
        (payment) =>
          String(payment.bookingId) === String(bookingId) ||
          String(payment.bookingID) === String(bookingId)
      );
      const customerId =
        updatedBooking?.userId ||
        updatedBooking?.customerId ||
        updatedBooking?.customer_id ||
        updatedBooking?.customer?.uid ||
        relatedPayment?.userId ||
        relatedPayment?.customerId;

      if (customerId) {
        try {
          await notifyBookingStatusChanged(
            customerId,
            bookingId,
            newStatus
          );
          setNotification(
            `Booking status updated to "${newStatus}" and customer notified.`
          );
        } catch (error) {
          console.error("Unable to notify customer of booking status:", error);
          setNotification(
            `Booking status updated to "${newStatus}", but the customer notification could not be sent.`
          );
        }
      } else {
        console.warn(
          `Booking ${bookingId} has no customer user ID; status notification was not sent.`
        );
        setNotification(
          `Booking status updated to "${newStatus}", but the customer could not be identified for notification.`
        );
      }

      return updatedBooking;
    } catch (error) {
      console.error(error);

      setNotification(
        "Unable to update booking status."
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

    const confirmed = window.confirm(
      "Are you sure you want to decline this booking?"
    );

    if (!confirmed) return;

    updateBookingStatus(
      selectedBooking.id,
      "Declined"
    );
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

    const confirmed = window.confirm(
      "Are you sure this laundry order has been delivered to the customer?"
    );

    if (!confirmed) return;

    updateBookingStatus(
      selectedBooking.id,
      "Delivered"
    );
  };

  /* =======================================================
     SAVE WEIGHT
  ======================================================= */

  const handleSaveWeight = () => {
    if (!selectedBooking) return;

    const weight = Number(
      editableWeight
    );

    if (
      editableWeight === "" ||
      Number.isNaN(weight) ||
      weight <= 0
    ) {
      setNotification(
        "Please enter a valid weight greater than 0 kg."
      );

      return;
    }

    setUpdating(true);

    try {
      const storedBookings = readBookings();

      const currentBooking =
        storedBookings.find(
          (booking) =>
            String(booking.id) ===
            String(selectedBooking.id)
        );

      if (!currentBooking) {
        setNotification(
          "Booking could not be found."
        );

        return;
      }

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

      const updatedBookings =
        storedBookings.map((booking) => {
          if (
            String(booking.id) !==
            String(selectedBooking.id)
          ) {
            return booking;
          }

          return {
            ...booking,

            weight,
            laundryWeight: weight,
            kg: weight,

            serviceRate,

            laundrySubtotal,

            deliveryFee,

            totalAmount,

            estimatedTotal: totalAmount,

            amountToBePaid,

            updatedAt:
              new Date().toISOString(),
          };
        });

      localStorage.setItem(
        "laundrymateBookings",
        JSON.stringify(updatedBookings)
      );

      /* Update payment */

      const payments = readPayments();

      const updatedPayments =
        payments.map((payment) => {
          if (
            String(payment.bookingId) !==
              String(selectedBooking.id) &&
            String(payment.bookingID) !==
              String(selectedBooking.id)
          ) {
            return payment;
          }

          return {
            ...payment,

            weight,
            laundryWeight: weight,
            kg: weight,

            serviceRate,

            laundrySubtotal,

            deliveryFee,

            totalAmount,

            amount: totalAmount,

            amountToBePaid,

            bookingStatus:
              currentBooking.status,

            updatedAt:
              new Date().toISOString(),
          };
        });

      localStorage.setItem(
        "laundrymatePayments",
        JSON.stringify(updatedPayments)
      );

      const updatedBooking =
        updatedBookings.find(
          (booking) =>
            String(booking.id) ===
            String(selectedBooking.id)
        );

      setBookings(updatedBookings);
      setSelectedBooking(updatedBooking);

      window.dispatchEvent(
        new Event("laundrymateBookingUpdated")
      );

      window.dispatchEvent(
        new Event("laundrymatePaymentUpdated")
      );

      setNotification(
        `Weight updated to ${weight} kg. Total amount is ${formatCurrency(
          totalAmount
        )}.`
      );
    } catch (error) {
      console.error(error);

      setNotification(
        "Unable to update weight."
      );
    } finally {
      setUpdating(false);
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

        const searchableText = [
          booking.id,
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

        return (
          !query ||
          searchableText.includes(query)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.createdAt ||
            a.updatedAt ||
            a.schedule ||
            0
        ).getTime();

        const dateB = new Date(
          b.createdAt ||
            b.updatedAt ||
            b.schedule ||
            0
        ).getTime();

        return dateB - dateA;
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
          <h1>Assigned Bookings</h1>

          <p>
            Manage customer bookings,
            laundry details, payments,
            and pickup status.
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

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="table-container">
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
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
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => {
                const customerName =
                  getCustomerName(booking);

                const weight =
                  getWeight(booking);

                return (
                  <tr key={booking.id}>
                    <td>
                      <span className="booking-id">
                        #{booking.id || "N/A"}
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
                          booking.status
                        )}`}
                      >
                        {booking.status ||
                          "Pending"}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        booking.schedule
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="update-status-btn"
                        onClick={() =>
                          handleUpdateStatus(
                            booking
                          )
                        }
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="11"
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
                    {selectedBooking.status ||
                      "Booking Status"}
                  </h2>

                  <p>
                    Booking #
                    {selectedBooking.id}
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
                        selectedBooking.id
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
                        selectedBooking.id
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
                          step="0.1"
                          value={
                            editableWeight
                          }
                          onChange={(event) =>
                            setEditableWeight(
                              event.target.value
                            )
                          }
                          placeholder="Enter weight"
                          disabled={updating}
                        />

                        <span>kg</span>
                      </div>

                      <small>
                        Service rate:{" "}
                        {formatCurrency(
                          getServiceRate(
                            selectedBooking
                          )
                        )}
                        /kg
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