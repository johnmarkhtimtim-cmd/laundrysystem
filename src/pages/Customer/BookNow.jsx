import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscribeToServices } from "../../services/laundryService";
import { createBooking } from "../../services/bookingService";
import { useAuth } from "../../context/AuthContext";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "../../styles/BookNow.css";

// ======================================================
// PICKUP OPTIONS
// ======================================================

const PICKUP_OPTIONS = [
  {
    name: "Pickup & Delivery",
    fee: 30,
    icon: "🚚",
    description: "We pick up and deliver your laundry.",
  },
  {
    name: "Pickup Only",
    fee: 20,
    icon: "📦",
    description: "Your laundry will be prepared for pickup.",
  },
];

// ======================================================
// DEFAULT LOCATION
// ======================================================

const DEFAULT_LOCATION = {
  latitude: 17.04,
  longitude: 121.85,
};

// ======================================================
// MAP CENTER CONTROLLER
// ======================================================

function MapCenterController({ latitude, longitude }) {
  const map = useMapEvents({});

  useEffect(() => {
    map.setView([latitude, longitude], 17, {
      animate: true,
    });
  }, [latitude, longitude, map]);

  return null;
}

// ======================================================
// MAP LOCATION MARKER
// ======================================================

function LocationMarker({
  latitude,
  longitude,
  onLocationChange,
}) {
  useMapEvents({
    click(event) {
      onLocationChange(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return (
    <Marker
      position={[latitude, longitude]}
      draggable={true}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target;
          const position = marker.getLatLng();

          onLocationChange(
            position.lat,
            position.lng
          );
        },
      }}
    >
      <Popup>
        <strong>Pickup Location</strong>
        <br />
        Drag the marker or click the map to change
        the location.
      </Popup>
    </Marker>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function BookNow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // ====================================================
  // FORM STATE
  // ====================================================

  const [services, setServices] = useState(() => {
    const requestedService = searchParams.get("service");
    return requestedService ? [requestedService] : [];
  });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [serviceLoadError, setServiceLoadError] = useState("");
  const [pickup, setPickup] = useState("");

  const [schedule, setSchedule] = useState("");
  const [time, setTime] = useState("");

  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [landmark, setLandmark] = useState("");

  const [latitude, setLatitude] = useState(
    DEFAULT_LOCATION.latitude
  );

  const [longitude, setLongitude] = useState(
    DEFAULT_LOCATION.longitude
  );

  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  const [showMap, setShowMap] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isLocating, setIsLocating] =
    useState(false);

  // ====================================================
  // PRICE CALCULATION
  // ====================================================

  const laundryTotal = services.reduce(
    (total, serviceName) => {
      const service = serviceOptions.find(
        (item) => item.name === serviceName
      );

      return total + (Number(service?.price) || 0);
    },
    0
  );

  const selectedPickup = PICKUP_OPTIONS.find(
    (item) => item.name === pickup
  );

  const deliveryFee = selectedPickup?.fee || 0;

  const estimatedTotal =
    laundryTotal + deliveryFee;

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    Promise.resolve().then(() => {
      if (!isMounted) return;

      try {
        unsubscribe = subscribeToServices(
          (allServices) => {
            if (!isMounted) return;

            const activeServices = allServices.filter(
              (service) => service.status === "Active"
            );

            setServiceOptions(activeServices);
            setServices((selectedServices) =>
              selectedServices.filter((selectedName) =>
                activeServices.some(
                  (service) => service.name === selectedName
                )
              )
            );
            setIsLoadingServices(false);
            setServiceLoadError("");
          },
          (loadError) => {
            if (!isMounted) return;

            console.error("Error loading booking services:", loadError);
            setServiceLoadError(
              "Unable to load available services. Please refresh and try again."
            );
            setIsLoadingServices(false);
          }
        );
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Error initializing booking services:", loadError);
        setServiceLoadError(
          "Unable to load available services. Please refresh and try again."
        );
        setIsLoadingServices(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // ====================================================
  // HELPERS
  // ====================================================

  const formatCurrency = (amount) => {
    return `₱${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Not selected";
    }

    const date = new Date(
      `${dateValue}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const locationText =
    [
      address,
      barangay,
      city,
      province,
    ]
      .filter(
        (item) =>
          item && item.trim()
      )
      .join(", ") ||
    "Not provided";

  // ====================================================
  // SELECT SERVICE
  // ====================================================

  const toggleService = (serviceName) => {
    setError("");

    setServices((currentServices) => {
      if (
        currentServices.includes(serviceName)
      ) {
        return currentServices.filter(
          (service) =>
            service !== serviceName
        );
      }

      return [
        ...currentServices,
        serviceName,
      ];
    });
  };

  // ====================================================
  // SELECT PICKUP
  // ====================================================

  const handlePickupChange = (pickupType) => {
    setError("");
    setPickup(pickupType);
  };

  // ====================================================
  // REVERSE GEOCODING
  // ====================================================

  const reverseGeocode = async (
    lat,
    lng
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to retrieve location."
        );
      }

      const data =
        await response.json();

      const location =
        data.address || {};

      const road =
        location.road ||
        location.pedestrian ||
        location.neighbourhood ||
        "";

      const barangayValue =
        location.village ||
        location.suburb ||
        location.quarter ||
        location.hamlet ||
        "";

      const cityValue =
        location.city ||
        location.town ||
        location.municipality ||
        "";

      const provinceValue =
        location.province ||
        location.state ||
        "";

      setAddress(road);
      setBarangay(barangayValue);
      setCity(cityValue);
      setProvince(provinceValue);
    } catch (error) {
      console.error(
        "Reverse geocoding error:",
        error
      );
    }
  };

  // ====================================================
  // LOCATION CHANGE
  // ====================================================

  const handleLocationChange = async (
    lat,
    lng
  ) => {
    setLatitude(lat);
    setLongitude(lng);

    await reverseGeocode(lat, lng);
  };

  // ====================================================
  // CURRENT LOCATION
  // ====================================================

  const useCurrentLocation = () => {
    setError("");

    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    setIsLocating(true);
    setShowMap(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        setLatitude(lat);
        setLongitude(lng);

        setGpsAccuracy(
          position.coords.accuracy
        );

        await reverseGeocode(
          lat,
          lng
        );

        setIsLocating(false);
      },
      (geoError) => {
        console.error(geoError);

        setError(
          "Unable to get your current location. Please select your location manually."
        );

        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // ====================================================
  // SUBMIT BOOKING
  // ====================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (services.length === 0) {
      setError(
        "Please select at least one laundry service."
      );
      return;
    }

    if (!pickup) {
      setError(
        "Please select a pickup option."
      );
      return;
    }

    if (!schedule) {
      setError(
        "Please select a pickup date."
      );
      return;
    }

    if (!time) {
      setError(
        "Please select a pickup time."
      );
      return;
    }

    if (!address.trim()) {
      setError(
        "Please enter your pickup address."
      );
      return;
    }

    if (!barangay.trim()) {
      setError(
        "Please enter your barangay."
      );
      return;
    }

    if (!city.trim()) {
      setError(
        "Please enter your city or municipality."
      );
      return;
    }

    if (!province.trim()) {
      setError(
        "Please enter your province."
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // -----------------------------------------------
      // BOOKING ID
      // -----------------------------------------------

      // -----------------------------------------------
      // BOOKING DATA
      // -----------------------------------------------

      const booking = {
        userId: user.uid,
        customer_name:
          user?.name ||
          user?.displayName ||
          user?.firstName ||
          "Customer",

        services,

        schedule,
        time,

        pickupType: pickup,

        address,
        barangay,
        city,
        province,
        landmark,

        latitude,
        longitude,
        gpsAccuracy,

        laundrySubtotal:
          laundryTotal,

        deliveryFee,

        estimatedTotal,

        status: "Pending",

        createdAt:
          new Date().toISOString(),
      };

      // -----------------------------------------------
      // SAVE BOOKING TO FIRESTORE
      // -----------------------------------------------

      await createBooking(
        user.uid,
        "",
        booking
      );
      window.dispatchEvent(
        new Event("laundrymateBookingUpdated")
      );

      setMessage(
        "Booking created successfully."
      );

      // -----------------------------------------------
      // PAYMENT PAGE
      // -----------------------------------------------

      navigate(
        "/customer/payments"
      );

    } catch (error) {
      console.error(
        "Booking error:",
        error
      );

      setError(
        "Something went wrong while saving your booking. Please try again."
      );

      setIsSubmitting(false);
    }
  };

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="booknow-page">

      <div className="booknow-container">

        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <header className="booknow-header">

          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>
            Book Laundry Service
          </h1>

          <p>
            Select your laundry service,
            pickup schedule, and location.
          </p>

        </header>

        {serviceLoadError && (
          <div className="form-alert error-alert" role="alert">
            <span className="alert-icon">!</span>
            <div>
              <strong>Services unavailable</strong>
              <p>{serviceLoadError}</p>
            </div>
          </div>
        )}

        {/* ==================================================
            ERROR MESSAGE
        ================================================== */}

        {error && (
          <div className="form-alert error-alert">

            <span className="alert-icon">
              !
            </span>

            <div>

              <strong>
                Please check your booking
              </strong>

              <p>
                {error}
              </p>

            </div>

          </div>
        )}

        {/* ==================================================
            SUCCESS MESSAGE
        ================================================== */}

        {message && (
          <div className="form-alert success-alert">

            <span className="alert-icon">
              ✓
            </span>

            <div>

              <strong>
                Success
              </strong>

              <p>
                {message}
              </p>

            </div>

          </div>
        )}

        {/* ==================================================
            BOOKING FORM
        ================================================== */}

        <form
          className="booking-layout"
          onSubmit={handleSubmit}
        >

          {/* ==================================================
              LEFT CONTENT
          ================================================== */}

          <main className="booking-content">

            {/* ==================================================
                STEP 1 - SERVICES
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  1
                </div>

                <div>

                  <h2>
                    Select Laundry Services
                  </h2>

                  <p>
                    Choose the services you need.
                  </p>

                </div>

              </div>

              <div className="service-grid">

                {isLoadingServices ? (
                  <p>Loading available services...</p>
                ) : serviceOptions.length === 0 ? (
                  <p>No services are currently available.</p>
                ) : serviceOptions.map(
                  (service) => {

                    const isSelected =
                      services.includes(
                        service.name
                      );

                    return (
                      <button
                        type="button"
                        key={service.name}
                        className={`service-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          toggleService(
                            service.name
                          )
                        }
                      >

                        <div className="service-icon">
                          {service.icon}
                        </div>

                        <div className="service-information">

                          <h3>
                            {service.name}
                          </h3>

                          <p>
                            {service.description}
                          </p>

                          <strong>
                            {formatCurrency(
                              service.price
                            )}
                          </strong>

                        </div>

                        <div className="service-check">
                          {isSelected
                            ? "✓"
                            : ""}
                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </section>

            {/* ==================================================
                STEP 2 - PICKUP
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  2
                </div>

                <div>

                  <h2>
                    Pickup Option
                  </h2>

                  <p>
                    Select how you want your laundry handled.
                  </p>

                </div>

              </div>

              <div className="pickup-grid">

                {PICKUP_OPTIONS.map(
                  (option) => {

                    const isSelected =
                      pickup ===
                      option.name;

                    return (
                      <button
                        type="button"
                        key={option.name}
                        className={`pickup-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handlePickupChange(
                            option.name
                          )
                        }
                      >

                        <div className="pickup-icon">
                          {option.icon}
                        </div>

                        <div className="pickup-information">

                          <h3>
                            {option.name}
                          </h3>

                          <p>
                            {option.description}
                          </p>

                          <strong>
                            {option.fee === 0
                              ? "Free"
                              : `${formatCurrency(
                                  option.fee
                                )} fee`}
                          </strong>

                        </div>

                        <div className="radio-check">
                          {isSelected
                            ? "✓"
                            : ""}
                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </section>

            {/* ==================================================
                STEP 3 - SCHEDULE
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  3
                </div>

                <div>

                  <h2>
                    Pickup Schedule
                  </h2>

                  <p>
                    Choose your preferred date and time.
                  </p>

                </div>

              </div>

              <div className="form-grid two-columns">

                <div className="form-group">

                  <label htmlFor="schedule">
                    Pickup Date
                  </label>

                  <input
                    id="schedule"
                    type="date"
                    value={schedule}
                    min={
                      new Date()
                        .toISOString()
                        .split("T")[0]
                    }
                    onChange={(event) =>
                      setSchedule(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="time">
                    Pickup Time
                  </label>

                  <input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(event) =>
                      setTime(
                        event.target.value
                      )
                    }
                  />

                </div>

              </div>

            </section>

            {/* ==================================================
                STEP 4 - LOCATION
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  4
                </div>

                <div>

                  <h2>
                    Pickup Location
                  </h2>

                  <p>
                    Provide the location for your laundry pickup.
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="location-button"
                onClick={
                  useCurrentLocation
                }
                disabled={
                  isLocating
                }
              >

                <span>
                  📍
                </span>

                {isLocating
                  ? "Getting your location..."
                  : "Use My Current Location"}

              </button>

              {/* MAP */}

              {showMap && (
                <div className="map-wrapper">

                  <MapContainer
                    center={[
                      latitude,
                      longitude,
                    ]}
                    zoom={17}
                    scrollWheelZoom={true}
                    className="location-map"
                  >

                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapCenterController
                      latitude={latitude}
                      longitude={longitude}
                    />

                    <LocationMarker
                      latitude={latitude}
                      longitude={longitude}
                      onLocationChange={
                        handleLocationChange
                      }
                    />

                  </MapContainer>

                  <div className="map-help">
                    Click the map or drag
                    the marker to set your
                    pickup location.
                  </div>

                </div>
              )}

              {/* LOCATION FIELDS */}

              <div className="form-grid">

                <div className="form-group">

                  <label htmlFor="address">
                    Address
                  </label>

                  <input
                    id="address"
                    type="text"
                    value={address}
                    placeholder="House number, street"
                    onChange={(event) =>
                      setAddress(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="barangay">
                    Barangay
                  </label>

                  <input
                    id="barangay"
                    type="text"
                    value={barangay}
                    placeholder="Enter barangay"
                    onChange={(event) =>
                      setBarangay(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="city">
                    City / Municipality
                  </label>

                  <input
                    id="city"
                    type="text"
                    value={city}
                    placeholder="Enter city or municipality"
                    onChange={(event) =>
                      setCity(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="province">
                    Province
                  </label>

                  <input
                    id="province"
                    type="text"
                    value={province}
                    placeholder="Enter province"
                    onChange={(event) =>
                      setProvince(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group full-width">

                  <label htmlFor="landmark">

                    Landmark

                    <span className="optional">
                      Optional
                    </span>

                  </label>

                  <input
                    id="landmark"
                    type="text"
                    value={landmark}
                    placeholder="Example: Near the public market"
                    onChange={(event) =>
                      setLandmark(
                        event.target.value
                      )
                    }
                  />

                </div>

              </div>

              {gpsAccuracy && (
                <div className="gps-info">
                  📍 GPS accuracy: approximately{" "}
                  {Math.round(
                    gpsAccuracy
                  )}{" "}
                  meters
                </div>
              )}

            </section>

          </main>

          {/* ==================================================
              RIGHT SIDE - BOOKING SUMMARY
          ================================================== */}

          <aside className="booking-summary">

            <div className="summary-content">

              {/* ==================================================
                  SELECTED SERVICES
              ================================================== */}

              <div className="summary-block">

                <div className="summary-section-title">

                  <span className="section-icon">
                    🧺
                  </span>

                  <div>

                    <h3>
                      Selected Services
                    </h3>

                    <p>
                      {services.length === 0
                        ? "No service selected"
                        : `${services.length} service${
                            services.length > 1
                              ? "s"
                              : ""
                          } selected`}
                    </p>

                  </div>

                </div>

                {services.length === 0 ? (

                  <div className="summary-empty">

                    <span className="empty-icon">
                      🧺
                    </span>

                    <strong>
                      No service selected
                    </strong>

                    <p>
                      Select a laundry service to continue.
                    </p>

                  </div>

                ) : (

                  <div className="summary-service-list">

                    {services.map(
                      (serviceName) => {

                        const service =
                          serviceOptions.find(
                            (item) =>
                              item.name ===
                              serviceName
                          );

                        return (
                          <div
                            className="summary-service-item"
                            key={serviceName}
                          >

                            <div className="summary-service-info">

                              <div className="summary-service-icon">
                                {service?.icon ||
                                  "🧺"}
                              </div>

                              <div className="summary-service-text">

                                <strong>
                                  {serviceName}
                                </strong>

                                <span>
                                  Laundry service
                                </span>

                              </div>

                            </div>

                            <strong className="summary-service-price">
                              {formatCurrency(
                                service?.price ||
                                  0
                              )}
                            </strong>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              {/* ==================================================
                  BOOKING DETAILS
              ================================================== */}

              <div className="summary-block">

                <div className="summary-section-title">

                  <span className="section-icon">
                    📋
                  </span>

                  <div>

                    <h3>
                      Booking Details
                    </h3>

                    <p>
                      Your pickup information
                    </p>

                  </div>

                </div>

                <div className="summary-details">

                  {/* Pickup Type */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        🚚
                      </span>

                      <span>
                        Pickup Type
                      </span>

                    </div>

                    <strong>
                      {pickup ||
                        "Not selected"}
                    </strong>

                  </div>

                  {/* Date */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        📅
                      </span>

                      <span>
                        Pickup Date
                      </span>

                    </div>

                    <strong>
                      {formatDate(
                        schedule
                      )}
                    </strong>

                  </div>

                  {/* Time */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        🕐
                      </span>

                      <span>
                        Pickup Time
                      </span>

                    </div>

                    <strong>
                      {time ||
                        "Not selected"}
                    </strong>

                  </div>

                  {/* Location */}

                  <div className="summary-detail-row detail-row-location">

                    <div className="detail-label">

                      <span className="detail-icon">
                        📍
                      </span>

                      <span>
                        Pickup Location
                      </span>

                    </div>

                    <strong>
                      {locationText}
                    </strong>

                  </div>

                  {/* Landmark */}

                  {landmark.trim() && (
                    <div className="summary-detail-row">

                      <div className="detail-label">

                        <span className="detail-icon">
                          🏷️
                        </span>

                        <span>
                          Landmark
                        </span>

                      </div>

                      <strong>
                        {landmark}
                      </strong>

                    </div>
                  )}

                </div>

              </div>

              {/* ==================================================
                  PAYMENT SUMMARY
              ================================================== */}

              <div className="summary-pricing">

                <div className="pricing-title">
                  Payment Summary
                </div>

                <div className="price-row">

                  <span>
                    Services
                  </span>

                  <strong>
                    {formatCurrency(
                      laundryTotal
                    )}
                  </strong>

                </div>

                <div className="price-row">

                  <span>
                    {pickup ===
                    "Pickup & Delivery"
                      ? "Pickup & Delivery Fee"
                      : "Pickup Fee"}
                  </span>

                  <strong>
                    {deliveryFee === 0
                      ? "Free"
                      : formatCurrency(
                          deliveryFee
                        )}
                  </strong>

                </div>

                <div className="price-divider"></div>

                <div className="total-row">

                  <div>

                    <span>
                      Total Amount
                    </span>

                    <small>
                      Estimated total
                    </small>

                  </div>

                  <strong>
                    {formatCurrency(
                      estimatedTotal
                    )}
                  </strong>

                </div>

              </div>

              {/* ==================================================
                  MESSAGE
              ================================================== */}

              <div className="summary-message">

                <div className="message-icon">
                  ✓
                </div>

                <div>

                  <strong>
                    Almost ready!
                  </strong>

                  <p>
                    Review your booking information
                    before continuing to payment.
                  </p>

                </div>

              </div>

              {/* ==================================================
                  SUBMIT BUTTON
              ================================================== */}

              <button
                type="submit"
                className="summary-submit"
                disabled={
                  isSubmitting ||
                  services.length === 0
                }
              >

                <span>
                  {isSubmitting
                    ? "Saving booking..."
                    : "Continue to Payment"}
                </span>

                {!isSubmitting && (
                  <span className="submit-arrow">
                    →
                  </span>
                )}

              </button>

            </div>

          </aside>

        </form>

      </div>

    </div>
  );
}