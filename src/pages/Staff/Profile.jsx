import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Edit3,
  Save,
  X,
} from "lucide-react";

import "../../styles/Profile.css";

function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [profile, setProfile] = useState({
    firstName: "John Mark",
    lastName: "Timtim",
    email: "johnmark@email.com",
    phone: "0912 345 6789",
    address: "San Antonio",
    barangay: "San Antonio",
    city: "Santa Rosa",
    province: "Laguna",
  });

  const [formData, setFormData] = useState(profile);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEdit = () => {
    setFormData(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(profile);
    setIsEditing(false);
  };

  const handleSave = (e) => {
    e.preventDefault();

    setProfile(formData);
    setIsEditing(false);

    alert("Profile updated successfully!");
  };

  const handleChangePassword = (e) => {
    e.preventDefault();

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      alert("Please complete all password fields.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    alert("Password changed successfully!");

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const getInitials = () => {
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;
  };

  return (
    <main className="profile-page">

     

      {/* PROFILE CARD */}
      <section className="profile-card">

        {/* PROFILE TOP */}
        <div className="profile-top">

          <div className="profile-avatar">
            {getInitials()}
          </div>

          <div className="profile-user">
            <h2>
              {profile.firstName} {profile.lastName}
            </h2>

            <p>
              <Mail size={15} />
              {profile.email}
            </p>

            <span className="customer-badge">
              Staff
            </span>
          </div>

          {!isEditing && (
            <button
              className="edit-profile-btn"
              onClick={handleEdit}
            >
              <Edit3 size={17} />
              Edit Profile
            </button>
          )}
        </div>

        {/* PROFILE FORM */}
        <form
          className="profile-form"
          onSubmit={handleSave}
        >

          <div className="section-title">
            <div className="section-icon">
              <User size={18} />
            </div>

            <div>
              <h3>Personal Information</h3>
              <p>Your basic account information</p>
            </div>
          </div>

          <div className="form-grid">

            {/* FIRST NAME */}
            <div className="form-group">
              <label>First Name</label>

              <div className="input-wrapper">
                <User size={17} />

                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* LAST NAME */}
            <div className="form-group">
              <label>Last Name</label>

              <div className="input-wrapper">
                <User size={17} />

                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* EMAIL */}
            <div className="form-group">
              <label>Email Address</label>

              <div className="input-wrapper">
                <Mail size={17} />

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {/* PHONE */}
            <div className="form-group">
              <label>Phone Number</label>

              <div className="input-wrapper">
                <Phone size={17} />

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

          </div>

          {/* ADDRESS */}
          <div className="section-title address-title">
            <div className="section-icon">
              <MapPin size={18} />
            </div>

            <div>
              <h3>Address Information</h3>
              <p>Your pickup and delivery address</p>
            </div>
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>Address</label>

              <div className="input-wrapper">
                <MapPin size={17} />

                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Barangay</label>

              <div className="input-wrapper">
                <MapPin size={17} />

                <input
                  type="text"
                  name="barangay"
                  value={formData.barangay}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="form-group">
              <label>City / Municipality</label>

              <div className="input-wrapper">
                <MapPin size={17} />

                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Province</label>

              <div className="input-wrapper">
                <MapPin size={17} />

                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </div>
            </div>

          </div>

          {/* SAVE BUTTONS */}
          {isEditing && (
            <div className="profile-actions">

              <button
                type="button"
                className="cancel-btn"
                onClick={handleCancel}
              >
                <X size={17} />
                Cancel
              </button>

              <button
                type="submit"
                className="save-btn"
              >
                <Save size={17} />
                Save Changes
              </button>

            </div>
          )}

        </form>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="password-card">

        <div className="section-title">
          <div className="section-icon password-icon">
            <Lock size={18} />
          </div>

          <div>
            <h3>Change Password</h3>
            <p>Keep your account secure with a strong password.</p>
          </div>
        </div>

        <form
          className="password-form"
          onSubmit={handleChangePassword}
        >

          {/* CURRENT PASSWORD */}
          <div className="form-group">
            <label>Current Password</label>

            <div className="input-wrapper password-wrapper">

              <Lock size={17} />

              <input
                type={showPassword ? "text" : "password"}
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>

            </div>
          </div>

          {/* NEW PASSWORD */}
          <div className="form-group">
            <label>New Password</label>

            <div className="input-wrapper">
              <Lock size={17} />

              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
              />
            </div>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="form-group">
            <label>Confirm New Password</label>

            <div className="input-wrapper">
              <Lock size={17} />

              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="change-password-btn"
          >
            <Lock size={17} />
            Update Password
          </button>

        </form>
      </section>

    </main>
  );
}

export default Profile;