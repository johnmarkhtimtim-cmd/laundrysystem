import { useEffect, useState } from "react";
import "../../styles/StaffBookings.css";

// ==========================================
// STATUS FLOW
// ==========================================

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
// CUSTOMER NAME
// ==========================================

function getCustomerName(booking) {
  if (!booking) {
    return "Unknown Customer";
  }

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

// ==========================================
// INITIALS
// ==========================================

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
// PAYMENT REFERENCE
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
// INITIAL PAYMENT
// ==========================================

function getInitialPayment(booking) {
  if (!booking) return 0;

  const payment = Number(
    booking.initialPayment ??
      booking.downPayment ??
      booking.paymentAmount ??
      booking.amountPaid ??
      booking.initialPaid ??
      0
  );

  return Number.isNaN(payment) ? 0 : payment;
}

// ==========================================
// TOTAL AMOUNT
// ==========================================

function getTotalAmount(booking) {
  if (!booking) return 0;

  const total = Number(
    booking.totalAmount ??
      booking.total ??
      booking.amount ??
      booking.grandTotal ??
      booking.price ??
      0
  );

  return Number.isNaN(total) ? 0 : total;
}

// ==========================================
// AMOUNT TO BE PAID
// ==========================================

function getAmountToBePaid(booking) {
  const totalAmount = getTotalAmount(booking);
  const initialPayment = getInitialPayment(booking);

  const balance = totalAmount - initialPayment;

  return balance < 0 ? 0 : balance;
}

// ==========================================
// CURRENCY
// ==========================================

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

// ==========================================
// PICKUP LOCATION
// ==========================================

function getPickupLocation(booking) {
  if (!booking) {
    return "N/A";
  }

  // If a complete pickup address already exists,
  // use it first.
  if (booking.pickupAddress) {
    return String(booking.pickupAddress);
  }

  if (booking.pickupLocation) {
    return String(booking.pickupLocation);
  }

  return (
    [
      booking.address,
      booking.barangay,
      booking.city,
      booking.province,
    ]
      .filter(Boolean)
      .join(", ") || "N/A"
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

function Bookings() {
  const [bookings, setBookings] = useState(readBookings);

  const [statusFilter, setStatusFilter] = useState("");

  const [search, setSearch] = useState("");

  // ==========================================
  // TABLE WEIGHT EDITOR
  // ==========================================

  const [editingWeight, setEditingWeight] = useState(null);

  const [weightValue, setWeightValue] = useState("");

  // ==========================================
  // UPDATE BOOKING MODAL
  // ==========================================

  const [editingCustomer, setEditingCustomer] =
    useState(null);

  const [customerForm, setCustomerForm] = useState({
    customerName: "",
    pickupAddress: "",
    weight: "",
    totalAmount: "",
    initialPayment: "",
    amountToBePaid: "",
    status: "Pending",
  });

  // ==========================================
  // LOAD BOOKINGS
  // ==========================================

  const loadBookings = () => {
    setBookings(readBookings());
  };

  // ==========================================
  // LISTEN FOR UPDATES
  // ==========================================

  useEffect(() => {
    window.addEventListener("storage", loadBookings);

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
  // EDIT TABLE WEIGHT
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
  // SAVE TABLE WEIGHT
  // ==========================================

  const handleSaveWeight = (bookingId) => {
    if (!weightValue.trim()) {
      alert("Please enter the laundry weight.");
      return;
    }

    const weight = Number(weightValue);

    if (Number.isNaN(weight) || weight <= 0) {
      alert("Weight must be greater than 0 kg.");
      return;
    }

    const storedBookings = readBookings();

    const updatedBookings = storedBookings.map(
      (booking) => {
        if (
          String(booking.id) !==
          String(bookingId)
        ) {
          return booking;
        }

        return {
          ...booking,
          weight,
          updatedAt: new Date().toISOString(),
        };
      }
    );

    localStorage.setItem(
      "laundrymateBookings",
      JSON.stringify(updatedBookings)
    );

    setBookings(updatedBookings);

    setEditingWeight(null);
    setWeightValue("");

    window.dispatchEvent(
      new Event("laundrymateBookingUpdated")
    );
  };

  // ==========================================
  // CANCEL TABLE WEIGHT
  // ==========================================

  const handleCancelWeight = () => {
    setEditingWeight(null);
    setWeightValue("");
  };

  // ==========================================
  // OPEN UPDATE BOOKING MODAL
  // ==========================================

  const handleEditCustomer = (booking) => {
    const totalAmount = getTotalAmount(booking);
    const initialPayment = getInitialPayment(booking);

    setEditingCustomer(booking);

    setCustomerForm({
      customerName: getCustomerName(booking),

      pickupAddress:
        booking.pickupAddress ||
        booking.pickupLocation ||
        getPickupLocation(booking),

      weight:
        booking.weight !== undefined &&
        booking.weight !== null
          ? String(booking.weight)
          : "",

      totalAmount: String(totalAmount),

      initialPayment: String(initialPayment),

      amountToBePaid: String(
        getAmountToBePaid(booking)
      ),

      status:
        booking.status &&
        STATUS_FLOW.includes(booking.status)
          ? booking.status
          : "Pending",
    });
  };

  // ==========================================
  // HANDLE FORM CHANGE
  // ==========================================

  const handleCustomerFormChange = (event) => {
    const { name, value } = event.target;

    setCustomerForm((previous) => {
      const updated = {
        ...previous,
        [name]: value,
      };

      // Automatically calculate balance
      // when Total Amount or Initial Payment changes.
      if (
        name === "totalAmount" ||
        name === "initialPayment"
      ) {
        const total = Number(
          name === "totalAmount"
            ? value
            : previous.totalAmount
        );

        const initial = Number(
          name === "initialPayment"
            ? value
            : previous.initialPayment
        );

        if (
          !Number.isNaN(total) &&
          !Number.isNaN(initial)
        ) {
          const balance = total - initial;

          updated.amountToBePaid = String(
            balance < 0 ? 0 : balance
          );
        }
      }

      return updated;
    });
  };

  // ==========================================
  // SAVE ALL BOOKING CHANGES
  // ==========================================

  const handleSaveCustomer = () => {
    if (!editingCustomer) {
      return;
    }

    // ------------------------------
    // VALIDATE CUSTOMER NAME
    // ------------------------------

    if (!customerForm.customerName.trim()) {
      alert("Please enter the customer name.");
      return;
    }

    // ------------------------------
    // VALIDATE ADDRESS
    // ------------------------------

    if (!customerForm.pickupAddress.trim()) {
      alert("Please enter the pickup address.");
      return;
    }

    // ------------------------------
    // VALIDATE WEIGHT
    // ------------------------------

    const weight = Number(
      customerForm.weight
    );

    if (
      Number.isNaN(weight) ||
      weight <= 0
    ) {
      alert(
        "Weight must be greater than 0 kg."
      );
      return;
    }

    // ------------------------------
    // VALIDATE TOTAL
    // ------------------------------

    const totalAmount = Number(
      customerForm.totalAmount
    );

    if (
      Number.isNaN(totalAmount) ||
      totalAmount < 0
    ) {
      alert(
        "Total amount cannot be negative."
      );
      return;
    }

    // ------------------------------
    // VALIDATE INITIAL PAYMENT
    // ------------------------------

    const initialPayment = Number(
      customerForm.initialPayment
    );

    if (
      Number.isNaN(initialPayment) ||
      initialPayment < 0
    ) {
      alert(
        "Initial payment cannot be negative."
      );
      return;
    }

    // ------------------------------
    // VALIDATE INITIAL PAYMENT
    // ------------------------------
    // Do not allow payment to exceed total.

    if (initialPayment > totalAmount) {
      alert(
        "Initial payment cannot be greater than the total amount."
      );
      return;
    }

    // ------------------------------
    // VALIDATE BALANCE
    // ------------------------------

    let amountToBePaid = Number(
      customerForm.amountToBePaid
    );

    if (
      Number.isNaN(amountToBePaid) ||
      amountToBePaid < 0
    ) {
      amountToBePaid = 0;
    }

    if (amountToBePaid > totalAmount) {
      alert(
        "Amount to be paid cannot be greater than the total amount."
      );
      return;
    }

    // ==========================================
    // UPDATE LOCAL STORAGE
    // ==========================================

    const storedBookings = readBookings();

    const updatedBookings = storedBookings.map(
      (booking) => {
        if (
          String(booking.id) !==
          String(editingCustomer.id)
        ) {
          return booking;
        }

        return {
          ...booking,

          // ------------------------------
          // CUSTOMER
          // ------------------------------

          customerName:
            customerForm.customerName.trim(),

          // Keep possible existing name fields
          // synchronized as well.
          name:
            customerForm.customerName.trim(),

          fullName:
            customerForm.customerName.trim(),

          // ------------------------------
          // PICKUP ADDRESS
          // ------------------------------

          pickupAddress:
            customerForm.pickupAddress.trim(),

          pickupLocation:
            customerForm.pickupAddress.trim(),

          address:
            customerForm.pickupAddress.trim(),

          // ------------------------------
          // WEIGHT
          // ------------------------------

          weight,

          // ------------------------------
          // PAYMENT
          // ------------------------------

          totalAmount,

          initialPayment,

          amountToBePaid,

          // ------------------------------
          // STATUS
          // ------------------------------

          status: customerForm.status,

          // ------------------------------
          // UPDATED TIME
          // ------------------------------

          updatedAt:
            new Date().toISOString(),
        };
      }
    );

    // ==========================================
    // SAVE
    // ==========================================

    localStorage.setItem(
      "laundrymateBookings",
      JSON.stringify(updatedBookings)
    );

    // Update current page
    setBookings(updatedBookings);

    // Close modal
    setEditingCustomer(null);

    setCustomerForm({
      customerName: "",
      pickupAddress: "",
      weight: "",
      totalAmount: "",
      initialPayment: "",
      amountToBePaid: "",
      status: "Pending",
    });

    // Tell other LaundryMate pages
    window.dispatchEvent(
      new Event("laundrymateBookingUpdated")
    );

    alert(
      "Booking information updated successfully."
    );
  };

  // ==========================================
  // CANCEL MODAL
  // ==========================================

  const handleCancelCustomer = () => {
    setEditingCustomer(null);

    setCustomerForm({
      customerName: "",
      pickupAddress: "",
      weight: "",
      totalAmount: "",
      initialPayment: "",
      amountToBePaid: "",
      status: "Pending",
    });
  };

  // ==========================================
  // FILTER + SORT
  // ==========================================

  const filteredBookings = bookings
    .filter((booking) => {
      const query = search
        .trim()
        .toLowerCase();

      const services = Array.isArray(
        booking.services
      )
        ? booking.services.join(", ")
        : booking.services || "";

      const referenceNumber =
        getPaymentReference(booking.id);

      const customerName =
        getCustomerName(booking);

      const weight =
        booking.weight ?? "";

      const initialPayment =
        getInitialPayment(booking);

      const totalAmount =
        getTotalAmount(booking);

      const amountToBePaid =
        getAmountToBePaid(booking);

      const searchableText = [
        booking.id,
        customerName,
        booking.address,
        booking.pickupAddress,
        booking.pickupLocation,
        booking.barangay,
        booking.city,
        booking.province,
        weight,
        initialPayment,
        totalAmount,
        amountToBePaid,
        services,
        referenceNumber,
        booking.status,
      ]
        .filter(
          (value) =>
            value !== undefined &&
            value !== null &&
            value !== ""
        )
        .join(" ")
        .toLowerCase();

      return (
        (!statusFilter ||
          booking.status === statusFilter) &&
        (!query ||
          searchableText.includes(query))
      );
    })
    .sort((a, b) => {
      const dateA = new Date(
        a.createdAt ||
          a.created_at ||
          a.updatedAt ||
          a.schedule ||
          0
      ).getTime();

      const dateB = new Date(
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
            Manage customer bookings, laundry
            details, payments, and status
          </p>
        </div>

        <div className="booking-count">
          {filteredBookings.length}{" "}
          {filteredBookings.length === 1
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

          {STATUS_FLOW.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status}
            </option>
          ))}

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
          TABLE
      ==================================== */}

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

              filteredBookings.map(
                (booking) => {

                  const customerName =
                    getCustomerName(
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

                  const isEditing =
                    editingWeight ===
                    booking.id;

                  const initialPayment =
                    getInitialPayment(
                      booking
                    );

                  const totalAmount =
                    getTotalAmount(
                      booking
                    );

                  const amountToBePaid =
                    getAmountToBePaid(
                      booking
                    );

                  const location =
                    getPickupLocation(
                      booking
                    );

                  return (
                    <tr
                      key={booking.id}
                    >

                      {/* BOOKING ID */}

                      <td>
                        <span className="booking-id">
                          #{booking.id || "N/A"}
                        </span>
                      </td>

                      {/* CUSTOMER */}

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

                      {/* SERVICE */}

                      <td>
                        <span className="service-name">
                          {services}
                        </span>
                      </td>

                      {/* WEIGHT */}

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
                                    event.target.value
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

                          </div>

                        )}

                      </td>

                      {/* TOTAL AMOUNT */}

                      <td>
                        <span className="total-amount">
                          {formatCurrency(
                            totalAmount
                          )}
                        </span>
                      </td>

                      {/* INITIAL PAYMENT */}

                      <td>
                        <span className="payment-amount">
                          {formatCurrency(
                            initialPayment
                          )}
                        </span>
                      </td>

                      {/* AMOUNT TO BE PAID */}

                      <td>
                        <span className="amount-to-be-paid">
                          {formatCurrency(
                            amountToBePaid
                          )}
                        </span>
                      </td>

                      {/* PICKUP LOCATION */}

                      <td>
                        <div className="pickup-location">
                          {location}
                        </div>
                      </td>

                      {/* STATUS */}

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

                      {/* PICKUP DATE */}

                      <td>
                        {formatDate(
                          booking.schedule
                        )}
                      </td>

                      {/* ACTION */}

                      <td>

                        <button
                          type="button"
                          className="update-status-btn"
                          onClick={() =>
                            handleEditCustomer(
                              booking
                            )
                          }
                        >
                          Update Status
                        </button>

                      </td>

                    </tr>
                  );
                }
              )

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
                    Try changing your search
                    or status filter.
                  </span>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

      {/* ==========================================
          UPDATE BOOKING MODAL
          ALL FIELDS EDITABLE
      ========================================== */}

      {editingCustomer && (

        <div
          className="customer-modal-overlay"
          onClick={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              handleCancelCustomer();
            }

          }}
        >

          <div className="customer-modal">

            {/* MODAL HEADER */}

            <div className="customer-modal-header">

              <div>

                <h2>
                  Update Booking Status
                </h2>

                <p>
                  Booking #
                  {editingCustomer.id}
                </p>

              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={
                  handleCancelCustomer
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="customer-modal-body">

              {/* CUSTOMER NAME */}

              <div className="form-group">

                <label htmlFor="customerName">
                  Customer Name
                </label>

                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  value={
                    customerForm.customerName
                  }
                  onChange={
                    handleCustomerFormChange
                  }
                  placeholder="Enter customer name"
                />

              </div>

              {/* PICKUP ADDRESS */}

              <div className="form-group">

                <label htmlFor="pickupAddress">
                  Pickup Address
                </label>

                <textarea
                  id="pickupAddress"
                  name="pickupAddress"
                  value={
                    customerForm.pickupAddress
                  }
                  onChange={
                    handleCustomerFormChange
                  }
                  placeholder="Enter pickup address"
                  rows="3"
                />

              </div>

              {/* TWO COLUMN ROW */}

              <div className="form-row">

                {/* WEIGHT */}

                <div className="form-group">

                  <label htmlFor="weight">
                    Weight
                  </label>

                  <div className="input-with-unit">

                    <input
                      id="weight"
                      name="weight"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={
                        customerForm.weight
                      }
                      onChange={
                        handleCustomerFormChange
                      }
                      placeholder="0"
                    />

                    <span>
                      kg
                    </span>

                  </div>

                </div>

                {/* TOTAL AMOUNT */}

                <div className="form-group">

                  <label htmlFor="totalAmount">
                    Total Amount
                  </label>

                  <div className="input-with-prefix">

                    <span>
                      ₱
                    </span>

                    <input
                      id="totalAmount"
                      name="totalAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        customerForm.totalAmount
                      }
                      onChange={
                        handleCustomerFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

              </div>

              {/* TWO COLUMN ROW */}

              <div className="form-row">

                {/* INITIAL PAYMENT */}

                <div className="form-group">

                  <label htmlFor="initialPayment">
                    Initial Payment
                  </label>

                  <div className="input-with-prefix">

                    <span>
                      ₱
                    </span>

                    <input
                      id="initialPayment"
                      name="initialPayment"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        customerForm.initialPayment
                      }
                      onChange={
                        handleCustomerFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

                {/* AMOUNT TO BE PAID */}

                <div className="form-group">

                  <label htmlFor="amountToBePaid">
                    Amount to be Paid
                  </label>

                  <div className="input-with-prefix">

                    <span>
                      ₱
                    </span>

                    <input
                      id="amountToBePaid"
                      name="amountToBePaid"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        customerForm.amountToBePaid
                      }
                      onChange={
                        handleCustomerFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

              </div>

              {/* STATUS */}

              <div className="form-group">

                <label htmlFor="status">
                  Booking Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={
                    customerForm.status
                  }
                  onChange={
                    handleCustomerFormChange
                  }
                >

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

              </div>

              {/* PAYMENT SUMMARY */}

              <div className="booking-summary">

                <div className="summary-item">

                  <span>
                    Total Amount
                  </span>

                  <strong>
                    {formatCurrency(
                      customerForm.totalAmount
                    )}
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Initial Payment
                  </span>

                  <strong>
                    {formatCurrency(
                      customerForm.initialPayment
                    )}
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Remaining Balance
                  </span>

                  <strong>
                    {formatCurrency(
                      customerForm.amountToBePaid
                    )}
                  </strong>

                </div>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="customer-modal-footer">

              <button
                type="button"
                className="customer-cancel-btn"
                onClick={
                  handleCancelCustomer
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="customer-save-btn"
                onClick={
                  handleSaveCustomer
                }
              >
                Update Status
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Bookings;