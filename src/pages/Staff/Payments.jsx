import { useEffect, useState } from "react";
import { getAllPayments, updatePaymentStatus, getRevenueSummary } from "../../services/paymentService";
import "../../styles/StaffPayments.css";

function StaffPayments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    total_revenue: 0,
    pending_revenue: 0,
    paid_count: 0,
    pending_count: 0,
  });
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const paymentList = await getAllPayments();
        setPayments(paymentList);

        const revenueSummary = await getRevenueSummary();
        setSummary(revenueSummary);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const handleUpdatePaymentStatus = async (paymentId, currentStatus) => {
    if (currentStatus === "Paid") {
      alert("Payment is already marked as paid.");
      return;
    }

    if (!confirm("Mark this payment as received?")) {
      return;
    }

    setActionLoading(true);
    try {
      await updatePaymentStatus(paymentId, "Paid");

      // Update UI
      const updatedPayments = payments.map((p) =>
        p.id === paymentId ? { ...p, payment_status: "Paid" } : p
      );
      setPayments(updatedPayments);

      // Update summary
      const newSummary = await getRevenueSummary();
      setSummary(newSummary);

      alert("Payment status updated successfully!");
    } catch (error) {
      console.error("Error updating payment status:", error);
      alert("Error updating payment status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesStatus =
      filterStatus === "All" || payment.payment_status === filterStatus;
    const matchesSearch =
      searchTerm === "" ||
      payment.booking_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="staff-payments-page">
      <div className="page-header">
        <h1>Payments Management</h1>
        <p>Track and manage all laundry service payments</p>
      </div>

      {loading ? (
        <div className="loading-message">Loading payments...</div>
      ) : (
        <>

          {/* FILTERS */}
          <div className="payment-filters">
            <div className="filter-group">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="filter-group">
              <input
                type="search"
                placeholder="Search by booking ID or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>

          {/* PAYMENTS TABLE */}
          <div className="payments-section">
            <h2>Payment Records</h2>
            <div className="table-wrapper">
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Payment Status</th>
                    <th>Payment Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          <strong>
                            #{payment.booking_id?.slice(-4) || "N/A"}
                          </strong>
                        </td>
                        <td>{payment.customer?.name || "Unknown"}</td>
                        <td className="amount">₱{payment.amount}</td>
                        <td>
                          <span className={`method-badge ${payment.payment_method === "Online Payment" ? "online" : "cash"}`}>
                            {payment.payment_method || "Cash"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              payment.payment_status === "Paid" ? "paid" : "pending"
                            }`}
                          >
                            {payment.payment_status || "Pending"}
                          </span>
                        </td>
                        <td>
                          {payment.payment_status === "Paid"
                            ? formatDate(payment.payment_date)
                            : "-"}
                        </td>
                        <td>
                          <button
                            className={`btn btn-small ${
                              payment.payment_status === "Paid"
                                ? "btn-disabled"
                                : "btn-success"
                            }`}
                            onClick={() =>
                              handleUpdatePaymentStatus(
                                payment.id,
                                payment.payment_status
                              )
                            }
                            disabled={
                              actionLoading ||
                              payment.payment_status === "Paid"
                            }
                          >
                            {payment.payment_status === "Paid"
                              ? "Paid"
                              : "Mark Paid"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-message">
                        No payments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StaffPayments;
