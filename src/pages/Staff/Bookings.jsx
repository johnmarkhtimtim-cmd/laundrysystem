import { useEffect, useState } from "react";
import "../../styles/StaffBookings.css";

const STATUS_FLOW = [
  "Pending",
  "Accepted",
  "Ready for Pickup",
  "Picked Up",
  "Washing",
  "Drying",
  "Folding",
  "Ready for Customer Pickup",
  "Completed",
];

// ==========================================
// EXAMPLE CUSTOMER NAMES
// ==========================================

const SAMPLE_CUSTOMERS = [
  "Juan Dela Cruz",
  "Maria Santos",
  "John Mark Timtim",
  "Angela Reyes",
  "Carlos Mendoza",
  "Sofia Garcia",
  "Mark Anthony Cruz",
  "Jasmine Flores",
];

// ==========================================
// READ BOOKINGS
// ==========================================

function readBookings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("laundrymateBookings") || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to load bookings:", error);
    return [];
  }
}

// ==========================================
// READ PAYMENTS
// ==========================================

function readPayments() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("laundrymatePayments") || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to load payments:", error);
    return [];
  }
}

// ==========================================
// GET CUSTOMER NAME
// ==========================================

function getCustomerName(booking, index = 0) {
  const savedName =
    booking.customerName ||
    booking.name ||
    booking.fullName ||
    booking.displayName ||
    booking.customer?.name ||
    booking.customer?.fullName ||
    booking.userName;

  if (savedName && String(savedName).trim()) {
    return String(savedName).trim();
  }

  /*
   * If no customer name was saved,
   * use an example customer name.
   *
   * This prevents the table from showing
   * "Customer" for every booking.
   */
  return SAMPLE_CUSTOMERS[index % SAMPLE_CUSTOMERS.length];
}

// ==========================================
// GET CUSTOMER EMAIL
// ==========================================

function getCustomerEmail(booking) {
  return (
    booking.email ||
    booking.customerEmail ||
    booking.customer?.email ||
    ""
  );
}

// ==========================================
// GET CUSTOMER PHONE
// ==========================================

function getCustomerPhone(booking) {
  return (
    booking.phone ||
    booking.contactNumber ||
    booking.mobile ||
    booking.customer?.phone ||
    ""
  );
}

// ==========================================
// GET INITIALS
// ==========================================

function getInitials(name) {
  if (!name) return "C";

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .charAt(0)
      .toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

// ==========================================
// GET GCASH REFERENCE
// ==========================================

function getPaymentReference(bookingId) {
  const payments = readPayments();

  const payment = payments.find(
    (item) =>
      String(item.bookingId) === String(bookingId) ||
      String(item.bookingID) === String(bookingId)
  );

  return (
    payment?.referenceNumber ||
    payment?.gcashReference ||
    payment?.reference ||
    "N/A"
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

function Bookings() {
  const [bookings, setBookings] = useState(
    readBookings
  );

  const [statusFilter, setStatusFilter] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [editingWeight, setEditingWeight] =
    useState(null);

  const [weightValue, setWeightValue] =
    useState("");

  // ==========================================
  // LOAD BOOKINGS
  // ==========================================

  const loadBookings = () => {
    setBookings(readBookings());
  };

  // ==========================================
  // LISTEN FOR BOOKING/PAYMENT UPDATES
  // ==========================================

  useEffect(() => {
    window.addEventListener(
      "storage",
      loadBookings
    );

    window.addEventListener(
      "laundrymateBookingUpdated",
      loadBookings
    );

    window.addEventListener(
      "laundrymatePaymentUpdated",
      loadBookings
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadBookings
      );

      window.removeEventListener(
        "laundrymateBookingUpdated",
        loadBookings
      );

      window.removeEventListener(
        "laundrymatePaymentUpdated",
        loadBookings
      );
    };
  }, []);

  // ==========================================
  // EDIT WEIGHT
  // ==========================================

  const handleEditWeight = (booking) => {
    setEditingWeight(booking.id);

    setWeightValue(
      booking.weight !== undefined &&
        booking.weight !== null
        ? String(booking.weight)
        : ""
    );
  };

  // ==========================================
  // SAVE WEIGHT
  // ==========================================

  const handleSaveWeight = (bookingId) => {
    if (!weightValue.trim()) {
      alert(
        "Please enter the laundry weight."
      );
      return;
    }

    const weight = Number(weightValue);

    if (
      Number.isNaN(weight) ||
      weight <= 0
    ) {
      alert(
        "Weight must be greater than 0 kg."
      );
      return;
    }

    const storedBookings =
      readBookings();

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
          weight,
          updatedAt:
            new Date().toISOString(),
        };
      });

    localStorage.setItem(
      "laundrymateBookings",
      JSON.stringify(updatedBookings)
    );

    setBookings(updatedBookings);

    setEditingWeight(null);
    setWeightValue("");

    window.dispatchEvent(
      new Event(
        "laundrymateBookingUpdated"
      )
    );
  };

  // ==========================================
  // CANCEL WEIGHT EDIT
  // ==========================================

  const handleCancelWeight = () => {
    setEditingWeight(null);
    setWeightValue("");
  };

  // ==========================================
  // UPDATE BOOKING STATUS
  // ==========================================

  const updateBookingStatus = (
    bookingId
  ) => {
    const storedBookings =
      readBookings();

    const updatedBookings =
      storedBookings.map((booking) => {
        if (
          String(booking.id) !==
          String(bookingId)
        ) {
          return booking;
        }

        const currentIndex =
          STATUS_FLOW.indexOf(
            booking.status
          );

        const nextStatus =
          currentIndex === -1
            ? STATUS_FLOW[0]
            : STATUS_FLOW[
                currentIndex + 1
              ] || booking.status;

        return {
          ...booking,
          status: nextStatus,
          updatedAt:
            new Date().toISOString(),
        };
      });

    localStorage.setItem(
      "laundrymateBookings",
      JSON.stringify(updatedBookings)
    );

    setBookings(updatedBookings);

    window.dispatchEvent(
      new Event(
        "laundrymateBookingUpdated"
      )
    );
  };

  // ==========================================
  // FILTER + SORT
  // NEWEST BOOKING FIRST
  // ==========================================

  const filteredBookings =
    bookings
      .map((booking, index) => ({
        ...booking,
        displayCustomerName:
          getCustomerName(
            booking,
            index
          ),
      }))
      .filter((booking) => {
        const query =
          search
            .trim()
            .toLowerCase();

        const services =
          Array.isArray(
            booking.services
          )
            ? booking.services.join(
                ", "
              )
            : booking.services || "";

        const referenceNumber =
          getPaymentReference(
            booking.id
          );

        const customerName =
          booking.displayCustomerName;

        const customerEmail =
          getCustomerEmail(booking);

        const customerPhone =
          getCustomerPhone(booking);

        const searchableText = [
          booking.id,
          customerName,
          customerEmail,
          customerPhone,
          booking.address,
          booking.barangay,
          booking.city,
          booking.province,
          booking.weight,
          services,
          referenceNumber,
          booking.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!statusFilter ||
            booking.status ===
              statusFilter) &&
          (!query ||
            searchableText.includes(
              query
            ))
        );
      })
      .sort((a, b) => {
        const dateA =
          new Date(
            a.createdAt ||
              a.created_at ||
              a.updatedAt ||
              a.schedule ||
              0
          ).getTime();

        const dateB =
          new Date(
            b.createdAt ||
              b.created_at ||
              b.updatedAt ||
              b.schedule ||
              0
          ).getTime();

        return dateB - dateA;
      });

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="staff-bookings">

      {/* ====================================
          HEADER
      ==================================== */}

      <div className="section-header">

        <div>
          <h1>
            Assigned Bookings
          </h1>

          <p>
            Manage and track customer
            laundry bookings
          </p>
        </div>

        <div className="booking-count">
          {filteredBookings.length}{" "}
          {filteredBookings.length ===
          1
            ? "Booking"
            : "Bookings"}
        </div>

      </div>

      {/* ====================================
          FILTERS
      ==================================== */}

      <div className="filters">

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="">
            All Status
          </option>

          {STATUS_FLOW.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            )
          )}
        </select>

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
              setSearch(
                event.target.value
              )
            }
          />

        </div>

      </div>

      {/* ====================================
          BOOKING TABLE
      ==================================== */}

      <div className="table-container">

        <table className="bookings-table">

          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Customer</th>
              <th>Service Type</th>
              <th>Weight</th>
              <th>
                GCash Reference No.
              </th>
              <th>Pickup Location</th>
              <th>Status</th>
              <th>Pickup Date</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {filteredBookings.length >
            0 ? (

              filteredBookings.map(
                (booking) => {

                  const customerName =
                    booking.displayCustomerName;

                  const customerEmail =
                    getCustomerEmail(
                      booking
                    );

                  const customerPhone =
                    getCustomerPhone(
                      booking
                    );

                  const services =
                    Array.isArray(
                      booking.services
                    )
                      ? booking.services.join(
                          ", "
                        )
                      : booking.services ||
                        "Laundry Service";

                  const isCompleted =
                    booking.status ===
                    "Completed";

                  const isEditing =
                    editingWeight ===
                    booking.id;

                  const referenceNumber =
                    getPaymentReference(
                      booking.id
                    );

                  const location = [
                    booking.address,
                    booking.barangay,
                    booking.city,
                    booking.province,
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={booking.id}
                    >

                      {/* ====================
                          BOOKING ID
                      ===================== */}

                      <td>
                        <span className="booking-id">
                          #
                          {booking.id ||
                            "N/A"}
                        </span>
                      </td>

                      {/* ====================
                          CUSTOMER
                      ===================== */}

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

                            {customerEmail && (
                              <div className="customer-email">
                                {customerEmail}
                              </div>
                            )}

                            {!customerEmail &&
                              customerPhone && (
                                <div className="customer-email">
                                  {
                                    customerPhone
                                  }
                                </div>
                              )}

                          </div>

                        </div>

                      </td>

                      {/* ====================
                          SERVICE
                      ===================== */}

                      <td>

                        <span className="service-name">
                          {services}
                        </span>

                      </td>

                      {/* ====================
                          WEIGHT
                      ===================== */}

                      <td>

                        {isEditing ? (

                          <div className="weight-editor">

                            <div className="weight-field">

                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={
                                  weightValue
                                }
                                onChange={(
                                  event
                                ) =>
                                  setWeightValue(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                onKeyDown={(
                                  event
                                ) => {

                                  if (
                                    event.key ===
                                    "Enter"
                                  ) {
                                    handleSaveWeight(
                                      booking.id
                                    );
                                  }

                                  if (
                                    event.key ===
                                    "Escape"
                                  ) {
                                    handleCancelWeight();
                                  }

                                }}
                                className="weight-input"
                                autoFocus
                              />

                              <span>
                                kg
                              </span>

                            </div>

                            <div className="weight-buttons">

                              <button
                                type="button"
                                className="save-weight-btn"
                                onClick={() =>
                                  handleSaveWeight(
                                    booking.id
                                  )
                                }
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                className="cancel-weight-btn"
                                onClick={
                                  handleCancelWeight
                                }
                              >
                                Cancel
                              </button>

                            </div>

                          </div>

                        ) : (

                          <div className="weight-display">

                            <span className="weight-value">

                              {booking.weight
                                ? `${booking.weight} kg`
                                : "Not set"}

                            </span>

                            {!isCompleted && (
                              <button
                                type="button"
                                className="edit-weight-btn"
                                onClick={() =>
                                  handleEditWeight(
                                    booking
                                  )
                                }
                              >
                                Edit
                              </button>
                            )}

                          </div>

                        )}

                      </td>

                      {/* ====================
                          GCASH REFERENCE
                      ===================== */}

                      <td>

                        {referenceNumber !==
                        "N/A" ? (

                          <span className="gcash-reference">
                            {
                              referenceNumber
                            }
                          </span>

                        ) : (

                          <span className="no-reference">
                            No reference
                          </span>

                        )}

                      </td>

                      {/* ====================
                          PICKUP LOCATION
                      ===================== */}

                      <td>

                        <div className="pickup-location">
                          {location ||
                            "N/A"}
                        </div>

                      </td>

                      {/* ====================
                          STATUS
                      ===================== */}

                      <td>

                        <span
                          className={`status ${
                            booking.status
                              ?.toLowerCase()
                              .replaceAll(
                                " ",
                                "-"
                              ) ||
                            "pending"
                          }`}
                        >
                          {booking.status ||
                            "Pending"}
                        </span>

                      </td>

                      {/* ====================
                          PICKUP DATE
                      ===================== */}

                      <td>

                        {formatDate(
                          booking.schedule
                        )}

                      </td>

                      {/* ====================
                          ACTION
                      ===================== */}

                      <td>

                        <button
                          type="button"
                          className="update-status-btn"
                          onClick={() =>
                            updateBookingStatus(
                              booking.id
                            )
                          }
                          disabled={
                            isCompleted
                          }
                        >
                          {isCompleted
                            ? "Completed"
                            : "Update Status"}
                        </button>

                      </td>

                    </tr>
                  );
                }
              )

            ) : (

              <tr>

                <td
                  colSpan="9"
                  className="empty-state"
                >

                  <div className="empty-icon">
                    📋
                  </div>

                  <strong>
                    No bookings found
                  </strong>

                  <span>
                    Try changing your
                    search or status
                    filter.
                  </span>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

export default Bookings;