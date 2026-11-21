import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import CreateEmployeeModal from "../../components/admin/CreateEmployeeModal";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import { subscribeToAllBookings } from "../../services/bookingService";
import {
  archiveUserAccount,
  countActiveJobsByUser,
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

export default function Staff() {
  const [staffMembers, setStaffMembers] = useState([]);
  const [jobCounts, setJobCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [listFilter, setListFilter] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const unsubscribeUsers = subscribeToUsersByRoles(
      ["staff"],
      (users) => {
        setStaffMembers(users);
        setLoading(false);
        setError("");
      },
      (loadError) => {
        console.error(loadError);
        setError("Unable to load staff accounts.");
        setLoading(false);
      }
    );

    const unsubscribeBookings = subscribeToAllBookings(
      (bookings) => setJobCounts(countActiveJobsByUser(bookings)),
      (bookingError) => console.error(bookingError)
    );

    return () => {
      unsubscribeUsers?.();
      unsubscribeBookings?.();
    };
  }, []);

  const rows = useMemo(
    () =>
      staffMembers.map((member) => ({
        ...member,
        tasks: jobCounts[member.id] || 0,
        joined: formatJoined(member.createdAt),
        roleLabel: "Laundry Staff",
      })),
    [staffMembers, jobCounts]
  );

  const activeRows = rows.filter((member) => member.status !== "Archived");
  const archivedRows = rows.filter((member) => member.status === "Archived");

  const filtered = (listFilter === "archived" ? archivedRows : activeRows).filter(
    (member) => {
      const haystack = [
        member.name,
        member.email,
        member.phone,
        member.roleLabel,
        member.id,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    }
  );

  const toggleStatus = async (id, currentStatus) => {
    if (currentStatus === "Archived") return;
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    setActionLoading(id);
    try {
      await updateUserStatus(id, nextStatus);
    } catch (statusError) {
      console.error(statusError);
      alert("Could not update staff status.");
    } finally {
      setActionLoading(null);
    }
  };

  const closeConfirmAction = () => {
    if (actionLoading) return;
    setConfirmAction(null);
  };

  const requestArchive = (member) => {
    const isArchived = member.status === "Archived";
    setConfirmAction({
      type: isArchived ? "restore" : "archive",
      member,
      variant: isArchived ? "success" : "danger",
      title: isArchived
        ? `Restore ${member.name}?`
        : `Archive ${member.name}?`,
      message: isArchived
        ? "This staff account will return to the active list."
        : "They will be hidden from the active list.",
      confirmLabel: isArchived ? "Restore" : "Archive",
      loadingLabel: isArchived ? "Restoring..." : "Archiving...",
      meta: [
        { label: "Name", value: member.name || "—" },
        { label: "Email", value: member.email || "—" },
      ],
    });
  };

  const requestDelete = (member) => {
    setConfirmAction({
      type: "delete",
      member,
      variant: "danger",
      title: `Permanently delete ${member.name}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      loadingLabel: "Deleting...",
      meta: [
        { label: "Name", value: member.name || "—" },
        { label: "Email", value: member.email || "—" },
      ],
    });
  };

  const confirmPendingAction = async () => {
    if (!confirmAction?.member) return;

    const { type, member } = confirmAction;
    setActionLoading(member.id);
    try {
      if (type === "delete") {
        await deleteUserAccount(member.id);
      } else if (type === "restore") {
        await unarchiveUserAccount(member.id);
      } else if (type === "archive") {
        await archiveUserAccount(member.id);
      }
      setConfirmAction(null);
    } catch (actionError) {
      console.error(actionError);
      alert(
        type === "delete"
          ? "Could not delete staff account."
          : type === "restore"
            ? "Could not restore staff account."
            : "Could not archive staff account."
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="admin-customer">
      <AdminPageHeader
        title="Staff"
        description="Live laundry staff accounts from Firestore."
      />

      {error && (
        <div className="customer-stat-card" style={{ marginBottom: 16, color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div
          className="customer-stat-card"
          style={{ marginBottom: 16, color: "#15803d" }}
        >
          {successMessage}
        </div>
      )}

      <div className="customer-stat-grid customer-stat-grid-4">
        <div className="customer-stat-card">
          <div className="customer-stat-icon blue">👤</div>
          <div>
            <span>Total Staff</span>
            <strong>{loading ? "…" : activeRows.length}</strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon green">✓</div>
          <div>
            <span>Active</span>
            <strong>
              {loading
                ? "…"
                : activeRows.filter((member) => member.status === "Active")
                    .length}
            </strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon gray">⏸</div>
          <div>
            <span>Inactive</span>
            <strong>
              {loading
                ? "…"
                : activeRows.filter((member) => member.status === "Inactive")
                    .length}
            </strong>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="customer-stat-icon amber">📦</div>
          <div>
            <span>Archived</span>
            <strong>{loading ? "…" : archivedRows.length}</strong>
          </div>
        </div>
      </div>

      <div className="customer-list-container">
        <div className="customer-list-header">
          <div>
            <h2>
              {listFilter === "archived" ? "Archived Staff" : "Staff Directory"}
            </h2>
            <p>
              {listFilter === "archived"
                ? "Restore or permanently delete archived accounts."
                : "Auto-updates with active job counts from bookings."}
            </p>
          </div>
          <div className="customer-list-tools">
            <button
              type="button"
              className="employee-create-btn"
              onClick={() => {
                setSuccessMessage("");
                setShowCreateModal(true);
              }}
            >
              + Create Staff
            </button>
            <div className="customer-filter-tabs">
              <button
                type="button"
                className={listFilter === "active" ? "active" : ""}
                onClick={() => setListFilter("active")}
              >
                Active ({activeRows.length})
              </button>
              <button
                type="button"
                className={listFilter === "archived" ? "active" : ""}
                onClick={() => setListFilter("archived")}
              >
                Archived ({archivedRows.length})
              </button>
            </div>
            <div className="customer-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search staff..."
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
                <th>Staff member</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Active jobs</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="customer-empty">
                    Loading staff...
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="customer-profile">
                        <div className="customer-avatar">
                          {(member.name || "S").charAt(0).toUpperCase()}
                        </div>
                        <div className="customer-name">
                          <strong>{member.name}</strong>
                          <span>#{member.id.slice(-6)}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="customer-contact">
                        <span>{member.email || "—"}</span>
                        <small>{member.phone || "—"}</small>
                      </div>
                    </td>
                    <td>{member.roleLabel}</td>
                    <td>
                      <span className="order-count">{member.tasks}</span>
                    </td>
                    <td>
                      <span className="joined-date">{member.joined}</span>
                    </td>
                    <td>
                      <button
                        className={`customer-status ${member.status.toLowerCase()}`}
                        onClick={() => toggleStatus(member.id, member.status)}
                        disabled={
                          actionLoading === member.id ||
                          member.status === "Archived"
                        }
                        title={
                          member.status === "Archived"
                            ? "Restore to change status"
                            : "Toggle active/inactive"
                        }
                      >
                        <span></span>
                        {member.status}
                      </button>
                    </td>
                    <td>
                      <div className="customer-actions">
                        <button
                          className="customer-archive-btn"
                          title={
                            member.status === "Archived"
                              ? "Restore staff"
                              : "Archive staff"
                          }
                          onClick={() => requestArchive(member)}
                          disabled={actionLoading === member.id}
                        >
                          {member.status === "Archived" ? "↺" : "📦"}
                        </button>
                        <button
                          className="customer-delete-btn"
                          title="Delete staff"
                          onClick={() => requestDelete(member)}
                          disabled={actionLoading === member.id}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="customer-empty">
                    <h3>No staff found</h3>
                    <p>Use Create Staff to add a laundry staff account.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateEmployeeModal
        role="staff"
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(created) => {
          setSuccessMessage(
            `Staff account created for ${created.name || created.email}.`
          );
        }}
      />

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        loading={Boolean(actionLoading)}
        variant={confirmAction?.variant || "danger"}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        loadingLabel={confirmAction?.loadingLabel}
        meta={confirmAction?.meta}
        onCancel={closeConfirmAction}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
