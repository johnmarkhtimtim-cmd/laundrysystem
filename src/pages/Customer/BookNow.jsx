import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "../../styles/BookNow.css";

// =====================================
// MAP CENTER CONTROLLER
// =====================================

function MapCenterController({
  latitude,
  longitude,
}) {
  const map = useMapEvents({});

  useEffect(() => {
    map.setView(
      [latitude, longitude],
      17,
      {
        animate: true,
      }
    );
  }, [latitude, longitude, map]);

  return null;
}

// =====================================
// MAP MARKER
// =====================================

function LocationMarker({
  latitude,
  longitude,
  onLocationChange,
}) {
  useMapEvents({
    click(e) {
      onLocationChange(
        e.latlng.lat,
        e.latlng.lng
      );
    },
  });

  return (
    <Marker
      position={[
        latitude,
        longitude,
      ]}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const position =
            marker.getLatLng();

          onLocationChange(
            position.lat,
            position.lng
          );
        },
      }}
    >
      <Popup>
        <strong>
          📍 Pickup Location
        </strong>

        <br />

        Click the map or drag the marker to
        adjust your pickup location.
      </Popup>
    </Marker>
  );
}

// =====================================
// BOOK NOW
// =====================================

function BookNow() {

  const navigate = useNavigate();

  // =====================================
  // BOOKING STATES
  // =====================================

  const [services, setServices] =
    useState([]);

  const [schedule, setSchedule] =
    useState("");

  const [time, setTime] =
    useState("");

  const [pickup, setPickup] =
    useState(
      "Pickup & Delivery"
    );

  const [weight, setWeight] =
    useState("");

  // =====================================
  // ADDRESS STATES
  // =====================================

  const [address, setAddress] =
    useState("");

  const [barangay, setBarangay] =
    useState("");

  const [city, setCity] =
    useState("");

  const [province, setProvince] =
    useState("");

  const [landmark, setLandmark] =
    useState("");

  // =====================================
  // MAP STATES
  // =====================================

  const [showMap, setShowMap] =
    useState(true);

  // Default location
  // This will be replaced by GPS
  // when customer clicks the GPS button.
  const [latitude, setLatitude] =
    useState(17.0400);

  const [longitude, setLongitude] =
    useState(121.8500);

  const [
    isLoadingAddress,
    setIsLoadingAddress,
  ] = useState(false);

  const [mapMessage, setMapMessage] =
    useState(
      "Select your exact pickup location"
    );

  // =====================================
  // GPS STATE
  // =====================================

  const [isLocating, setIsLocating] =
    useState(false);

  const [gpsAccuracy, setGpsAccuracy] =
    useState(null);

  // =====================================
  // UI STATES
  // =====================================

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showSuccess, setShowSuccess] =
    useState(false);

  const [bookingId] = useState("");

  // =====================================
  // TODAY
  // =====================================

  const today = new Date()
    .toISOString()
    .split("T")[0];

  // =====================================
  // SERVICE PRICES
  // =====================================

  const prices = {
    "Wash & Fold": 80,
    "Dry Cleaning": 150,
    Ironing: 60,
    "Bedding Care": 200,
  };

  // =====================================
  // SERVICE OPTIONS
  // =====================================

  const serviceOptions = [
    {
      name: "Wash & Fold",
      icon: "🧺",
      description:
        "Fresh, clean, and neatly folded",
      price: 80,
    },
    {
      name: "Dry Cleaning",
      icon: "👔",
      description:
        "Professional garment cleaning",
      price: 150,
    },
    {
      name: "Ironing",
      icon: "👕",
      description:
        "Neatly pressed and wrinkle-free",
      price: 60,
    },
    {
      name: "Bedding Care",
      icon: "🛏️",
      description:
        "Deep cleaning for bedding",
      price: 200,
    },
  ];

  // =====================================
  // FEES
  // =====================================

  const PICKUP_DELIVERY_FEE = 30;
  const PICKUP_ONLY_FEE = 20;

  const deliveryFee =
    pickup === "Pickup & Delivery"
      ? PICKUP_DELIVERY_FEE
      : pickup === "Pickup Only"
        ? PICKUP_ONLY_FEE
        : 0;

  // =====================================
  // PRICE CALCULATION
  // =====================================

  const numericWeight =
    Number(weight) || 0;

  const laundryTotal =
    services.reduce(
      (total, serviceName) => {
        const price =
          prices[serviceName] || 0;

        return (
          total +
          price * numericWeight
        );
      },
      0
    );

  const minimumServicePrice =
    services.reduce(
      (total, serviceName) => {
        return (
          total +
          (prices[serviceName] || 0)
        );
      },
      0
    );

  const estimatedTotal =
    numericWeight > 0
      ? laundryTotal +
        deliveryFee
      : minimumServicePrice +
        deliveryFee;

  // =====================================
  // CLEAR ERROR
  // =====================================

  const clearError = () => {
    setErrorMessage("");
  };

  // =====================================
  // TOGGLE SERVICE
  // =====================================

  const toggleService = (
    serviceName
  ) => {
    setServices(
      (currentServices) => {
        if (
          currentServices.includes(
            serviceName
          )
        ) {
          return currentServices.filter(
            (item) =>
              item !== serviceName
          );
        }

        return [
          ...currentServices,
          serviceName,
        ];
      }
    );

    clearError();
  };

  // =====================================
  // REVERSE GEOCODING
  // MAP → ADDRESS
  // =====================================

  const getAddressFromCoordinates =
    async (lat, lng) => {

      try {

        setIsLoadingAddress(true);

        setMapMessage(
          "Getting address..."
        );

        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            "Unable to find address."
          );
        }

        const data =
          await response.json();

        if (!data.address) {

          setMapMessage(
            "No address found. Please enter your address manually."
          );

          return;
        }

        const addressData =
          data.address;

        // =================================
        // COMPLETE ADDRESS
        // =================================

        const completeAddress = [
          addressData.house_number,

          addressData.road ||
            addressData.street ||
            addressData.pedestrian ||
            addressData.neighbour,
        ]
          .filter(Boolean)
          .join(", ");

        // =================================
        // BARANGAY
        // =================================

        const barangayName =
          addressData.village ||
          addressData.suburb ||
          addressData.neighbourhood ||
          addressData.quarter ||
          addressData.hamlet ||
          "";

        // =================================
        // CITY / MUNICIPALITY
        // =================================

        const cityName =
          addressData.city ||
          addressData.town ||
          addressData.municipality ||
          addressData.city_district ||
          "";

        // =================================
        // PROVINCE
        // =================================

        const provinceName =
          addressData.province ||
          addressData.state ||
          "";

        // =================================
        // UPDATE ADDRESS FORM
        // =================================

        setAddress(
          completeAddress ||
            data.display_name ||
            ""
        );

        setBarangay(
          barangayName
        );

        setCity(
          cityName
        );

        setProvince(
          provinceName
        );

        setMapMessage(
          "✓ Address automatically updated."
        );

        clearError();

      } catch (error) {

        console.error(
          "Reverse geocoding error:",
          error
        );

        setMapMessage(
          "Unable to automatically get the address. Please enter it manually."
        );

      } finally {

        setIsLoadingAddress(
          false
        );
      }
    };

  // =====================================
  // MAP LOCATION CHANGE
  // =====================================

  const handleMapLocationChange =
    async (lat, lng) => {

      setLatitude(lat);
      setLongitude(lng);

      setGpsAccuracy(null);

      await getAddressFromCoordinates(
        lat,
        lng
      );
    };

  // =====================================
  // GET CUSTOMER GPS LOCATION
  // =====================================

  const getCurrentLocation = () => {

    if (!navigator.geolocation) {

      setMapMessage(
        "GPS is not supported by your browser."
      );

      return;
    }

    setIsLocating(true);

    setIsLoadingAddress(true);

    setShowMap(true);

    setMapMessage(
      "📡 Getting your current GPS location..."
    );

    navigator.geolocation.getCurrentPosition(

      async (position) => {

        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        const accuracy =
          position.coords.accuracy;

        // ================================
        // UPDATE GPS COORDINATES
        // ================================

        setLatitude(lat);

        setLongitude(lng);

        setGpsAccuracy(
          accuracy
        );

        setMapMessage(
          "✓ GPS location found. Getting address..."
        );

        clearError();

        // ================================
        // GET ADDRESS
        // ================================

        await getAddressFromCoordinates(
          lat,
          lng
        );

        setIsLocating(false);
      },

      (error) => {

        console.error(
          "GPS error:",
          error
        );

        setIsLocating(false);

        setIsLoadingAddress(false);

        switch (error.code) {

          case error.PERMISSION_DENIED:

            setMapMessage(
              "📍 Location permission was denied. Please allow location access in your browser."
            );

            break;

          case error.POSITION_UNAVAILABLE:

            setMapMessage(
              "📍 Your current GPS location is unavailable."
            );

            break;

          case error.TIMEOUT:

            setMapMessage(
              "📍 GPS request timed out. Please try again."
            );

            break;

          default:

            setMapMessage(
              "📍 Unable to get your current location."
            );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // =====================================
  // SUBMIT BOOKING
  // =====================================

  const handleSubmit = (e) => {

    e.preventDefault();

    setErrorMessage("");

    // =====================================
    // VALIDATION
    // =====================================

    if (services.length === 0) {

      setErrorMessage(
        "Please select at least one laundry service."
      );

      return;
    }

    if (!schedule) {

      setErrorMessage(
        "Please select a pickup date."
      );

      return;
    }

    if (!time) {

      setErrorMessage(
        "Please select a pickup time."
      );

      return;
    }

    if (
      !weight ||
      numericWeight <= 0
    ) {

      setErrorMessage(
        "Please enter a valid laundry weight."
      );

      return;
    }

    if (!address.trim()) {

      setErrorMessage(
        "Please enter your complete address."
      );

      return;
    }

    if (!barangay.trim()) {

      setErrorMessage(
        "Please enter your barangay."
      );

      return;
    }

    if (!city.trim()) {

      setErrorMessage(
        "Please enter your city or municipality."
      );

      return;
    }

    if (!province.trim()) {

      setErrorMessage(
        "Please enter your province."
      );

      return;
    }

    // =====================================
    // BOOKING ID
    // =====================================

    const newBookingId =
      `LM-${Date.now()}`;

    // =====================================
    // BOOKING RECORD
    // =====================================

    const booking = {

      id: newBookingId,

      services: [
        ...services,
      ],

      schedule,

      time,

      pickupType:
        pickup,

      weight:
        numericWeight,

      address:
        address.trim(),

      barangay:
        barangay.trim(),

      city:
        city.trim(),

      province:
        province.trim(),

      landmark:
        landmark.trim(),

      // GPS DATA
      latitude,

      longitude,

      gpsAccuracy,

      laundrySubtotal:
        laundryTotal,

      deliveryFee,

      estimatedTotal,

      status:
        "Pending",

      createdAt:
        new Date().toISOString(),
    };

    // =====================================
    // PAYMENT RECORD
    // =====================================

    const paymentRecord = {

      bookingId:
        newBookingId,

      services: [
        ...services,
      ],

      weight:
        numericWeight,

      laundrySubtotal:
        laundryTotal,

      deliveryFee,

      totalAmount:
        estimatedTotal,

      pickupType:
        pickup,

      schedule,

      time,

      paymentMethod:
        "GCash",

      paymentStatus:
        "Pending",

      bookingStatus:
        "Pending",

      createdAt:
        new Date().toISOString(),
    };

    // =====================================
    // SAVE DATA
    // =====================================

    try {

      // BOOKINGS
      const existingBookings =
        JSON.parse(
          localStorage.getItem(
            "laundrymateBookings"
          ) || "[]"
        );

      localStorage.setItem(
        "laundrymateBookings",

        JSON.stringify([
          ...existingBookings,
          booking,
        ])
      );

      // PAYMENTS
      const existingPayments =
        JSON.parse(
          localStorage.getItem(
            "laundrymatePayments"
          ) || "[]"
        );

      localStorage.setItem(
        "laundrymatePayments",

        JSON.stringify([
          ...existingPayments,
          paymentRecord,
        ])
      );

      // LATEST PAYMENT
      localStorage.setItem(
        "laundrymatePayment",

        JSON.stringify(
          paymentRecord
        )
      );

      navigate("/customer/payments");

    } catch (error) {

      console.error(
        "Booking save error:",
        error
      );

      setErrorMessage(
        "Unable to save your booking. Please try again."
      );
    }
  };

  // =====================================
  // DONE
  // =====================================

  const handleDone = () => {

    setShowSuccess(false);
  };

  // =====================================
  // RENDER
  // =====================================

  return (
    <div className="booknow-page">

      {/* =====================================
          ERROR MESSAGE
      ===================================== */}

      {errorMessage && (

        <div className="error-message">

          <span>
            ⚠️
          </span>

          <span>
            {errorMessage}
          </span>

        </div>
      )}

      {/* =====================================
          SUCCESS MODAL
      ===================================== */}

      {showSuccess && (

        <div className="success-overlay">

          <div className="success-modal">

            <div className="success-icon">
              ✓
            </div>

            <h2>
              Booking Submitted!
            </h2>

            <p className="success-message">
              Your laundry booking has
              been successfully received.
            </p>

            <div className="booking-reference">

              <span>
                Booking ID
              </span>

              <strong>
                {bookingId}
              </strong>

            </div>

            <div className="success-details">

              <div>

                <span>
                  Services
                </span>

                <strong>
                  {services.join(
                    ", "
                  )}
                </strong>

              </div>

              <div>

                <span>
                  Pickup / Delivery
                </span>

                <strong>
                  {pickup}
                </strong>

              </div>

              <div>

                <span>
                  Pickup Date
                </span>

                <strong>
                  {schedule}
                </strong>

              </div>

              <div>

                <span>
                  Pickup Time
                </span>

                <strong>
                  {time}
                </strong>

              </div>

              <div>

                <span>
                  Weight
                </span>

                <strong>
                  {numericWeight} kg
                </strong>

              </div>

              <div>

                <span>
                  Laundry Subtotal
                </span>

                <strong>
                  ₱
                  {laundryTotal.toFixed(
                    2
                  )}
                </strong>

              </div>

              <div>

                <span>
                  {pickup ===
                  "Pickup & Delivery"
                    ? "Pickup & Delivery Fee"
                    : "Pickup Fee"}
                </span>

                <strong>
                  ₱
                  {deliveryFee.toFixed(
                    2
                  )}
                </strong>

              </div>

              <div className="success-total">

                <span>
                  Estimated Total
                </span>

                <strong>
                  ₱
                  {estimatedTotal.toFixed(
                    2
                  )}
                </strong>

              </div>

            </div>

            {/* LOCATION */}

            <div className="success-location">

              <span>
                Pickup Location
              </span>

              <p>
                {address},{" "}
                {barangay},{" "}
                {city},{" "}
                {province}
              </p>

              {landmark && (

                <p>

                  <strong>
                    Landmark:
                  </strong>{" "}

                  {landmark}

                </p>
              )}

              <small>
                📍{" "}
                {latitude.toFixed(6)}
                {", "}
                {longitude.toFixed(6)}
              </small>

              {gpsAccuracy && (

                <small>
                  <br />
                  GPS Accuracy: ±
                  {Math.round(
                    gpsAccuracy
                  )}
                  m
                </small>
              )}

            </div>

            <button
              type="button"
              className="success-btn"
              onClick={handleDone}
            >
              Done
            </button>

          </div>

        </div>
      )}

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="booknow-header">

        <div>

          <p className="booknow-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            Book a Laundry Service
          </h1>

          <p>
            Schedule your laundry service
            quickly and conveniently.
          </p>

        </div>

        <div className="booking-icon">
          🧺
        </div>

      </div>

      {/* =====================================
          MAIN BOOKING LAYOUT
      ===================================== */}

      <form
        className="booking-layout"
        onSubmit={handleSubmit}
      >

        {/* =====================================
            LEFT SIDE
        ===================================== */}

        <div className="booking-main">

          {/* =====================================
              STEP 1
          ===================================== */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                1
              </div>

              <div>

                <h2>
                  Choose your services
                </h2>

                <p>
                  Select one or more laundry
                  services you need.
                </p>

              </div>

            </div>

            <div className="service-selection">

              {serviceOptions.map(
                (item) => {

                  const isSelected =
                    services.includes(
                      item.name
                    );

                  return (

                    <label
                      key={item.name}
                      className={`service-card ${
                        isSelected
                          ? "selected"
                          : ""
                      }`}
                    >

                      <input
                        type="checkbox"
                        checked={
                          isSelected
                        }
                        onChange={() =>
                          toggleService(
                            item.name
                          )
                        }
                      />

                      <div className="service-check">
                        {isSelected
                          ? "✓"
                          : ""}
                      </div>

                      <div className="service-icon">
                        {item.icon}
                      </div>

                      <div className="service-info">

                        <strong>
                          {item.name}
                        </strong>

                        <small>
                          {item.description}
                        </small>

                      </div>

                      <div className="service-price">

                        ₱
                        {item.price}
                        /kg

                      </div>

                    </label>
                  );
                }
              )}

            </div>

            <div className="service-helper">

              <span>
                ✓
              </span>

              <p>
                You can select multiple
                services for the same booking.
              </p>

            </div>

          </section>

          {/* =====================================
              STEP 2
          ===================================== */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                2
              </div>

              <div>

                <h2>
                  Pickup & schedule
                </h2>

                <p>
                  Choose how and when we
                  collect your laundry.
                </p>

              </div>

            </div>

            <div className="form-group">

              <label>
                Service type
              </label>

              <div className="pickup-options">

                <button
                  type="button"
                  className={
                    pickup ===
                    "Pickup & Delivery"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() => {

                    setPickup(
                      "Pickup & Delivery"
                    );

                    clearError();
                  }}
                >

                  🚚

                  <span>
                    Pickup & Delivery
                  </span>

                </button>

                <button
                  type="button"
                  className={
                    pickup ===
                    "Pickup Only"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() => {

                    setPickup(
                      "Pickup Only"
                    );

                    clearError();
                  }}
                >

                  🏪

                  <span>
                    Pickup Only
                  </span>

                </button>

              </div>

            </div>

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="schedule">
                  Pickup date
                </label>

                <input
                  id="schedule"
                  type="date"
                  min={today}
                  value={schedule}
                  onChange={(e) => {

                    setSchedule(
                      e.target.value
                    );

                    clearError();
                  }}
                />

              </div>

              <div className="form-group">

                <label htmlFor="time">
                  Pickup time
                </label>

                <select
                  id="time"
                  value={time}
                  onChange={(e) => {

                    setTime(
                      e.target.value
                    );

                    clearError();
                  }}
                >

                  <option value="">
                    Select time
                  </option>

                  <option value="8:00 - 10:00 AM">
                    8:00 - 10:00 AM
                  </option>

                  <option value="10:00 - 12:00 PM">
                    10:00 - 12:00 PM
                  </option>

                  <option value="1:00 - 3:00 PM">
                    1:00 - 3:00 PM
                  </option>

                  <option value="3:00 - 5:00 PM">
                    3:00 - 5:00 PM
                  </option>

                </select>

              </div>

            </div>

            <div className="form-group">

              <label htmlFor="weight">
                Estimated Laundry Weight
              </label>

              <div className="weight-input">

                <input
                  id="weight"
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) => {

                    setWeight(
                      e.target.value
                    );

                    clearError();
                  }}
                />

                <span>
                  kg
                </span>

              </div>

              <small className="input-helper">
                Enter the estimated weight
                of your laundry.
              </small>

            </div>

          </section>
                  {/* =====================================
              STEP 3 - GPS LOCATION
          ===================================== */}

          <section className="booking-card map-booking-card">

            <div className="section-title">

              <div className="step-number">
                3
              </div>

              <div>

                <h2>
                  Confirm Pickup Location
                </h2>

                <p>
                  Use your GPS location or
                  pin your exact pickup location
                  on the map.
                </p>

              </div>

            </div>

            {/* =================================
                MAP HEADER
            ================================= */}

            <div className="map-location-header">

              <div>

                <div className="map-title">
                  📍 Your Pickup Location
                </div>

                <p>
                  Use GPS for your current
                  location, or click the map /
                  drag the marker.
                </p>

              </div>

              <div className="map-actions">

                {/* GPS BUTTON */}

                <button
                  type="button"
                  className="gps-location-btn"
                  onClick={
                    getCurrentLocation
                  }
                  disabled={
                    isLocating ||
                    isLoadingAddress
                  }
                >

                  {isLocating
                    ? "📡 Locating..."
                    : "📍 Use My Current Location"}

                </button>

                {/* MAP TOGGLE */}

                <button
                  type="button"
                  className="map-toggle-btn"
                  onClick={() =>
                    setShowMap(
                      (current) =>
                        !current
                    )
                  }
                >

                  {showMap
                    ? "Hide Map"
                    : "📍 Show Map"}

                </button>

              </div>

            </div>

            {/* =================================
                MAP
            ================================= */}

            {showMap && (

              <div className="booking-map-container">

                <MapContainer
                  center={[
                    latitude,
                    longitude,
                  ]}
                  zoom={17}
                  scrollWheelZoom={true}
                  className="booking-map"
                >

                  {/* CENTER MAP WHEN GPS CHANGES */}

                  <MapCenterController
                    latitude={
                      latitude
                    }
                    longitude={
                      longitude
                    }
                  />

                  <TileLayer
                    attribution='&copy; Esri, Maxar, Earthstar Geographics'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />

                  <LocationMarker
                    latitude={
                      latitude
                    }
                    longitude={
                      longitude
                    }
                    onLocationChange={
                      handleMapLocationChange
                    }
                  />

                </MapContainer>

                {/* =================================
                    MAP INFO
                ================================= */}

                <div className="map-bottom-panel">

                  <div className="map-status">

                    <div className="map-status-icon">
                      📍
                    </div>

                    <div>

                      <strong>

                        {isLoadingAddress
                          ? "Getting address..."
                          : "Pickup location"}

                      </strong>

                      <p>

                        {isLoadingAddress
                          ? "Please wait..."
                          : mapMessage}

                      </p>

                    </div>

                  </div>

                  <div className="map-coordinates">

                    <span>
                      Latitude
                    </span>

                    <strong>
                      {latitude.toFixed(
                        6
                      )}
                    </strong>

                    <span>
                      Longitude
                    </span>

                    <strong>
                      {longitude.toFixed(
                        6
                      )}
                    </strong>

                    {gpsAccuracy && (

                      <>

                        <span>
                          Accuracy
                        </span>

                        <strong>
                          ±
                          {Math.round(
                            gpsAccuracy
                          )}
                          m
                        </strong>

                      </>

                    )}

                  </div>

                </div>

              </div>
            )}

            {/* =================================
                SELECTED ADDRESS
            ================================= */}

            <div className="selected-location-card">

              <div className="selected-location-icon">
                📍
              </div>

              <div className="selected-location-content">

                <span>
                  Selected Pickup Address
                </span>

                <strong>

                  {address ||
                    "Use GPS or select a location on the map"}

                </strong>

                {(barangay ||
                  city ||
                  province) && (

                  <p>

                    {[
                      barangay,
                      city,
                      province,
                    ]
                      .filter(Boolean)
                      .join(", ")}

                  </p>
                )}

              </div>

            </div>

            {/* =================================
                GPS CONFIRMATION
            ================================= */}

            <div className="map-confirmation">

              <span>
                ✓
              </span>

              <p>

                Your GPS coordinates will be
                saved with your booking so our
                pickup staff can easily locate
                your pickup address.

              </p>

            </div>

          </section>
          {/* =====================================
              STEP 4
          ===================================== */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                4
              </div>

              <div>

                <h2>
                  Laundry Address
                </h2>

                <p>
                  Enter your pickup address.
                  You can confirm the exact
                  location in Step 4.
                </p>

              </div>

            </div>

            <div className="form-group">

              <label htmlFor="address">
                Complete Address
              </label>

              <input
                id="address"
                type="text"
                placeholder="House/Building No., Street"
                value={address}
                onChange={(e) => {

                  setAddress(
                    e.target.value
                  );

                  clearError();
                }}
              />

            </div>

            <div className="form-row">

              <div className="form-group">

                <label htmlFor="barangay">
                  Barangay
                </label>

                <input
                  id="barangay"
                  type="text"
                  placeholder="Enter barangay"
                  value={barangay}
                  onChange={(e) => {

                    setBarangay(
                      e.target.value
                    );

                    clearError();
                  }}
                />

              </div>

              <div className="form-group">

                <label htmlFor="city">
                  City / Municipality
                </label>

                <input
                  id="city"
                  type="text"
                  placeholder="Enter city or municipality"
                  value={city}
                  onChange={(e) => {

                    setCity(
                      e.target.value
                    );

                    clearError();
                  }}
                />

              </div>

            </div>

            <div className="form-group">

              <label htmlFor="province">
                Province
              </label>

              <input
                id="province"
                type="text"
                placeholder="Enter province"
                value={province}
                onChange={(e) => {

                  setProvince(
                    e.target.value
                  );

                  clearError();
                }}
              />

            </div>

            <div className="form-group">

              <label htmlFor="landmark">
                Landmark / Pickup Instructions
              </label>

              <textarea
                id="landmark"
                rows="4"
                placeholder="Example: Near the barangay hall, blue gate beside the sari-sari store..."
                value={landmark}
                onChange={(e) =>
                  setLandmark(
                    e.target.value
                  )
                }
              />

            </div>

          </section>

          

        </div>

        {/* =====================================
            RIGHT SIDE - BOOKING SUMMARY
        ===================================== */}

        <aside className="booking-summary">

          <div className="summary-header">

            <div>

              <h3>
                Booking Summary
              </h3>

              <p>
                Review your selected services
                and estimated cost.
              </p>

            </div>

          </div>

          {/* SERVICES */}

          <div className="summary-services">

            <div className="summary-section-label">
              Selected Services
            </div>

            {services.length === 0 ? (

              <div className="empty-services">

                <span>
                  🧺
                </span>

                <p>
                  No services selected
                </p>

              </div>

            ) : (

              <div className="summary-service-list">

                {services.map(
                  (serviceName) => {

                    const price =
                      prices[
                        serviceName
                      ] || 0;

                    const serviceTotal =
                      numericWeight > 0
                        ? price *
                          numericWeight
                        : price;

                    return (

                      <div
                        className="summary-service-row"
                        key={
                          serviceName
                        }
                      >

                        <div className="summary-service-left">

                          <div className="summary-service-icon">
                            🧺
                          </div>

                          <div>

                            <strong>
                              {serviceName}
                            </strong>

                            <span>
                              ₱
                              {price}
                              /kg
                            </span>

                          </div>

                        </div>

                        <strong className="summary-service-amount">

                          ₱
                          {serviceTotal.toFixed(
                            2
                          )}

                        </strong>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </div>

          {/* BREAKDOWN */}

          <div className="summary-breakdown">

            <div className="summary-line">

              <span>

                Laundry

                {numericWeight >
                0
                  ? ` (${numericWeight} kg)`
                  : ""}

              </span>

              <strong>

                ₱

                {numericWeight >
                0
                  ? laundryTotal.toFixed(
                      2
                    )
                  : minimumServicePrice.toFixed(
                      2
                    )}

              </strong>

            </div>

            <div className="summary-line">

              <span>
                Service type
              </span>

              <strong>
                {pickup}
              </strong>

            </div>

            <div className="summary-line">

              <span>
                Pickup date
              </span>

              <strong>

                {schedule ||
                  "Not selected"}

              </strong>

            </div>

            <div className="summary-line">

              <span>
                Pickup time
              </span>

              <strong>

                {time ||
                  "Not selected"}

              </strong>

            </div>

            <div className="summary-line">

              <span>
                Pickup Location
              </span>

              <strong>

                {address
                  ? `${address}, ${barangay}, ${city}, ${province}`
                  : "Not provided"}

              </strong>

            </div>

            <div className="summary-line">

              <span>
                Landmark
              </span>

              <strong>

                {landmark ||
                  "None"}

              </strong>

            </div>

            <div className="summary-line">

              <span>

                {pickup ===
                "Pickup & Delivery"
                  ? "Pickup & Delivery Fee"
                  : "Pickup Fee"}

              </span>

              <strong>

                ₱
                {deliveryFee.toFixed(
                  2
                )}

              </strong>

            </div>

          </div>

          {/* TOTAL */}

          <div className="summary-total-box">

            <div>

              <span>
                Estimated Total
              </span>

              <small>
                Based on selected weight
                and services
              </small>

            </div>

            <strong>

              ₱
              {estimatedTotal.toFixed(
                2
              )}

            </strong>

          </div>

          {/* NOTE */}

          <div className="summary-note">

            <span>
              ✓
            </span>

            <p>

              Final price may vary depending
              on the actual laundry weight and
              selected service.

            </p>

          </div>

          {/* CHECKOUT */}

          <button
            type="submit"
            className="confirm-btn"
          >

            <span>
              Check Out
            </span>

            <span>
              →
            </span>

          </button>

        </aside>

      </form>

    </div>
  );
}

export default BookNow;
