import "../../styles/MyBookings.css"

function MyBooking() {
  const bookings = [
    {
      id: "LM-2026-001",
      service: "Wash & Fold",
      date: "August 16, 2026",
      pickup: "3:30 PM",
      weight: "5 kg",
      amount: "₱400",
      status: "In Progress",
    },
    {
      id: "LM-2026-002",
      service: "Bedding Care",
      date: "August 14, 2026",
      pickup: "2:00 PM",
      weight: "3 kg",
      amount: "₱600",
      status: "Completed",
    },
    {
      id: "LM-2026-003",
      service: "Dry Cleaning",
      date: "August 18, 2026",
      pickup: "10:00 AM",
      weight: "2 kg",
      amount: "₱300",
      status: "Pending",
    },
  ];

  const getStatusClass = (status) => {
    if (status === "Pending") {
      return "pending";
    }

    if (status === "In Progress") {
      return "in-progress";
    }

    if (status === "Completed") {
      return "completed";
    }

    return "";
  };

  const getProgress = (status) => {
    if (status === "Pending") {
      return 1;
    }

    if (status === "In Progress") {
      return 2;
    }

    if (status === "Completed") {
      return 3;
    }

    return 1;
  };

  return (
    <div className="my-booking-page">

      {/* PAGE HEADER */}
      <div className="booking-page-header">
        <div>
          <p className="booking-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            My Bookings
          </h1>

          <p>
            Track and manage your laundry bookings.
          </p>
        </div>

        <div className="booking-header-icon">
          🧺
        </div>
      </div>


      {/* SUMMARY CARDS */}
      <div className="booking-stat-grid">

        <div className="booking-stat-card">
          <div className="booking-stat-icon blue">
            📋
          </div>

          <div>
            <span>
              Total Bookings
            </span>

            <strong>
              {bookings.length}
            </strong>
          </div>
        </div>


        <div className="booking-stat-card">
          <div className="booking-stat-icon orange">
            ◷
          </div>

          <div>
            <span>
              Pending
            </span>

            <strong>
              1
            </strong>
          </div>
        </div>


        <div className="booking-stat-card">
          <div className="booking-stat-icon blue">
            🧺
          </div>

          <div>
            <span>
              In Progress
            </span>

            <strong>
              1
            </strong>
          </div>
        </div>


        <div className="booking-stat-card">
          <div className="booking-stat-icon green">
            ✓
          </div>

          <div>
            <span>
              Completed
            </span>

            <strong>
              1
            </strong>
          </div>
        </div>

      </div>


      {/* BOOKINGS */}
      <div className="booking-list">

        {bookings.map((booking) => {

          const progress = getProgress(booking.status);

          return (
            <div
              className="booking-card"
              key={booking.id}
            >

              {/* CARD HEADER */}
              <div className="booking-card-header">

                <div className="booking-title">

                  <div className="booking-service-icon">
                    {booking.service === "Wash & Fold" && "🧺"}
                    {booking.service === "Bedding Care" && "🛏️"}
                    {booking.service === "Dry Cleaning" && "👔"}
                  </div>

                  <div>
                    <h2>
                      {booking.service}
                    </h2>

                    <p>
                      Booking #{booking.id}
                    </p>
                  </div>

                </div>


                <span
                  className={`booking-status ${getStatusClass(
                    booking.status
                  )}`}
                >
                  <span className="status-circle"></span>

                  {booking.status}
                </span>

              </div>


              {/* BOOKING DETAILS */}
              <div className="booking-details">

                <div className="detail-item">
                  <span className="detail-label">
                    Pickup Date
                  </span>

                  <strong>
                    {booking.date}
                  </strong>
                </div>


                <div className="detail-item">
                  <span className="detail-label">
                    Pickup Time
                  </span>

                  <strong>
                    {booking.pickup}
                  </strong>
                </div>


                <div className="detail-item">
                  <span className="detail-label">
                    Laundry Weight
                  </span>

                  <strong>
                    {booking.weight}
                  </strong>
                </div>


                <div className="detail-item">
                  <span className="detail-label">
                    Amount
                  </span>

                  <strong className="booking-amount">
                    {booking.amount}
                  </strong>
                </div>

              </div>


              {/* PROGRESS */}
              <div className="booking-progress">

                <div className="progress-header">

                  <div>
                    <strong>
                      Booking Progress
                    </strong>

                    <span>
                      {booking.status === "Pending" &&
                        "Your booking has been received."}

                      {booking.status === "In Progress" &&
                        "Your laundry is currently being processed."}

                      {booking.status === "Completed" &&
                        "Your laundry is ready and completed."}
                    </span>
                  </div>

                  <strong className="progress-percent">
                    {progress === 1 && "33%"}
                    {progress === 2 && "66%"}
                    {progress === 3 && "100%"}
                  </strong>

                </div>


                <div className="progress-line">

                  <div
                    className={`progress-fill progress-${progress}`}
                  ></div>

                </div>


                <div className="status-timeline">

                  {/* PENDING */}
                  <div
                    className={
                      progress >= 1
                        ? "timeline-step active"
                        : "timeline-step"
                    }
                  >
                    <div className="timeline-icon">
                      ✓
                    </div>

                    <div>
                      <strong>
                        Pending
                      </strong>

                      <span>
                        Booking received
                      </span>
                    </div>
                  </div>


                  {/* IN PROGRESS */}
                  <div
                    className={
                      progress >= 2
                        ? "timeline-step active"
                        : "timeline-step"
                    }
                  >
                    <div className="timeline-icon">
                      🧺
                    </div>

                    <div>
                      <strong>
                        In Progress
                      </strong>

                      <span>
                        Laundry being processed
                      </span>
                    </div>
                  </div>


                  {/* COMPLETED */}
                  <div
                    className={
                      progress >= 3
                        ? "timeline-step active"
                        : "timeline-step"
                    }
                  >
                    <div className="timeline-icon">
                      ✓
                    </div>

                    <div>
                      <strong>
                        Completed
                      </strong>

                      <span>
                        Ready for pickup
                      </span>
                    </div>
                  </div>

                </div>

              </div>


              {/* CARD FOOTER */}
              <div className="booking-card-footer">

                <span>
                  Last updated today
                </span>

                <button
                  className="view-booking-btn"
                  type="button"
                >
                  View Details →
                </button>

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default MyBooking;