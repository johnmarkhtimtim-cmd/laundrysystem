import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/CustomerMap.css";

// Fix Leaflet marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Default map center: Isabela area
const DEFAULT_LOCATION = [17.0400, 121.8500];

// ==========================================
// READ BOOKINGS
// ==========================================

function readBookings() {
  try {
    const saved = localStorage.getItem("laundrymateBookings");
    const bookings = saved ? JSON.parse(saved) : [];

    return Array.isArray(bookings) ? bookings : [];
  } catch (error) {
    console.error("Error reading bookings:", error);
    return [];
  }
}

// ==========================================
// GET CUSTOMER NAME
// ==========================================

function getCustomerName(booking) {
  return (
    booking.customerName ||
    booking.customer_name ||
    booking.userName ||
    booking.name ||
    booking.customer?.name ||
    booking.user?.name ||
    booking.user?.displayName ||
    "Unknown Customer"
  );
}

// ==========================================
// GET CUSTOMER ADDRESS
// ==========================================

function getCustomerAddress(booking) {
  if (booking.address) {
    return booking.address;
  }

  if (booking.pickupAddress) {
    return booking.pickupAddress;
  }

  if (booking.pickup_address) {
    return booking.pickup_address;
  }

  const parts = [
    booking.barangay,
    booking.city,
    booking.province,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(", ")
    : "Address not available";
}

// ==========================================
// GET COORDINATES
// ==========================================

function getCoordinates(booking) {
  // Supports different coordinate field names
  const latitude = Number(
    booking.latitude ??
      booking.lat ??
      booking.pickupLatitude ??
      booking.pickup_latitude ??
      booking.location?.latitude ??
      booking.location?.lat
  );

  const longitude = Number(
    booking.longitude ??
      booking.lng ??
      booking.lon ??
      booking.pickupLongitude ??
      booking.pickup_longitude ??
      booking.location?.longitude ??
      booking.location?.lng
  );

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return [latitude, longitude];
  }

  return null;
}

// ==========================================
// MAP CONTROLLER
// ==========================================

function MapController({ selectedCustomer }) {
  const map = useMap();

  useEffect(() => {
    if (selectedCustomer?.coordinates) {
      map.flyTo(selectedCustomer.coordinates, 16, {
        duration: 1.2,
      });
    }
  }, [selectedCustomer, map]);

  return null;
}

// ==========================================
// CUSTOMER MAP
// ==========================================

function CustomerMap() {
  const [bookings, setBookings] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");

  // Load bookings
  useEffect(() => {
    const loadBookings = () => {
      setBookings(readBookings());
    };

    loadBookings();

    // Listen for booking updates
    window.addEventListener("storage", loadBookings);
    window.addEventListener("laundrymateBookingUpdated", loadBookings);
    window.addEventListener("laundrymateBookingsUpdated", loadBookings);

    // Refresh when returning to the page
    window.addEventListener("focus", loadBookings);

    return () => {
      window.removeEventListener("storage", loadBookings);
      window.removeEventListener(
        "laundrymateBookingUpdated",
        loadBookings
      );
      window.removeEventListener(
        "laundrymateBookingsUpdated",
        loadBookings
      );
      window.removeEventListener("focus", loadBookings);
    };
  }, []);

  // Only bookings with valid coordinates
  const mappedCustomers = useMemo(() => {
    return bookings
      .map((booking) => {
        const coordinates = getCoordinates(booking);

        return {
          ...booking,
          customerName: getCustomerName(booking),
          customerAddress: getCustomerAddress(booking),
          coordinates,
        };
      })
      .filter((booking) => booking.coordinates !== null);
  }, [bookings]);

  // Search customers
  const filteredCustomers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return mappedCustomers;

    return mappedCustomers.filter((customer) => {
      const name = customer.customerName.toLowerCase();
      const address = customer.customerAddress.toLowerCase();
      const bookingId = String(
        customer.bookingId || customer.id || ""
      ).toLowerCase();

      return (
        name.includes(keyword) ||
        address.includes(keyword) ||
        bookingId.includes(keyword)
      );
    });
  }, [mappedCustomers, search]);

  // Select first customer when needed
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
  };

  // Open Google Maps directions
  const handleNavigate = (customer) => {
    if (!customer?.coordinates) return;

    const [latitude, longitude] = customer.coordinates;

    const googleMapsUrl =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${latitude},${longitude}`;

    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="customer-map-page">
      {/* HEADER */}
      <div className="customer-map-header">
        <div>
          <span className="customer-map-eyebrow">
            RIDER TOOLS
          </span>

          <h1>Customer Map</h1>

          <p>
            View customer pickup locations and navigate to
            assigned bookings.
          </p>
        </div>

        <div className="map-header-stat">
          <span className="stat-number">
            {mappedCustomers.length}
          </span>
          <span className="stat-label">Mapped Customers</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="customer-map-layout">
        {/* LEFT CUSTOMER LIST */}
        <aside className="customer-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Customer Locations</h2>
              <p>
                {filteredCustomers.length} customer
                {filteredCustomers.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="customer-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search customer or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="customer-list">
            {filteredCustomers.length === 0 ? (
              <div className="empty-map-list">
                <div className="empty-map-icon">📍</div>

                <h3>No customer locations</h3>

                <p>
                  Customers with saved pickup coordinates
                  will appear here.
                </p>
              </div>
            ) : (
              filteredCustomers.map((customer, index) => {
                const bookingId =
                  customer.bookingId ||
                  customer.id ||
                  `Booking ${index + 1}`;

                const isSelected =
                  selectedCustomer?.id === customer.id ||
                  selectedCustomer?.bookingId ===
                    customer.bookingId;

                return (
                  <button
                    key={`${bookingId}-${index}`}
                    className={`customer-list-item ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() =>
                      handleSelectCustomer(customer)
                    }
                  >
                    <div className="customer-avatar">
                      {customer.customerName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="customer-list-info">
                      <strong>
                        {customer.customerName}
                      </strong>

                      <span className="customer-booking-id">
                        #{bookingId}
                      </span>

                      <span className="customer-list-address">
                        📍 {customer.customerAddress}
                      </span>

                      <span className="customer-list-status">
                        {customer.status || "Pending"}
                      </span>
                    </div>

                    <span className="list-arrow">›</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* MAP AREA */}
        <section className="map-panel">
          <MapContainer
            center={DEFAULT_LOCATION}
            zoom={13}
            scrollWheelZoom={true}
            className="customer-leaflet-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController
              selectedCustomer={selectedCustomer}
            />

            {mappedCustomers.map((customer, index) => {
              const bookingId =
                customer.bookingId ||
                customer.id ||
                `booking-${index}`;

              return (
                <Marker
                  key={`${bookingId}-${index}`}
                  position={customer.coordinates}
                  eventHandlers={{
                    click: () =>
                      handleSelectCustomer(customer),
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>
                        {customer.customerName}
                      </strong>

                      <span>
                        Booking: #{bookingId}
                      </span>

                      <span>
                        📍 {customer.customerAddress}
                      </span>

                      <span>
                        ⚖️ Weight:{" "}
                        {customer.weight || "Not set"} kg
                      </span>

                      <span>
                        Status:{" "}
                        {customer.status || "Pending"}
                      </span>

                      <button
                        onClick={() =>
                          handleNavigate(customer)
                        }
                      >
                        Navigate →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* SELECTED CUSTOMER CARD */}
          {selectedCustomer && (
            <div className="selected-customer-card">
              <div className="selected-customer-top">
                <div className="selected-customer-avatar">
                  {selectedCustomer.customerName
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <span className="selected-label">
                    SELECTED CUSTOMER
                  </span>

                  <h3>
                    {selectedCustomer.customerName}
                  </h3>

                  <p>
                    #
                    {selectedCustomer.bookingId ||
                      selectedCustomer.id}
                  </p>
                </div>

                <button
                  className="close-selected"
                  onClick={() => setSelectedCustomer(null)}
                >
                  ×
                </button>
              </div>

              <div className="selected-customer-details">
                <div>
                  <span>Pickup Address</span>
                  <strong>
                    📍 {selectedCustomer.customerAddress}
                  </strong>
                </div>

                <div>
                  <span>Weight</span>
                  <strong>
                    ⚖️ {selectedCustomer.weight || "Not set"} kg
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {selectedCustomer.status || "Pending"}
                  </strong>
                </div>
              </div>

              <button
                className="navigate-button"
                onClick={() =>
                  handleNavigate(selectedCustomer)
                }
              >
                🗺️ Navigate to Customer
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CustomerMap;