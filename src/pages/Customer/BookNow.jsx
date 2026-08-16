import { useState } from "react";
import "../../styles/BookNow.css";

function BookNow() {
  const [service, setService] = useState("");
  const [schedule, setSchedule] = useState("");
  const [time, setTime] = useState("");
  const [pickup, setPickup] = useState("Pickup");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const prices = {
    "Wash & Fold": 80,
    "Dry Cleaning": 150,
    Ironing: 60,
    "Bedding Care": 200,
  };

  const price = service ? prices[service] : 0;
  const estimatedTotal = weight
    ? price * Number(weight)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!service || !schedule || !time || !weight) {
      alert("Please complete all required fields.");
      return;
    }

    alert("Your laundry booking has been submitted!");
  };

  return (
    <div className="booknow-page">

      {/* PAGE HEADER */}
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

        <div className="booking-icon">
          🧺
        </div>

      </div>


      {/* BOOKING FORM */}
      <form
        className="booking-layout"
        onSubmit={handleSubmit}
      >

        {/* LEFT SIDE */}
        <div className="booking-main">

          {/* STEP 1 */}
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



            </div>

          </section>


          {/* STEP 2 */}
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
                    pickup === "Drop-off"
                      ? "pickup-option active"
                      : "pickup-option"
                  }
                  onClick={() =>
                    setPickup("Drop-off")
                  }
                >
                  🏪
                  <span>
                    Drop-off
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


          {/* STEP 3 */}
          <section className="booking-card">

            <div className="section-title">

              <div className="step-number">
                3
              </div>

              <div>
                <h2>
                  Laundry details
                </h2>

                <p>
                  Tell us about your laundry.
                </p>
              </div>

            </div>


            <div className="form-group">

              <label htmlFor="weight">
                Estimated laundry weight
              </label>

              <div className="weight-input">

                <input
                  id="weight"
                  type="number"
                  min="1"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) =>
                    setWeight(e.target.value)
                  }
                />

                <span>
                  kg
                </span>

              </div>

            </div>


            <div className="form-group">

              <label htmlFor="notes">
                Special instructions
              </label>

              <textarea
                id="notes"
                rows="4"
                placeholder="Example: Please handle white clothes separately..."
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
              />

            </div>

          </section>

        </div>


        {/* RIGHT SUMMARY */}
        <aside className="booking-summary">

          <div className="summary-header">
            <h2>
              Booking Summary
            </h2>

            <span>
              Preview
            </span>
          </div>


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
                Estimated weight
              </span>

              <strong>
                {weight ? `${weight} kg` : "0 kg"}
              </strong>
            </div>

          </div>


          <div className="summary-total">

            <span>
              Estimated total
            </span>

            <strong>
              ₱{estimatedTotal.toLocaleString()}
            </strong>

          </div>


          <div className="summary-note">
            <span>✓</span>

            <p>
              Final price may vary depending on the
              actual laundry weight and selected service.
            </p>
          </div>


          <button
            type="submit"
            className="confirm-btn"
          >
            Confirm Booking
            <span>→</span>
          </button>

        </aside>

      </form>

    </div>
  );
}

export default BookNow;