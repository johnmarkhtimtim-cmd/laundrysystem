import { useEffect, useState } from "react";
import "../../styles/RiderTransactions.css";

// ======================================================
// RIDER TRANSACTION STATUS FLOW
// ======================================================

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

// ======================================================
// LOCAL STORAGE
// ======================================================

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

// ======================================================
// CUSTOMER
// ======================================================

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

// ======================================================
// DATE
// ======================================================

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

// ======================================================
// PAYMENT
// ======================================================

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

function getAmountToBePaid(booking) {
  const totalAmount = getTotalAmount(booking);
  const initialPayment = getInitialPayment(booking);

  const balance = totalAmount - initialPayment;

  return balance < 0 ? 0 : balance;
}

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

// ======================================================
// ADDRESS
// ======================================================

function getPickupLocation(booking) {
  if (!booking) return "N/A";

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

// ======================================================
// CURRENCY
// ======================================================

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

// ======================================================
// RIDER TRANSACTIONS
// ======================================================

function Transaction() {
  const [bookings, setBookings] = useState(readBookings);

  const [statusFilter, setStatusFilter] = useState("");

  const [search, setSearch] = useState("");

  const [editingTransaction, setEditingTransaction] =
    useState(null);

  const [transactionForm, setTransactionForm] = useState({
    customerName: "",
    pickupAddress: "",
    weight: "",
    totalAmount: "",
    initialPayment: "",
    amountToBePaid: "",
    status: "Pending",
  });

  // ====================================================
  // LOAD BOOKINGS
  // ====================================================

  const loadBookings = () => {
    setBookings(readBookings());
  };

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
      window.removeEventListener("storage", loadBookings);

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

  // ====================================================
  // OPEN UPDATE MODAL
  // ====================================================

  const handleEditTransaction = (booking) => {
    const totalAmount = getTotalAmount(booking);

    const initialPayment =
      getInitialPayment(booking);

    setEditingTransaction(booking);

    setTransactionForm({
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

  // ====================================================
  // FORM CHANGE
  // ====================================================

  const handleTransactionFormChange = (event) => {
    const { name, value } = event.target;

    setTransactionForm((previous) => {
      const updated = {
        ...previous,
        [name]: value,
      };

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

  // ====================================================
  // SAVE TRANSACTION
  // ====================================================

  const handleSaveTransaction = () => {
    if (!editingTransaction) return;

    if (!transactionForm.customerName.trim()) {
      alert("Customer name is required.");
      return;
    }

    if (!transactionForm.pickupAddress.trim()) {
      alert("Pickup address is required.");
      return;
    }

    const weight = Number(transactionForm.weight);

    if (Number.isNaN(weight) || weight <= 0) {
      alert("Weight must be greater than 0 kg.");
      return;
    }

    const totalAmount =
      Number(transactionForm.totalAmount);

    if (
      Number.isNaN(totalAmount) ||
      totalAmount < 0
    ) {
      alert("Total amount cannot be negative.");
      return;
    }

    const initialPayment =
      Number(transactionForm.initialPayment);

    if (
      Number.isNaN(initialPayment) ||
      initialPayment < 0
    ) {
      alert("Initial payment cannot be negative.");
      return;
    }

    if (initialPayment > totalAmount) {
      alert(
        "Initial payment cannot be greater than the total amount."
      );

      return;
    }

    const amountToBePaid = Math.max(
      0,
      totalAmount - initialPayment
    );

    const storedBookings = readBookings();

    const updatedBookings = storedBookings.map(
      (booking) => {
        if (
          String(booking.id) !==
          String(editingTransaction.id)
        ) {
          return booking;
        }

        return {
          ...booking,

          customerName:
            transactionForm.customerName.trim(),

          name:
            transactionForm.customerName.trim(),

          fullName:
            transactionForm.customerName.trim(),

          pickupAddress:
            transactionForm.pickupAddress.trim(),

          pickupLocation:
            transactionForm.pickupAddress.trim(),

          address:
            transactionForm.pickupAddress.trim(),

          weight,

          totalAmount,

          initialPayment,

          amountToBePaid,

          status: transactionForm.status,

          updatedAt: new Date().toISOString(),
        };
      }
    );

    localStorage.setItem(
      "laundrymateBookings",
      JSON.stringify(updatedBookings)
    );

    setBookings(updatedBookings);

    setEditingTransaction(null);

    resetForm();

    window.dispatchEvent(
      new Event("laundrymateBookingUpdated")
    );

    alert(
      "Transaction updated successfully."
    );
  };

  // ====================================================
  // RESET
  // ====================================================

  const resetForm = () => {
    setTransactionForm({
      customerName: "",
      pickupAddress: "",
      weight: "",
      totalAmount: "",
      initialPayment: "",
      amountToBePaid: "",
      status: "Pending",
    });
  };

  // ====================================================
  // CANCEL
  // ====================================================

  const handleCancelTransaction = () => {
    setEditingTransaction(null);

    resetForm();
  };

  // ====================================================
  // FILTER BOOKINGS
  // ====================================================

  const filteredBookings = bookings
    .filter((booking) => {
      const query =
        search.trim().toLowerCase();

      const services = Array.isArray(
        booking.services
      )
        ? booking.services.join(", ")
        : booking.services || "";

      const referenceNumber =
        getPaymentReference(booking.id);

      const customerName =
        getCustomerName(booking);

      const location =
        getPickupLocation(booking);

      const weight =
        booking.weight ?? "";

      const totalAmount =
        getTotalAmount(booking);

      const initialPayment =
        getInitialPayment(booking);

      const amountToBePaid =
        getAmountToBePaid(booking);

      const searchableText = [
        booking.id,
        customerName,
        location,
        booking.address,
        booking.pickupAddress,
        booking.pickupLocation,
        booking.barangay,
        booking.city,
        booking.province,
        services,
        referenceNumber,
        weight,
        totalAmount,
        initialPayment,
        amountToBePaid,
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

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="rider-transactions">

      {/* HEADER */}
      <div className="section-header">

        <div>
          <h1>Transactions</h1>

          <p>
            Manage customer pickups, laundry
            transactions, payments, and status.
          </p>
        </div>

        <div className="booking-count">
          {filteredBookings.length}{" "}
          {filteredBookings.length === 1
            ? "Transaction"
            : "Transactions"}
        </div>

      </div>

      {/* FILTERS */}
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
            placeholder="Search customer, booking ID, address..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

      </div>

      {/* TABLE */}
      <div className="table-container">

        <table className="bookings-table">

          <thead>
            <tr>

              <th>Booking ID</th>

              <th>Customer</th>

              <th>Weight</th>

              <th>Total Amount</th>

              <th>Initial Payment</th>

              <th>Amount to be Paid</th>

              <th>Pickup Location</th>

              <th>Pickup Date</th>

              <th>Status</th>

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
                          #{booking.id ||
                            "N/A"}
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

                      {/* WEIGHT */}
                      <td>

                        <span className="weight-value">
                          {booking.weight
                            ? `${booking.weight} kg`
                            : "Not set"}
                        </span>

                      </td>

                      {/* TOTAL */}
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

                      {/* BALANCE */}
                      <td>

                        <span className="amount-to-be-paid">
                          {formatCurrency(
                            amountToBePaid
                          )}
                        </span>

                      </td>

                      {/* LOCATION */}
                      <td>

                        <div className="pickup-location">
                          {location}
                        </div>

                      </td>

                      {/* PICKUP DATE */}
                      <td>
                        {formatDate(
                          booking.schedule
                        )}
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

                      {/* ACTION */}
                      <td>

                        <button
                          type="button"
                          className="update-status-btn"
                          onClick={() =>
                            handleEditTransaction(
                              booking
                            )
                          }
                        >
                          Update
                        </button>

                      </td>

                    </tr>
                  );
                }
              )

            ) : (

              <tr>

                <td
                  colSpan="10"
                  className="empty-state"
                >

                  <div className="empty-icon">
                    📋
                  </div>

                  <strong>
                    No transactions found
                  </strong>

                  <span>
                    Try changing your
                    search or status filter.
                  </span>

                </td>

              </tr>
            )}

          </tbody>

        </table>

      </div>

      {/* ==================================================
          UPDATE TRANSACTION MODAL
          ================================================== */}

      {editingTransaction && (

        <div
          className="customer-modal-overlay"
          onClick={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              handleCancelTransaction();
            }

          }}
        >

          <div className="customer-modal">

            {/* MODAL HEADER */}
            <div className="customer-modal-header">

              <div>

                <h2>
                  Update Transaction
                </h2>

                <p>
                  Booking #
                  {editingTransaction.id}
                </p>

              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={
                  handleCancelTransaction
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            {/* MODAL BODY */}
            <div className="customer-modal-body">

              {/* CUSTOMER */}
              <div className="form-group">

                <label htmlFor="customerName">
                  Customer Name
                </label>

                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  value={
                    transactionForm.customerName
                  }
                  onChange={
                    handleTransactionFormChange
                  }
                  placeholder="Customer name"
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
                  rows="3"
                  value={
                    transactionForm.pickupAddress
                  }
                  onChange={
                    handleTransactionFormChange
                  }
                  placeholder="Pickup address"
                />

              </div>

              {/* WEIGHT + TOTAL */}
              <div className="form-row">

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
                        transactionForm.weight
                      }
                      onChange={
                        handleTransactionFormChange
                      }
                      placeholder="0"
                    />

                    <span>
                      kg
                    </span>

                  </div>

                </div>

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
                        transactionForm.totalAmount
                      }
                      onChange={
                        handleTransactionFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

              </div>

              {/* PAYMENTS */}
              <div className="form-row">

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
                        transactionForm.initialPayment
                      }
                      onChange={
                        handleTransactionFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

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
                        transactionForm.amountToBePaid
                      }
                      onChange={
                        handleTransactionFormChange
                      }
                      placeholder="0.00"
                    />

                  </div>

                </div>

              </div>

              {/* STATUS */}
              <div className="form-group">

                <label htmlFor="status">
                  Transaction Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={
                    transactionForm.status
                  }
                  onChange={
                    handleTransactionFormChange
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
                      transactionForm.totalAmount
                    )}
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Initial Payment
                  </span>

                  <strong>
                    {formatCurrency(
                      transactionForm.initialPayment
                    )}
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Remaining Balance
                  </span>

                  <strong>
                    {formatCurrency(
                      transactionForm.amountToBePaid
                    )}
                  </strong>

                </div>

              </div>

            </div>

            {/* FOOTER */}
            <div className="customer-modal-footer">

              <button
                type="button"
                className="customer-cancel-btn"
                onClick={
                  handleCancelTransaction
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="customer-save-btn"
                onClick={
                  handleSaveTransaction
                }
              >
                Update Transaction
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Transaction;