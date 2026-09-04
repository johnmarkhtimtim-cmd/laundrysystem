import { useState } from "react";
import "../../styles/AdminCustomer.css";

const initialCustomers = [
  {
    id: "CUS-001",
    firstName: "John Mark",
    lastName: "Timtim",
    email: "johnmark@email.com",
    phone: "0912 345 6789",
    address: "San Antonio, Santa Rosa, Laguna",
    totalOrders: 12,
    status: "Active",
    joined: "Aug 12, 2026",
  },
  {
    id: "CUS-002",
    firstName: "Maria",
    lastName: "Santos",
    email: "maria.santos@email.com",
    phone: "0917 234 5678",
    address: "Balibago, Santa Rosa, Laguna",
    totalOrders: 8,
    status: "Active",
    joined: "Aug 15, 2026",
  },
  {
    id: "CUS-003",
    firstName: "James",
    lastName: "Garcia",
    email: "james.garcia@email.com",
    phone: "0920 456 7890",
    address: "Canlalay, Biñan, Laguna",
    totalOrders: 5,
    status: "Inactive",
    joined: "Aug 18, 2026",
  },
  {
    id: "CUS-004",
    firstName: "Angela",
    lastName: "Reyes",
    email: "angela.reyes@email.com",
    phone: "0935 678 1234",
    address: "Malaban, Cabuyao, Laguna",
    totalOrders: 15,
    status: "Active",
    joined: "Aug 20, 2026",
  },
  {
    id: "CUS-005",
    firstName: "Michael",
    lastName: "Dela Cruz",
    email: "michael.delacruz@email.com",
    phone: "0945 789 2345",
    address: "Poblacion, Santa Rosa, Laguna",
    totalOrders: 3,
    status: "Active",
    joined: "Aug 25, 2026",
  },
];

function AdminCustomer() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // =====================================
  // SEARCH CUSTOMER
  // =====================================

  const filteredCustomers = customers.filter((customer) => {
    const searchText = search.toLowerCase();

    return (
      customer.id.toLowerCase().includes(searchText) ||
      customer.firstName.toLowerCase().includes(searchText) ||
      customer.lastName.toLowerCase().includes(searchText) ||
      customer.email.toLowerCase().includes(searchText) ||
      customer.phone.includes(searchText)
    );
  });

  // =====================================
  // VIEW CUSTOMER
  // =====================================

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setShowDetails(true);
  };

  // =====================================
  // TOGGLE CUSTOMER STATUS
  // =====================================

  const toggleStatus = (id) => {
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id
          ? {
              ...customer,
              status:
                customer.status === "Active"
                  ? "Inactive"
                  : "Active",
            }
          : customer
      )
    );
  };

  // =====================================
  // DELETE CUSTOMER
  // =====================================

  const handleDelete = (id) => {
    const customer = customers.find(
      (item) => item.id === id
    );

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${customer.firstName} ${customer.lastName}?`
    );

    if (!confirmDelete) return;

    setCustomers((prev) =>
      prev.filter((customer) => customer.id !== id)
    );
  };

  // =====================================
  // CUSTOMER INITIALS
  // =====================================

  const getInitials = (customer) => {
    return `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`;
  };

  // =====================================
  // SUMMARY
  // =====================================

  const totalCustomers = customers.length;

  const activeCustomers = customers.filter(
    (customer) => customer.status === "Active"
  ).length;

  const inactiveCustomers = customers.filter(
    (customer) => customer.status === "Inactive"
  ).length;

  return (
    <div className="admin-customer">

      {/* =====================================
          PAGE HEADER
      ===================================== */}

      <div className="customer-page-header">

        <div>
          <span className="customer-page-label">
            LAUNDRYMATE ADMIN
          </span>

          <h1>Customers</h1>

          <p>
            Manage and monitor all registered customers.
          </p>
        </div>

      </div>

      {/* =====================================
          SUMMARY CARDS
      ===================================== */}

      <div className="customer-stat-grid">

        <div className="customer-stat-card">

          <div className="customer-stat-icon blue">
            👥
          </div>

          <div>
            <span>Total Customers</span>
            <strong>{totalCustomers}</strong>
          </div>

        </div>

        <div className="customer-stat-card">

          <div className="customer-stat-icon green">
            ✓
          </div>

          <div>
            <span>Active Customers</span>
            <strong>{activeCustomers}</strong>
          </div>

        </div>

        <div className="customer-stat-card">

          <div className="customer-stat-icon gray">
            ○
          </div>

          <div>
            <span>Inactive Customers</span>
            <strong>{inactiveCustomers}</strong>
          </div>

        </div>

      </div>

      {/* =====================================
          CUSTOMER LIST
      ===================================== */}

      <div className="customer-list-container">

        {/* LIST HEADER */}

        <div className="customer-list-header">

          <div>
            <h2>Customer List</h2>

            <p>
              View and manage registered customers.
            </p>
          </div>

          {/* SEARCH */}

          <div className="customer-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

        </div>

        {/* =====================================
            TABLE
        ===================================== */}

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

              {filteredCustomers.length > 0 ? (

                filteredCustomers.map((customer) => (

                  <tr key={customer.id}>

                    {/* CUSTOMER */}

                    <td>

                      <div className="customer-profile">

                        <div className="customer-avatar">
                          {getInitials(customer)}
                        </div>

                        <div className="customer-name">

                          <strong>
                            {customer.firstName}{" "}
                            {customer.lastName}
                          </strong>

                          <span>
                            {customer.id}
                          </span>

                        </div>

                      </div>

                    </td>

                    {/* CONTACT */}

                    <td>

                      <div className="customer-contact">

                        <span>
                          {customer.email}
                        </span>

                        <small>
                          {customer.phone}
                        </small>

                      </div>

                    </td>

                    {/* ORDERS */}

                    <td>

                      <span className="order-count">
                        {customer.totalOrders}
                      </span>

                    </td>

                    {/* JOINED */}

                    <td>

                      <span className="joined-date">
                        {customer.joined}
                      </span>

                    </td>

                    {/* STATUS */}

                    <td>

                      <button
                        className={`customer-status ${
                          customer.status.toLowerCase()
                        }`}
                        onClick={() =>
                          toggleStatus(customer.id)
                        }
                      >

                        <span></span>

                        {customer.status}

                      </button>

                    </td>

                    {/* ACTIONS */}

                    <td>

                      <div className="customer-actions">

                        <button
                          className="customer-view-btn"
                          title="View customer"
                          onClick={() =>
                            handleView(customer)
                          }
                        >
                          👁
                        </button>

                        <button
                          className="customer-edit-btn"
                          title="Edit customer"
                          onClick={() =>
                            alert(
                              `Edit ${customer.firstName} ${customer.lastName}`
                            )
                          }
                        >
                          ✎
                        </button>

                        <button
                          className="customer-delete-btn"
                          title="Delete customer"
                          onClick={() =>
                            handleDelete(customer.id)
                          }
                        >
                          🗑
                        </button>

                      </div>

                    </td>

                  </tr>

                ))

              ) : (

                <tr>

                  <td
                    colSpan="6"
                    className="customer-empty"
                  >

                    <div className="empty-customer-icon">
                      🔍
                    </div>

                    <h3>
                      No customers found
                    </h3>

                    <p>
                      Try searching for another customer.
                    </p>

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================
          CUSTOMER DETAILS MODAL
      ===================================== */}

      {showDetails && selectedCustomer && (

        <div
          className="customer-modal-overlay"
          onClick={() => setShowDetails(false)}
        >

          <div
            className="customer-details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="customer-modal-header">

              <div>

                <span>
                  CUSTOMER DETAILS
                </span>

                <h2>
                  Customer Information
                </h2>

              </div>

              <button
                className="customer-close-btn"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                ×
              </button>

            </div>

            {/* CUSTOMER PROFILE */}

            <div className="customer-modal-profile">

              <div className="customer-modal-avatar">
                {getInitials(selectedCustomer)}
              </div>

              <div>

                <h3>
                  {selectedCustomer.firstName}{" "}
                  {selectedCustomer.lastName}
                </h3>

                <p>
                  {selectedCustomer.id}
                </p>

                <span
                  className={`customer-status ${
                    selectedCustomer.status.toLowerCase()
                  }`}
                >
                  <span></span>
                  {selectedCustomer.status}
                </span>

              </div>

            </div>

            {/* DETAILS */}

            <div className="customer-detail-grid">

              <div className="customer-detail-item">

                <span>Email Address</span>

                <strong>
                  {selectedCustomer.email}
                </strong>

              </div>

              <div className="customer-detail-item">

                <span>Phone Number</span>

                <strong>
                  {selectedCustomer.phone}
                </strong>

              </div>

              <div className="customer-detail-item">

                <span>Total Orders</span>

                <strong>
                  {selectedCustomer.totalOrders}
                </strong>

              </div>

              <div className="customer-detail-item">

                <span>Date Joined</span>

                <strong>
                  {selectedCustomer.joined}
                </strong>

              </div>

              <div className="customer-detail-item full">

                <span>Address</span>

                <strong>
                  {selectedCustomer.address}
                </strong>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="customer-modal-footer">

              <button
                className="customer-modal-close"
                onClick={() =>
                  setShowDetails(false)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default AdminCustomer;