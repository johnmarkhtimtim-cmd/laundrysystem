import { useAuth } from "../../context/AuthContext";
import "../../styles/StaffProfile.css";

function StaffProfile() {
  const { user } = useAuth();

  return (
    <div className="staff-profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>View and manage your staff account information</p>
      </div>

      <div className="profile-container">
        {/* PROFILE HEADER */}
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-circle">
              {user?.email?.charAt(0)?.toUpperCase() || "S"}
            </div>
          </div>

          <div className="profile-info">
            <h2>{user?.name || user?.email || "Staff Member"}</h2>
            <p className="profile-role">Staff Member</p>
            <p className="profile-status">
              <span className="status-badge active">● Active</span>
            </p>
          </div>
        </div>

        {/* PROFILE DETAILS */}
        <div className="profile-sections">
          {/* CONTACT INFORMATION */}
          <section className="profile-section">
            <h3>Contact Information</h3>
            <div className="profile-grid">
              <div className="profile-field">
                <label>Email Address</label>
                <p>{user?.email || "N/A"}</p>
              </div>

              <div className="profile-field">
                <label>Full Name</label>
                <p>{user?.name || "Not provided"}</p>
              </div>

              <div className="profile-field">
                <label>Phone Number</label>
                <p>{user?.phone || "Not provided"}</p>
              </div>

              <div className="profile-field">
                <label>Address</label>
                <p>{user?.address || "Not provided"}</p>
              </div>
            </div>
          </section>

          {/* ACCOUNT INFORMATION */}
          <section className="profile-section">
            <h3>Account Information</h3>
            <div className="profile-grid">
              <div className="profile-field">
                <label>Role</label>
                <p>Staff Member</p>
              </div>

              <div className="profile-field">
                <label>Status</label>
                <p>
                  <span className="badge-active">Active</span>
                </p>
              </div>

              <div className="profile-field">
                <label>Account Type</label>
                <p>Professional</p>
              </div>

              <div className="profile-field">
                <label>Joined Date</label>
                <p>{user?.created_at?.toDate?.() ? new Date(user.created_at.toDate()).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>
          </section>

          {/* PERMISSIONS */}
          <section className="profile-section">
            <h3>Permissions & Access</h3>
            <div className="permissions-list">
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>View Bookings</label>
              </div>
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>Manage Pickups</label>
              </div>
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>Process Laundry</label>
              </div>
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>View Payments</label>
              </div>
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>View Reports</label>
              </div>
              <div className="permission-item">
                <input type="checkbox" checked disabled />
                <label>Send Notifications</label>
              </div>
            </div>
          </section>

          {/* STATISTICS */}
          <section className="profile-section">
            <h3>Performance Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-icon">📊</div>
                <div>
                  <p className="stat-label">Total Orders Processed</p>
                  <p className="stat-value">0</p>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">⭐</div>
                <div>
                  <p className="stat-label">Average Rating</p>
                  <p className="stat-value">--</p>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">✓</div>
                <div>
                  <p className="stat-label">Completion Rate</p>
                  <p className="stat-value">--%</p>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">⏱️</div>
                <div>
                  <p className="stat-label">Avg. Processing Time</p>
                  <p className="stat-value">-- hrs</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECURITY */}
          <section className="profile-section">
            <h3>Security</h3>
            <div className="security-options">
              <button className="btn btn-secondary">Change Password</button>
              <button className="btn btn-secondary">Enable Two-Factor Authentication</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default StaffProfile;
