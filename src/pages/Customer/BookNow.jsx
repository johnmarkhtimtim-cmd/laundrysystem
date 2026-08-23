import { useState } from "react";
import "../../styles/BookNow.css";

function BookNow() {
  const [service, setService] = useState("");
  const [schedule, setSchedule] = useState("");
  const [time, setTime] = useState("");
  const [pickup, setPickup] = useState("Pickup");
  const [weight, setWeight] = useState("");
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [landmark, setLandmark] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // ================================
  // SERVICE PRICES
  // ================================
  const prices = {
    "Wash & Fold": 80,
    "Dry Cleaning": 150,
    Ironing: 60,
    "Bedding Care": 200,
  };

  // ================================
  // CALCULATIONS
  // ================================
  const price = service ? prices[service] : 0;

  const laundryTotal =
    weight && price
      ? price * Number(weight)
      : 0;

  const PICKUP_FEE = 30;
  const DELIVERY_FEE = 20;

  const deliveryFee =
    pickup === "Pickup"
      ? PICKUP_FEE
      : pickup === "Delivery"
      ? DELIVERY_FEE
      : 0;

  const estimatedTotal =
    laundryTotal + deliveryFee;

  // ================================
  // SUBMIT BOOKING
  // ================================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      !service ||
      !schedule ||
      !time ||
      !weight ||
      !address ||
      !barangay ||
      !city ||
      !province
    ) {
      setErrorMessage(
        "Please complete all required fields."
      );
      return;
    }

    setErrorMessage("");
    setShowSuccess(true);
  };

  return (
    <div className="booknow-page">

      {/* ================================
          ERROR MESSAGE
      ================================= */}

      {errorMessage && (
        <div className="error-message">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ================================
          SUCCESS MODAL
      ================================= */}

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
              Your laundry booking has been successfully received.
            </p>

            <div className="success-details">

              <div>
                <span>Service</span>
                <strong>
                  {service}
                </strong>
              </div>

              <div>
                <span>Pickup / Delivery</span>
                <strong>
                  {pickup}
                </strong>
              </div>

              <div>
                <span>Schedule</span>
                <strong>
                  {schedule}
                </strong>
              </div>

              <div>
                <span>Pickup Time</span>
                <strong>
                  {time}
                </strong>
              </div>

              <div>
                <span>Weight</span>
                <strong>
                  {weight} kg
                </strong>
              </div>

              <div>
                <span>Laundry Subtotal</span>
                <strong>
                  ₱{laundryTotal.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>
                  {pickup === "Pickup"
                    ? "Pickup Fee"
                    : "Delivery Fee"}
                </span>

                <strong>
                  ₱{deliveryFee.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>Estimated Total</span>

                <strong>
                  ₱{estimatedTotal.toFixed(2)}
                </strong>
              </div>

            </div>

            <div className="success-location">

              <span>
                Pickup Location
              </span>

              <p>
                {address}, {barangay}, {city}, {province}
              </p>

              {landmark && (
                <p>
                  <strong>
                    Landmark:
                  </strong>{" "}
                  {landmark}
                </p>
              )}

            </div>

            <button
              type="button"
              className="success-btn"
              onClick={() => setShowSuccess(false)}
            >
              Done
            </button>

          </div>
        </div>
      )}

      {/* ================================
          PAGE HEADER
      ================================= */}

      <div className="booknow-header">

        <div>

          <p className="booknow-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            Book a Laundry Service
          </h1>

          <p>
            Schedule your laundry service quickly and conveniently.
          </p>

        </div>

        <div className="booking-icon"></div>

      </div>

      {/* ================================
          BOOKING FORM
      ================================= */}

      <form
        className="booking-layout"
        onSubmit={handleSubmit}
      >

        {/* ================================
            LEFT SIDE
        ================================= */}

        <div className="booking-main">

          {/* ================================
              STEP 1
          ================================= */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                1
              </div>

              <div>
                <h2>
                  Choose a service
                </h2>

                <p>
                  Select the laundry service you need.
                </p>
              </div>

            </div>

            <div className="service-options">

              {/* WASH & FOLD */}

              <label
                className={
                  service === "Wash & Fold"
                    ? "service-option selected"
                    : "service-option"
                }
              >

                <input
                  type="radio"
                  name="service"
                  value="Wash & Fold"
                  checked={service === "Wash & Fold"}
                  onChange={(e) =>
                    setService(e.target.value)
                  }
                />

                <span className="option-icon">
                  🧺
                </span>

                <span className="option-content">

                  <strong>
                    Wash & Fold
                  </strong>

                  <small>
                    Fresh, clean, and neatly folded
                  </small>

                </span>

                <span className="option-price">
                  ₱80/kg
                </span>

              </label>

              {/* DRY CLEANING */}

              <label
                className={
                  service === "Dry Cleaning"
                    ? "service-option selected"
                    : "service-option"
                }
              >

                <input
                  type="radio"
                  name="service"
                  value="Dry Cleaning"
                  checked={service === "Dry Cleaning"}
                  onChange={(e) =>
                    setService(e.target.value)
                  }
                />

                <span className="option-icon">
                  👔
                </span>

                <span className="option-content">

                  <strong>
                    Dry Cleaning
                  </strong>

                  <small>
                    Professional garment cleaning
                  </small>

                </span>

                <span className="option-price">
                  ₱150/kg
                </span>

              </label>

              {/* IRONING */}

              <label
                className={
                  service === "Ironing"
                    ? "service-option selected"
                    : "service-option"
                }
              >

                <input
                  type="radio"
                  name="service"
                  value="Ironing"
                  checked={service === "Ironing"}
                  onChange={(e) =>
                    setService(e.target.value)
                  }
                />

                <span className="option-icon">
                  👕
                </span>

                <span className="option-content">

                  <strong>
                    Ironing
                  </strong>

                  <small>
                    Neatly pressed and wrinkle-free
                  </small>

                </span>

                <span className="option-price">
                  ₱60/kg
                </span>

              </label>

              {/* BEDDING CARE */}

              <label
                className={
                  service === "Bedding Care"
                    ? "service-option selected"
                    : "service-option"
                }
              >

                <input
                  type="radio"
                  name="service"
                  value="Bedding Care"
                  checked={service === "Bedding Care"}
                  onChange={(e) =>
                    setService(e.target.value)
                  }
                />

                <span className="option-icon">
                  🛏️
                </span>

                <span className="option-content">

                  <strong>
                    Bedding Care
                  </strong>

                  <small>
                    Deep cleaning for bedding
                  </small>

                </span>

                <span className="option-price">
                  ₱200/kg
                </span>

              </label>

            </div>

          </section>

          {/* ================================
              STEP 2
          ================================= */}

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
                  Choose how and when we collect your laundry.
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
                    pickup === "Pickup"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() =>
                    setPickup("Pickup")
                  }
                >
                  🚚

                  <span>
                    Pickup
                  </span>

                </button>

                <button
                  type="button"
                  className={
                    pickup === "Delivery"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() =>
                    setPickup("Delivery")
                  }
                >
                  🏪

                  <span>
                    Delivery
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
                  value={schedule}
                  onChange={(e) =>
                    setSchedule(e.target.value)
                  }
                />

              </div>

              <div className="form-group">

                <label htmlFor="time">
                  Pickup time
                </label>

                <select
                  id="time"
                  value={time}
                  onChange={(e) =>
                    setTime(e.target.value)
                  }
                >

                  <option value="">
                    Select time
                  </option>

                  <option value="9:00 AM">
                    9:00 AM
                  </option>

                  <option value="11:00 AM">
                    11:00 AM
                  </option>

                  <option value="1:00 PM">
                    1:00 PM
                  </option>

                  <option value="3:30 PM">
                    3:30 PM
                  </option>

                  <option value="5:00 PM">
                    5:00 PM
                  </option>

                </select>

              </div>

            </div>

          </section>

          {/* ================================
              STEP 3
          ================================= */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                3
              </div>

              <div>

                <h2>
                  Laundry Location
                </h2>

                <p>
                  Tell us where we can pick up and deliver your laundry.
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
                onChange={(e) =>
                  setAddress(e.target.value)
                }
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
                  onChange={(e) =>
                    setBarangay(e.target.value)
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
                  placeholder="Enter city or municipality"
                  value={city}
                  onChange={(e) =>
                    setCity(e.target.value)
                  }
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
                onChange={(e) =>
                  setProvince(e.target.value)
                }
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
                  setLandmark(e.target.value)
                }
              />

            </div>

          </section>

          {/* ================================
              STEP 4
          ================================= */}

          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                4
              </div>

              <div>

                <h2>
                  Laundry Details
                </h2>

                <p>
                  Provide the estimated weight of your laundry.
                </p>

              </div>

            </div>

            <div className="form-group">

              <label htmlFor="weight">
                Estimated Laundry Weight (kg)
              </label>

              <input
                id="weight"
                type="number"
                min="1"
                step="0.5"
                placeholder="Enter estimated weight"
                value={weight}
                onChange={(e) =>
                  setWeight(e.target.value)
                }
              />

            </div>

          </section>

        </div>

        {/* ================================
            RIGHT SUMMARY
        ================================= */}

        <aside className="booking-summary">

          <div className="summary-header">

            <h2>
              Booking Summary
            </h2>

            <span>
              Preview
            </span>

          </div>

          {/* SERVICE */}

          <div className="summary-service">

            <div className="summary-service-icon">
              🧺
            </div>

            <div>

              <span>
                Selected service
              </span>

              <strong>
                {service || "No service selected"}
              </strong>

            </div>

          </div>

          {/* DETAILS */}

          <div className="summary-details">

            <div>

              <span>
                Service type
              </span>

              <strong>
                {pickup}
              </strong>

            </div>

            <div>

              <span>
                Pickup date
              </span>

              <strong>
                {schedule || "Not selected"}
              </strong>

            </div>

            <div>

              <span>
                Pickup time
              </span>

              <strong>
                {time || "Not selected"}
              </strong>

            </div>

            <div>

              <span>
                Pickup Location
              </span>

              <strong>
                {address
                  ? `${address}, ${barangay}, ${city}, ${province}`
                  : "Not provided"}
              </strong>

            </div>

            <div>

              <span>
                Landmark
              </span>

              <strong>
                {landmark || "None"}
              </strong>

            </div>

            <div>

              <span>
                Estimated weight
              </span>

              <strong>
                {weight
                  ? `${weight} kg`
                  : "Not provided"}
              </strong>

            </div>

            {/* LAUNDRY SUBTOTAL */}

            <div>

              <span>
                Laundry Subtotal
              </span>

              <strong>
                ₱{laundryTotal.toFixed(2)}
              </strong>

            </div>

            {/* PICKUP / DELIVERY FEE */}

            <div>

              <span>
                {pickup === "Pickup"
                  ? "Pickup Fee"
                  : "Delivery Fee"}
              </span>

              <strong>
                ₱{deliveryFee.toFixed(2)}
              </strong>

            </div>

            {/* TOTAL */}

            <div className="summary-total-row">

              <span>
                Estimated Total
              </span>

              <strong className="summary-total">
                ₱{estimatedTotal.toFixed(2)}
              </strong>

            </div>

          </div>

          {/* NOTE */}

          <div className="summary-note">

            <span>
              ✓
            </span>

            <p>
              Final price may vary depending on
              the actual laundry weight and
              selected service.
            </p>

          </div>

          {/* CONFIRM */}

          <button
            type="submit"
            className="confirm-btn"
          >
            Confirm Booking

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