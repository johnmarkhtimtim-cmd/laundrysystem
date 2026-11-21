import { useEffect, useMemo, useState } from "react";
import { subscribeToAllBookings } from "../../services/bookingService";
import {
  archiveUserAccount,
  countBookingsByCustomer,
  deleteUserAccount,
  subscribeToUsersByRoles,
  unarchiveUserAccount,
  updateUserStatus,
} from "../../services/userService";
import "../../styles/AdminCustomer.css";

function formatJoined(value) {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AdminCustomer() {
  const [customers, setCustomers] = useState([]);
  const [orderCounts, setOrderCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [listFilter, setListFilter] = useState("active");

  useEffect(() => {
    const unsubscribeUsers = subscribeToUsersByRoles(
      ["customer"],
      (users) => {
        setCustomers(users);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        console.error(loadError);
        setError("Unable to load customers.");
        setLoading(false);
      }
    );

    const unsubscribeBookings = subscribeToAllBookings(
      (bookings) => setOrderCounts(countBookingsByCustomer(bookings)),
      (bookingError) => console.error(bookingError)
    );

    return () => {
      unsubscribeUsers?.();
      unsubscribeBookings?.();
    };
  }, []);

  const customersWithOrders = useMemo(
    () =>
      customers.map((customer) => ({
        ...customer,
        totalOrders: orderCounts[customer.id] || 0,
        joined: formatJoined(customer.createdAt),
      })),
    [customers, orderCounts]
  );

  const filteredCustomers = customersWithOrders.filter((customer) => {
    const isArchived = customer.status === "Archived";
    if (listFilter === "archived" ? !isArchived : isArchived) return false;

    const searchText = search.toLowerCase();
    return (
      customer.id.toLowerCase().includes(searchText) ||
      customer.firstName.toLowerCase().includes(searchText) ||
      customer.lastName.toLowerCase().includes(searchText) ||
      customer.email.toLowerCase().includes(searchText) ||
      String(customer.phone).includes(searchText)
    );
  });

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  const toggleStatus = async (id) => {
    const customer = customersWithOrders.find((item) => item.id === id);
    if (!customer || customer.status === "Archived") return;
    const nextStatus = customer.status === "Active" ? "Inactive" : "Active";
    setActionLoading(id);
    try {
      await updateUserStatus(id, nextStatus);
    } catch (statusError) {
      console.error(statusError);
      alert("Could not update customer status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (customer) => {
    const label = customer.firstName || customer.name || "this customer";
    const isArchived = customer.status === "Archived";
    const confirmed = window.confirm(
      isArchived
        ? `Restore ${label} to Active?`
        : `Archive ${label}? They will be hidden from the active list.`
    );
    if (!confirmed) return;

    setActionLoading(customer.id);
    try {
      if (isArchived) {
        await unarchiveUserAccount(customer.id);
      } else {
        await archiveUserAccount(customer.id);
      }
      if (selectedCustomer?.id === customer.id) {
        setShowDetails(false);
        setSelectedCustomer(null);
      }
    } catch (archiveError) {
      console.error(archiveError);
      alert(
        isArchived
          ? "Could not restore customer."
          : "Could not archive customer."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    const customer = customersWithOrders.find((item) => item.id === id);
    if (!customer) return;
    const confirmDelete = window.confirm(
      `Permanently delete ${customer.firstName || customer.name}? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setActionLoading(id);
    try {
      await deleteUserAccount(id);
      if (selectedCustomer?.id === id) {
        setShowDetails(false);
        setSelectedCustomer(null);
      }
    } catch (deleteError) {
      console.error(deleteError);
      alert("Could not delete customer.");
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (customer) => {
    const first = (customer.firstName || customer.name || "C").charAt(0);
    const last = (customer.lastName || " ").charAt(0);
    return `${first}${last}`.toUpperCase();
  };

  const activeList = customersWithOrders.filter(
    (customer) => customer.status !== "Archived"
  );
  const archivedList = customersWithOrders.filter(
    (customer) => customer.status === "Archived"
  );
  const totalCustomers = activeList.length;
  const activeCustomers = activeList.filter(
    (customer) => customer.status === "Active"
  ).length;
  const inactiveCustomers = activeList.filter(
    (customer) => customer.status === "Inactive"
  ).length;
  const archivedCustomers = archivedList.length;

  return (
    <div className="admin-customer">
      <div className="customer-page-header">
        <div>
          <span className="customer-page-label">LAUNDRYMATE ADMIN</span>
          <h1>Customers</h1>
          <p>Live registered customers from Firestore.</p>
        </div>
      </div>

      {error && (
        <div className="customer-stat-card" style={{ marginBottom: 16, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div className="customer-stat-grid customer-stat-grid-4">
        <div className="customer-stat-card">
          <div className="customer-stat-icon blue">👥</div>
          <div>
            <span>Total Customers</span>
            <strong>{loading ? "…" : totalCustomers}</strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon green">✓</div>
          <div>
            <span>Active Customers</span>
            <strong>{loading ? "…" : activeCustomers}</strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon gray">○</div>
          <div>
            <span>Inactive Customers</span>
            <strong>{loading ? "…" : inactiveCustomers}</strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon amber">📦</div>
          <div>
            <span>Archived</span>
            <strong>{loading ? "…" : archivedCustomers}</strong>
          </div>
        </div>
      </div>

      <div className="customer-list-container">
        <div className="customer-list-header">
          <div>
            <h2>
              {listFilter === "archived" ? "Archived Customers" : "Customer List"}
            </h2>
            <p>
              {listFilter === "archived"
                ? "Restore or permanently delete archived accounts."
                : "Auto-updates when customers register or change status."}
            </p>
          </div>
          <div className="customer-list-tools">
            <div className="customer-filter-tabs">
              <button
                type="button"
                className={listFilter === "active" ? "active" : ""}
                onClick={() => setListFilter("active")}
              >
                Active ({totalCustomers})
              </button>
              <button
                type="button"
                className={listFilter === "archived" ? "active" : ""}
                onClick={() => setListFilter("archived")}
              >
                Archived ({archivedCustomers})
              </button>
            </div>
            <div className="customer-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Orders</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="customer-empty">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="customer-profile">
                        <div className="customer-avatar">{getInitials(customer)}</div>
                        <div className="customer-name">
                          <strong>
                            {customer.firstName} {customer.lastName}
                          </strong>
                          <span>#{customer.id.slice(-6)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="customer-contact">
                        <span>{customer.email || "—"}</span>
                        <small>{customer.phone || "—"}</small>
                      </div>
                    </td>
                    <td>
                      <span className="order-count">{customer.totalOrders}</span>
                    </td>
                    <td>
                      <span className="joined-date">{customer.joined}</span>
                    </td>
                    <td>
                      <button
                        className={`customer-status ${customer.status.toLowerCase()}`}
                        onClick={() => toggleStatus(customer.id)}
                        disabled={
                          actionLoading === customer.id ||
                          customer.status === "Archived"
                        }
                        title={
                          customer.status === "Archived"
                            ? "Restore to change status"
                            : "Toggle active/inactive"
                        }
                      >
                        <span></span>
                        {customer.status}
                      </button>
                    </td>
                    <td>
                      <div className="customer-actions">
                        <button
                          className="customer-view-btn"
                          title="View customer"
                          onClick={() => handleView(customer)}
                        >
                          👁
                        </button>
                        <button
                          className="customer-archive-btn"
                          title={
                            customer.status === "Archived"
                              ? "Restore customer"
                              : "Archive customer"
                          }
                          onClick={() => handleArchive(customer)}
                          disabled={actionLoading === customer.id}
                        >
                          {customer.status === "Archived" ? "↺" : "📦"}
                        </button>
                        <button
                          className="customer-delete-btn"
                          title="Delete customer"
                          onClick={() => handleDelete(customer.id)}
                          disabled={actionLoading === customer.id}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="customer-empty">
                    <div className="empty-customer-icon">🔍</div>
                    <h3>No customers found</h3>
                    <p>Registered customers will appear here automatically.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetails && selectedCustomer && (
        <div
          className="customer-modal-overlay"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="customer-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <span>CUSTOMER DETAILS</span>
                <h2>Customer Information</h2>
              </div>
              <button
                className="customer-close-btn"
                onClick={() => setShowDetails(false)}
              >
                ×
              </button>
            </div>

            <div className="customer-modal-profile">
              <div className="customer-modal-avatar">
                {getInitials(selectedCustomer)}
              </div>
              <div>
                <h3>
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h3>
                <p>#{selectedCustomer.id.slice(-6)}</p>
                <span
                  className={`customer-status ${selectedCustomer.status.toLowerCase()}`}
                >
                  <span></span>
                  {selectedCustomer.status}
                </span>
              </div>
            </div>

            <div className="customer-detail-grid">
              <div className="customer-detail-item">
                <span>Email Address</span>
                <strong>{selectedCustomer.email || "—"}</strong>
              </div>
              <div className="customer-detail-item">
                <span>Phone Number</span>
                <strong>{selectedCustomer.phone || "—"}</strong>
              </div>
              <div className="customer-detail-item">
                <span>Total Orders</span>
                <strong>{selectedCustomer.totalOrders}</strong>
              </div>
              <div className="customer-detail-item">
                <span>Date Joined</span>
                <strong>{selectedCustomer.joined}</strong>
              </div>
              <div className="customer-detail-item full">
                <span>Address</span>
                <strong>{selectedCustomer.address || "—"}</strong>
              </div>
            </div>

            <div className="customer-modal-footer">
              <button
                className="customer-modal-close"
                onClick={() => setShowDetails(false)}
              >
                Close
              </button>
              <button
                className="customer-archive-btn customer-modal-action"
                type="button"
                onClick={() => handleArchive(selectedCustomer)}
                disabled={actionLoading === selectedCustomer.id}
              >
                {selectedCustomer.status === "Archived"
                  ? "Restore"
                  : "Archive"}
              </button>
              <button
                className="customer-delete-btn customer-modal-action"
                type="button"
                onClick={() => handleDelete(selectedCustomer.id)}
                disabled={actionLoading === selectedCustomer.id}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCustomer;
