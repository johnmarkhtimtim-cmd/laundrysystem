import { useState } from "react";
import "../../styles/BookNow.css";

function BookNow() {
  const [services, setServices] = useState([]);
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
  // AUTOMATIC PRICE CALCULATION
  // ================================

  const laundryTotal = services.reduce(
  (total, serviceName) => {

    const price = prices[serviceName] || 0;

    return total + price * (Number(weight) || 0);

  },
  0
);

const minimumServicePrice = services.reduce(
  (total, serviceName) => {
    return total + (prices[serviceName] || 0);
  },
  0
);

  // ================================
  // TOGGLE SERVICES
  // ================================

  const toggleService = (serviceName) => {
    setServices((currentServices) =>
      currentServices.includes(serviceName)
        ? currentServices.filter((item) => item !== serviceName)
        : [...currentServices, serviceName],
    );
  };

  // ================================
  // PICKUP / DELIVERY FEE
  // ================================

  const PICKUP_DELIVERY_FEE = 30;
  const PICKUP_ONLY_FEE = 20;

  const deliveryFee =
    pickup === "Pickup & Delivery"
      ? PICKUP_DELIVERY_FEE
      : pickup === "Pickup Only"
        ? PICKUP_ONLY_FEE
        : 0;

  // ================================
// ESTIMATED TOTAL
// ================================

const estimatedTotal =
  weight && Number(weight) > 0
    ? laundryTotal + deliveryFee
    : minimumServicePrice + deliveryFee;

  // ================================
  // SUBMIT BOOKING
  // ================================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      services.length === 0 ||
      !schedule ||
      !time ||
      !weight ||
      !address ||
      !barangay ||
      !city ||
      !province
    ) {
      setErrorMessage(
        "Please select at least one service and complete all required fields.",
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
            <div className="success-icon">✓</div>

            <h2>Booking Submitted!</h2>

            <p className="success-message">
              Your laundry booking has been successfully received.
            </p>

            <div className="success-details">
              <div>
                <span>Service</span>
                <strong>{service}</strong>
              </div>

              <div>
                <span>Pickup / Delivery</span>
                <strong>{pickup}</strong>
              </div>

              <div>
                <span>Schedule</span>
                <strong>{schedule}</strong>
              </div>

              <div>
                <span>Pickup Time</span>
                <strong>{time}</strong>
              </div>

              <div>
                <span>Weight</span>
                <strong>{weight} kg</strong>
              </div>

              <div>
                <span>Laundry Subtotal</span>
                <strong>₱{laundryTotal.toFixed(2)}</strong>
              </div>

              <div>
                <span>
                  {pickup === "Pickup" ? "Pickup Fee" : "Delivery Fee"}
                </span>

                <strong>₱{deliveryFee.toFixed(2)}</strong>
              </div>

              <div>
                <span>Estimated Total</span>

                <strong>₱{estimatedTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="success-location">
              <span>Pickup Location</span>

              <p>
                {address}, {barangay}, {city}, {province}
              </p>

              {landmark && (
                <p>
                  <strong>Landmark:</strong> {landmark}
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
          <p className="booknow-eyebrow">LAUNDRYMATE</p>

          <h1>Book a Laundry Service</h1>

          <p>Schedule your laundry service quickly and conveniently.</p>
        </div>

        <div className="booking-icon"></div>
      </div>

      {/* ================================
          BOOKING FORM
      ================================= */}

      <form className="booking-layout" onSubmit={handleSubmit}>
        {/* ================================
            LEFT SIDE
        ================================= */}

        <div className="booking-main">
          {/* ================================
              STEP 1
          ================================= */}

          <section className="booking-card">
            <div className="section-title">
              <div className="step-number">1</div>

              <div>
                <h2>Choose your services</h2>

                <p>Select one or more laundry services you need.</p>
              </div>
            </div>

            <div className="service-selection">
              {[
                {
                  name: "Wash & Fold",
                  icon: "🧺",
                  description: "Fresh, clean, and neatly folded",
                  price: 80,
                },
                {
                  name: "Dry Cleaning",
                  icon: "👔",
                  description: "Professional garment cleaning",
                  price: 150,
                },
                {
                  name: "Ironing",
                  icon: "👕",
                  description: "Neatly pressed and wrinkle-free",
                  price: 60,
                },
                {
                  name: "Bedding Care",
                  icon: "🛏️",
                  description: "Deep cleaning for bedding",
                  price: 200,
                },
              ].map((item) => {
                const isSelected = services.includes(item.name);

                return (
                  <label
                    key={item.name}
                    className={`service-card ${isSelected ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      value={item.name}
                      checked={isSelected}
                      onChange={() => toggleService(item.name)}
                    />

                    <div className="service-check">{isSelected ? "✓" : ""}</div>

                    <div className="service-icon">{item.icon}</div>

                    <div className="service-info">
                      <strong>{item.name}</strong>

                      <small>{item.description}</small>
                    </div>

                    <div className="service-price">₱{item.price}/kg</div>
                  </label>
                );
              })}
            </div>

            <div className="service-helper">
              <span>✓</span>

              <p>You can select multiple services for the same booking.</p>
            </div>
          </section>

          {/* ================================
              STEP 2
          ================================= */}

          <section className="booking-card">
            <div className="section-title">
              <div className="step-number">2</div>

              <div>
                <h2>Pickup & schedule</h2>

                <p>Choose how and when we collect your laundry.</p>
              </div>
            </div>

            <div className="form-group">
              <label>Service type</label>

              <div className="pickup-options">
                <button
                  type="button"
                  className={
                    pickup === "Pickup & Delivery"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() => setPickup("Pickup & Delivery")}
                >
                  🚚
                  <span>Pickup & Delivery</span>
                </button>

                <button
                  type="button"
                  className={
                    pickup === "Pickup Only"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() => setPickup("Pickup Only")}
                >
                  🏪
                  <span>Pickup Only</span>
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="schedule">Pickup date</label>

                <input
                  id="schedule"
                  type="date"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="time">Pickup time</label>

                <select
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                >
                  <option value="">Select time</option>

                  <option value="9:00 AM">9:00 AM</option>

                  <option value="11:00 AM">11:00 AM</option>

                  <option value="1:00 PM">1:00 PM</option>

                  <option value="3:30 PM">3:30 PM</option>

                  <option value="5:00 PM">5:00 PM</option>
                </select>
              </div>
            </div>
          </section>

          {/* ================================
              STEP 3
          ================================= */}

          <section className="booking-card">
            <div className="section-title">
              <div className="step-number">3</div>

              <div>
                <h2>Laundry Location</h2>

                <p>Tell us where we can pick up and deliver your laundry.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address">Complete Address</label>

              <input
                id="address"
                type="text"
                placeholder="House/Building No., Street"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="barangay">Barangay</label>

                <input
                  id="barangay"
                  type="text"
                  placeholder="Enter barangay"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="city">City / Municipality</label>

                <input
                  id="city"
                  type="text"
                  placeholder="Enter city or municipality"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="province">Province</label>

              <input
                id="province"
                type="text"
                placeholder="Enter province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="landmark">Landmark / Pickup Instructions</label>

              <textarea
                id="landmark"
                rows="4"
                placeholder="Example: Near the barangay hall, blue gate beside the sari-sari store..."
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
            </div>
          </section>
        </div>

        {/* ================================
            RIGHT SUMMARY
        ================================= */}

        {/* =====================================
    CLEAN BOOKING SUMMARY
===================================== */}

<aside className="booking-summary">

  <div className="summary-header">
    <div>
      <h3>Booking Summary</h3>
      <p>Review your selected services and estimated cost.</p>
    </div>
  </div>


  {/* SELECTED SERVICES */}
  <div className="summary-services">

    <div className="summary-section-label">
      Selected Services
    </div>

    {services.length === 0 ? (

      <div className="empty-services">
        <span>🧺</span>
        <p>No services selected</p>
      </div>

    ) : (

      <div className="summary-service-list">

        {services.map((serviceName) => {

          const price = prices[serviceName] || 0;

          const serviceTotal =
            Number(weight) > 0
              ? price * Number(weight)
              : price;

          return (
            <div
              className="summary-service-row"
              key={serviceName}
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
                    ₱{price}/kg
                  </span>
                </div>

              </div>

              <strong className="summary-service-amount">
                ₱{serviceTotal.toFixed(2)}
              </strong>

            </div>
          );

        })}

      </div>

    )}

  </div>


  {/* PRICE BREAKDOWN */}

  <div className="summary-breakdown">

    <div className="summary-line">

      <span>
        Laundry
        {weight ? ` (${weight} kg)` : ""}
      </span>

      <strong>
        ₱
        {weight
          ? laundryTotal.toFixed(2)
          : minimumServicePrice.toFixed(2)}
      </strong>

    </div>
          
            <div>
              <span>Service type</span>

              <strong>{pickup}</strong>
            </div>

            <div>
              <span>Pickup date</span>

              <strong>{schedule || "Not selected"}</strong>
            </div>

            <div>
              <span>Pickup time</span>

              <strong>{time || "Not selected"}</strong>
            </div>

            <div>
              <span>Pickup Location</span>

              <strong>
                {address
                  ? `${address}, ${barangay}, ${city}, ${province}`
                  : "Not provided"}
              </strong>
            </div>

            <div>
              <span>Landmark</span>

              <strong>{landmark || "None"}</strong>
            </div>

            <div>
              <span>Estimated weight</span>

              <strong>{weight ? `${weight} kg` : "Not provided"}</strong>
            </div>

    <div className="summary-line">

      <span>
        {pickup === "Pickup & Delivery"
          ? "Pickup & Delivery"
          : "Pickup Only"}
      </span>

      <strong>
        ₱{deliveryFee.toFixed(2)}
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
        {weight
          ? "Based on your selected weight"
          : "Minimum estimated price"}
      </small>
    </div>

    <strong>
      ₱{estimatedTotal.toFixed(2)}
    </strong>

  </div>


          {/* NOTE */}

          <div className="summary-note">
            <span>✓</span>

            <p>
              Final price may vary depending on the actual laundry weight and
              selected service.
            </p>
          </div>

          {/* CONFIRM */}

          <button type="submit" className="confirm-btn">
            Confirm Booking
            <span>→</span>
          </button>
        </aside>
      </form>
    </div>
  );
}

export default BookNow;
