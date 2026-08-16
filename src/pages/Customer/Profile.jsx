import { useState } from "react";
import "../../styles/Profile.css";

function MyProfile() {
  const [profile, setProfile] = useState({
    firstName: "John Mark",
    lastName: "Timtim",
    email: "johnmark@email.com",
    phone: "0912 345 6789",
    address: "Laguna, Philippines",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirm: "",
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile({
      ...profile,
      [name]: value,
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswords({
      ...passwords,
      [name]: value,
    });
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();

    alert("Profile information updated successfully!");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();

    if (passwords.newPassword !== passwords.confirm) {
      alert("New passwords do not match.");
      return;
    }

    if (!passwords.newPassword) {
      alert("Please enter a new password.");
      return;
    }

    alert("Password updated successfully!");

    setPasswords({
      current: "",
      newPassword: "",
      confirm: "",
    });
  };

  return (
    <div className="profile-page">

      {/* =========================================
          PAGE HEADER
      ========================================= */}

      <div className="profile-page-header">

        <div>
          <p className="profile-eyebrow">
            LAUNDRYMATE
          </p>

          <h1>
            My Profile
          </h1>

          <p>
            Manage your account details and preferences.
          </p>
        </div>

        <div className="profile-header-icon">
          👤
        </div>

      </div>


      {/* =========================================
          PROFILE OVERVIEW
      ========================================= */}

      <section className="profile-overview">

        <div className="profile-avatar">
          {profile.firstName.charAt(0)}
          {profile.lastName.charAt(0)}
        </div>

        <div className="profile-overview-info">

          <h2>
            {profile.firstName} {profile.lastName}
          </h2>

          <p>
            {profile.email}
          </p>

          <span className="member-badge">
            ⭐ Gold Member
          </span>

        </div>

        <div className="account-status">

          <span className="status-dot"></span>

          <div>
            <strong>
              Account Active
            </strong>

            <p>
              Member since 2026
            </p>
          </div>

        </div>

      </section>


      {/* =========================================
          MAIN PROFILE GRID
      ========================================= */}

      <div className="profile-grid">

        {/* =====================================
            PERSONAL INFORMATION
        ===================================== */}

        <section className="profile-card">

          <div className="profile-card-header">

            <div>
              <h2>
                Personal Information
              </h2>

              <p>
                Update your basic account information.
              </p>
            </div>

            <span className="card-icon">
              👤
            </span>

          </div>


          <form onSubmit={handleProfileSubmit}>

            <div className="form-row">

              <div className="form-group">

                <label>
                  First Name
                </label>

                <input
                  type="text"
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleProfileChange}
                  placeholder="Enter first name"
                />

              </div>


              <div className="form-group">

                <label>
                  Last Name
                </label>

                <input
                  type="text"
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleProfileChange}
                  placeholder="Enter last name"
                />

              </div>

            </div>


            <div className="form-group">

              <label>
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
                placeholder="Enter email address"
              />

            </div>


            <div className="form-group">

              <label>
                Phone Number
              </label>

              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleProfileChange}
                placeholder="Enter phone number"
              />

            </div>


            <div className="form-group">

              <label>
                Address
              </label>

              <textarea
                name="address"
                value={profile.address}
                onChange={handleProfileChange}
                placeholder="Enter your address"
                rows="3"
              />

            </div>


            <div className="form-actions">

              <button
                type="button"
                className="cancel-btn"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-btn"
              >
                Save Changes
              </button>

            </div>

          </form>

        </section>


        {/* =====================================
            ACCOUNT INFORMATION
        ===================================== */}

        <section className="profile-card account-card">

          <div className="profile-card-header">

            <div>
              <h2>
                Account Details
              </h2>

              <p>
                Your LaundryMate account information.
              </p>
            </div>

            <span className="card-icon">
              ⚙
            </span>

          </div>


          <div className="account-info-list">

            <div className="account-info-item">

              <div className="info-icon blue">
                ✉
              </div>

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {profile.email}
                </strong>
              </div>

            </div>


            <div className="account-info-item">

              <div className="info-icon green">
                ☎
              </div>

              <div>
                <span>
                  Phone
                </span>

                <strong>
                  {profile.phone}
                </strong>
              </div>

            </div>


            <div className="account-info-item">

              <div className="info-icon purple">
                ⭐
              </div>

              <div>
                <span>
                  Membership
                </span>

                <strong>
                  Gold Member
                </strong>
              </div>

            </div>


            <div className="account-info-item">

              <div className="info-icon orange">
                📅
              </div>

              <div>
                <span>
                  Member Since
                </span>

                <strong>
                  August 2026
                </strong>
              </div>

            </div>

          </div>


          {/* ACCOUNT STATS */}

          <div className="profile-mini-stats">

            <div>
              <strong>
                12
              </strong>

              <span>
                Completed
              </span>
            </div>

            <div>
              <strong>
                4
              </strong>

              <span>
                Active
              </span>
            </div>

            <div>
              <strong>
                ₱1,300
              </strong>

              <span>
                Total Spent
              </span>
            </div>

          </div>

        </section>


        {/* =====================================
            PASSWORD
        ===================================== */}

        <section className="profile-card password-card">

          <div className="profile-card-header">

            <div>
              <h2>
                Change Password
              </h2>

              <p>
                Keep your account secure.
              </p>
            </div>

            <span className="card-icon">
              🔒
            </span>

          </div>


          <form onSubmit={handlePasswordSubmit}>

            <div className="form-group">

              <label>
                Current Password
              </label>

              <input
                type="password"
                name="current"
                value={passwords.current}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
              />

            </div>


            <div className="form-group">

              <label>
                New Password
              </label>

              <input
                type="password"
                name="newPassword"
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
              />

            </div>


            <div className="form-group">

              <label>
                Confirm New Password
              </label>

              <input
                type="password"
                name="confirm"
                value={passwords.confirm}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
              />

            </div>


            <div className="password-tip">
              <span>
                💡
              </span>

              <p>
                Use at least 8 characters with a
                combination of letters and numbers.
              </p>
            </div>


            <button
              type="submit"
              className="password-btn"
            >
              Update Password
            </button>

          </form>

        </section>


        {/* =====================================
            ACCOUNT PREFERENCES
        ===================================== */}

        <section className="profile-card preferences-card">

          <div className="profile-card-header">

            <div>
              <h2>
                Account Preferences
              </h2>

              <p>
                Manage your LaundryMate notifications.
              </p>
            </div>

            <span className="card-icon">
              🔔
            </span>

          </div>


          <div className="preference-list">

            <div className="preference-item">

              <div>
                <strong>
                  Booking Updates
                </strong>

                <span>
                  Receive updates about your bookings.
                </span>
              </div>

              <label className="switch">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span className="slider"></span>

              </label>

            </div>


            <div className="preference-item">

              <div>
                <strong>
                  Payment Notifications
                </strong>

                <span>
                  Get notified about payment updates.
                </span>
              </div>

              <label className="switch">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span className="slider"></span>

              </label>

            </div>


            <div className="preference-item">

              <div>
                <strong>
                  Pickup Reminders
                </strong>

                <span>
                  Receive reminders before pickup.
                </span>
              </div>

              <label className="switch">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span className="slider"></span>

              </label>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}

export default MyProfile;