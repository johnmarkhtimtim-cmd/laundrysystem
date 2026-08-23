import { useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";

export default function AdminProfile() {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <AdminPageHeader
        title="Admin Profile"
        description="Manage your personal details and account security."
      />
      <section className="portal-card profile-card">
        <div className="profile-avatar">A</div>
        <div>
          <h2>Administrator</h2>
          <p>admin@laundrymate.com</p>
          <span className="status-badge active">Active</span>
        </div>
        <button
          className="light-action"
          type="button"
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Cancel" : "Edit profile"}
        </button>
        {editing && (
          <div className="profile-form">
            <label>
              Full name
              <input defaultValue="Administrator" />
            </label>
            <label>
              Email
              <input defaultValue="admin@laundrymate.com" type="email" />
            </label>
            <label>
              Phone
              <input defaultValue="0917 000 0000" />
            </label>
            <label>
              Role
              <input defaultValue="Administrator" readOnly />
            </label>
            <button className="primary-action" type="button">
              Save profile
            </button>
          </div>
        )}
      </section>
    </>
  );
}
