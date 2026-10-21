import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Download,
  CalendarDays,
  PhilippinePeso,
  Package,
  Scale,
  FileText,
} from "lucide-react";

import "../../styles/Report.css";

const BOOKINGS_KEY = "laundrymateBookings";
const COMPLETED_STATUS = "Completed";

/* =========================================================
   READ BOOKINGS
========================================================= */

function readBookings() {
  try {
    const data = JSON.parse(
      localStorage.getItem(BOOKINGS_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to read bookings:", error);
    return [];
  }
}

/* =========================================================
   FORMAT MONEY
========================================================= */

function formatMoney(value) {
  const amount = Number(value) || 0;

  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* =========================================================
   CUSTOMER
========================================================= */

function getCustomerName(booking) {
  return (
    booking.customerName ||
    booking.name ||
    booking.customer?.name ||
    booking.user?.name ||
    booking.customer?.fullName ||
    booking.user?.fullName ||
    "Unknown Customer"
  );
}

/* =========================================================
   BOOKING NUMBER
========================================================= */

function getBookingNumber(booking) {
  return (
    booking.bookingNo ||
    booking.bookingNumber ||
    booking.id ||
    booking.bookingId ||
    "—"
  );
}

/* =========================================================
   SERVICE
========================================================= */

function getServiceType(booking) {
  const services =
    booking.services ||
    booking.service ||
    booking.serviceType ||
    "—";

  if (Array.isArray(services)) {
    return services
      .map((service) => {
        if (typeof service === "string") {
          return service;
        }

        return (
          service?.name ||
          service?.serviceName ||
          "Service"
        );
      })
      .join(", ");
  }

  return String(services);
}

/* =========================================================
   WEIGHT
========================================================= */

function getWeight(booking) {
  const weight =
    booking.weight ??
    booking.kg ??
    booking.laundryWeight ??
    booking.estimatedWeight ??
    booking.actualWeight ??
    0;

  const numericWeight = Number(weight);

  return Number.isFinite(numericWeight)
    ? numericWeight
    : 0;
}

/* =========================================================
   TOTAL AMOUNT
========================================================= */

function getTotalAmount(booking) {
  const amount =
    booking.totalAmount ??
    booking.amountToPay ??
    booking.finalAmount ??
    booking.estimatedTotal ??
    booking.total ??
    booking.amount ??
    0;

  const numericAmount = Number(amount);

  return Number.isFinite(numericAmount)
    ? numericAmount
    : 0;
}

/* =========================================================
   STAFF
========================================================= */

function getStaffName(booking) {
  return (
    booking.staffName ||
    booking.assignedStaffName ||
    booking.updatedByName ||
    booking.staff?.name ||
    booking.assignedStaff?.name ||
    "—"
  );
}

/* =========================================================
   PAYMENT STATUS
========================================================= */

function getPaymentStatus(booking) {
  const payment =
    booking.paymentStatus ??
    booking.payment_status ??
    booking.payment?.status ??
    booking.payment?.paymentStatus ??
    booking.transaction?.paymentStatus ??
    booking.isPaid;

  /*
    Support boolean isPaid fields
  */
  if (payment === true) {
    return "Paid";
  }

  if (payment === false) {
    return "Unpaid";
  }

  if (!payment) {
    return "Unpaid";
  }

  const normalized = String(payment)
    .trim()
    .toLowerCase();

  if (
    normalized === "paid" ||
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "successful"
  ) {
    return "Paid";
  }

  if (
    normalized === "pending" ||
    normalized === "processing"
  ) {
    return "Pending";
  }

  if (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "Failed";
  }

  return String(payment);
}

/* =========================================================
   PAYMENT STATUS CLASS
========================================================= */

function getPaymentStatusClass(status) {
  return status
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/* =========================================================
   REPORT COMPONENT
========================================================= */

function Report() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);

  /* =======================================================
     LOAD BOOKINGS
  ======================================================= */

  const loadBookings = () => {
    setLoading(true);

    const data = readBookings();

    data.sort((a, b) => {
      const dateA = new Date(
        a.updatedAt || a.createdAt || 0
      ).getTime();

      const dateB = new Date(
        b.updatedAt || b.createdAt || 0
      ).getTime();

      return dateB - dateA;
    });

    setBookings(data);
    setLoading(false);
  };

  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    loadBookings();

    const handleBookingUpdate = () => {
      loadBookings();
    };

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === BOOKINGS_KEY
      ) {
        loadBookings();
      }
    };

    window.addEventListener(
      "laundrymateBookingUpdated",
      handleBookingUpdate
    );

    window.addEventListener(
      "laundrymateBookingsUpdated",
      handleBookingUpdate
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    const interval = setInterval(
      loadBookings,
      2000
    );

    return () => {
      window.removeEventListener(
        "laundrymateBookingUpdated",
        handleBookingUpdate
      );

      window.removeEventListener(
        "laundrymateBookingsUpdated",
        handleBookingUpdate
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );

      clearInterval(interval);
    };
  }, []);

  /* =======================================================
     REPORT DATA
  ======================================================= */

  const reportData = useMemo(() => {
    return bookings.map((booking) => ({
      original: booking,

      customerName: getCustomerName(booking),

      bookingNumber: getBookingNumber(booking),

      serviceType: getServiceType(booking),

      weight: getWeight(booking),

      totalAmount: getTotalAmount(booking),

      staffName: getStaffName(booking),

      status:
        ["Washing", "Drying", "Folding"].includes(booking.status)
          ? "In Laundry"
          : booking.status === "Ready for Customer Pickup"
          ? "To Deliver"
          : booking.status || "Pending",

      paymentStatus: getPaymentStatus(booking),

      createdAt:
        booking.updatedAt ||
        booking.createdAt ||
        booking.schedule ||
        "",
    }));
  }, [bookings]);

  /* =======================================================
     FILTER REPORT
  ======================================================= */

  const filteredReports = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return reportData.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.customerName
          .toLowerCase()
          .includes(keyword) ||
        String(item.bookingNumber)
          .toLowerCase()
          .includes(keyword) ||
        item.serviceType
          .toLowerCase()
          .includes(keyword) ||
        item.staffName
          .toLowerCase()
          .includes(keyword) ||
        item.paymentStatus
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      const matchesPayment =
        paymentFilter === "All" ||
        item.paymentStatus === paymentFilter;

      let matchesDate = true;

      if (dateFilter) {
        const itemDate = new Date(
          item.createdAt
        );

        if (!Number.isNaN(itemDate.getTime())) {
          const year = itemDate.getFullYear();

          const month = String(
            itemDate.getMonth() + 1
          ).padStart(2, "0");

          const day = String(
            itemDate.getDate()
          ).padStart(2, "0");

          const formattedDate =
            `${year}-${month}-${day}`;

          matchesDate =
            formattedDate === dateFilter;
        } else {
          matchesDate = false;
        }
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesDate
      );
    });
  }, [
    reportData,
    search,
    statusFilter,
    paymentFilter,
    dateFilter,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    const totalOrders =
      filteredReports.length;

    const totalWeight =
      filteredReports.reduce(
        (sum, item) =>
          sum + Number(item.weight || 0),
        0
      );

    const totalSales =
      filteredReports.reduce(
        (sum, item) =>
          sum + Number(item.totalAmount || 0),
        0
      );

    const completedOrders =
      filteredReports.filter(
        (item) =>
          item.status === COMPLETED_STATUS
      ).length;

    const paidSales =
      filteredReports
        .filter(
          (item) =>
            item.paymentStatus === "Paid"
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.totalAmount || 0),
          0
        );

    return {
      totalOrders,
      totalWeight,
      totalSales,
      completedOrders,
      paidSales,
    };
  }, [filteredReports]);

  /* =======================================================
     EXPORT CSV
  ======================================================= */

  const exportCSV = () => {
    if (!filteredReports.length) {
      alert(
        "There is no report data to export."
      );
      return;
    }

    const headers = [
      "Customer Name",
      "Booking No.",
      "Service Type",
      "Weight (kg)",
      "Total Amount",
      "Payment Status",
      "Staff",
      "Booking Status",
      "Date",
    ];

    const rows = filteredReports.map(
      (item) => [
        item.customerName,
        item.bookingNumber,
        item.serviceType,
        item.weight,
        item.totalAmount,
        item.paymentStatus,
        item.staffName,
        item.status,
        formatDate(item.createdAt),
      ]
    );

    const csvContent = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            ).replace(/"/g, '""');

            return `"${text}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `LaundryMate-Sales-Report-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =======================================================
     RESET FILTERS
  ======================================================= */

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPaymentFilter("All");
    setDateFilter("");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="sales-report-page">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="report-header">

        <div>
          <div className="report-title-row">

            <div className="report-title-icon">
              <FileText size={24} />
            </div>

            <div>
              <h1>Sales Report</h1>

              <p>
                Monitor laundry bookings, weights,
                services, payments, and total sales.
              </p>
            </div>

          </div>
        </div>

        <div className="report-header-actions">

          <button
            className="report-btn secondary"
            onClick={loadBookings}
            type="button"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            className="report-btn primary"
            onClick={exportCSV}
            type="button"
          >
            <Download size={17} />
            Export CSV
          </button>

        </div>

      </div>

      {/* ===================================================
          SUMMARY CARDS
      =================================================== */}

      <div className="sales-summary-grid">

        <div className="sales-summary-card">

          <div className="summary-icon">
            <Package size={21} />
          </div>

          <div>
            <span>Total Orders</span>

            <strong>
              {summary.totalOrders}
            </strong>
          </div>

        </div>

        <div className="sales-summary-card">

          <div className="summary-icon">
            <Scale size={21} />
          </div>

          <div>
            <span>Total Weight</span>

            <strong>
              {summary.totalWeight.toFixed(2)} kg
            </strong>
          </div>

        </div>

        <div className="sales-summary-card">

          <div className="summary-icon">
            <PhilippinePeso size={21} />
          </div>

          <div>
            <span>Total Sales</span>

            <strong>
              {formatMoney(
                summary.totalSales
              )}
            </strong>
          </div>

        </div>

        <div className="sales-summary-card">

          <div className="summary-icon">
            <PhilippinePeso size={21} />
          </div>

          <div>
            <span>Paid Sales</span>

            <strong>
              {formatMoney(
                summary.paidSales
              )}
            </strong>
          </div>

        </div>

      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div className="report-filter-card">

        <div className="report-search">

          <Search size={18} />

          <input
            type="text"
            placeholder="Search customer, booking no., service..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

        <div className="report-filter">

          <label>Status</label>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
          >
            <option value="All">
              All Status
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Accepted">
              Accepted
            </option>

            <option value="Ready for Pickup">
              Ready for Pickup
            </option>

            <option value="Picked Up">
              Picked Up
            </option>

            <option value="In Laundry">
              In Laundry
            </option>

            <option value="To Deliver">
              To Deliver
            </option>

            <option value="Delivered">
              Delivered
            </option>

            <option value="Completed">
              Completed
            </option>

          </select>

        </div>

        {/* PAYMENT FILTER */}

        <div className="report-filter">

          <label>Payment</label>

          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(
                e.target.value
              )
            }
          >
            <option value="All">
              All Payments
            </option>

            <option value="Paid">
              Paid
            </option>

            <option value="Unpaid">
              Unpaid
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Failed">
              Failed
            </option>

          </select>

        </div>

        <div className="report-filter">

          <label>Date</label>

          <div className="date-input">

            <CalendarDays size={17} />

            <input
              type="date"
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value
                )
              }
            />

          </div>

        </div>

        <button
          className="clear-filter-btn"
          onClick={resetFilters}
          type="button"
        >
          Clear
        </button>

      </div>

      {/* ===================================================
          SALES TABLE
      =================================================== */}

      <div className="report-table-card">

        <div className="report-table-header">

          <div>
            <h2>Sales Transactions</h2>

            <p>
              {filteredReports.length} transaction
              {filteredReports.length !== 1
                ? "s"
                : ""}{" "}
              found
            </p>
          </div>

          <span className="live-indicator">
            <span></span>
            Live Data
          </span>

        </div>

        {loading ? (

          <div className="report-empty">

            <RefreshCw
              className="loading-icon"
              size={28}
            />

            <p>
              Loading sales report...
            </p>

          </div>

        ) : filteredReports.length === 0 ? (

          <div className="report-empty">

            <FileText size={42} />

            <h3>
              No sales records found
            </h3>

            <p>
              Sales transactions from Staff
              Bookings will appear here.
            </p>

          </div>

        ) : (

          <div className="report-table-wrapper">

            <table className="sales-report-table">

              <thead>

                <tr>

                  <th>#</th>

                  <th>
                    Customer Name
                  </th>

                  <th>
                    Booking No.
                  </th>

                  <th>
                    Service Type
                  </th>

                  <th>
                    Weight
                  </th>

                  <th>
                    Total Amount
                  </th>

                  <th>
                    Payment Status
                  </th>

                  <th>
                    Staff
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Date
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredReports.map(
                  (item, index) => (

                    <tr
                      key={
                        item.bookingNumber ||
                        index
                      }
                    >

                      <td>
                        {index + 1}
                      </td>

                      {/* CUSTOMER */}

                      <td>

                        <div className="customer-cell">

                          <div className="customer-avatar">
                            {item.customerName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <strong>
                            {item.customerName}
                          </strong>

                        </div>

                      </td>

                      {/* BOOKING */}

                      <td>

                        <span className="booking-number">
                          {item.bookingNumber}
                        </span>

                      </td>

                      {/* SERVICE */}

                      <td>

                        <div className="service-cell">
                          {item.serviceType}
                        </div>

                      </td>

                      {/* WEIGHT */}

                      <td>

                        <span className="weight-value">
                          {item.weight.toFixed(2)}
                          {" "}kg
                        </span>

                      </td>

                      {/* TOTAL */}

                      <td>

                        <strong className="amount-value">
                          {formatMoney(
                            item.totalAmount
                          )}
                        </strong>

                      </td>

                      {/* PAYMENT STATUS */}

                      <td>

                        <span
                          className={`payment-status-badge payment-${getPaymentStatusClass(
                            item.paymentStatus
                          )}`}
                        >
                          {item.paymentStatus}
                        </span>

                      </td>

                      {/* STAFF */}

                      <td>
                        {item.staffName}
                      </td>

                      {/* BOOKING STATUS */}

                      <td>

                        <span
                          className={`status-badge status-${item.status
                            .toLowerCase()
                            .replace(
                              /[^a-z0-9]+/g,
                              "-"
                            )}`}
                        >
                          {item.status}
                        </span>

                      </td>

                      {/* DATE */}

                      <td>
                        {formatDate(
                          item.createdAt
                        )}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}

export default Report;