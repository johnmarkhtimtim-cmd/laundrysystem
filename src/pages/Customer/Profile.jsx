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

import { useAuth } from "../../context/AuthContext";
import { updateUserProfile } from "../../services/userService";
import { changePassword } from "../../services/authService";
import "../../styles/Profile.css";

const buildProfile = (user) => {
  const [first = "", ...rest] = (user?.name || "").trim().split(/\s+/);

  return {
    firstName: user?.firstName ?? first,
    lastName: user?.lastName ?? rest.join(" "),
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    barangay: user?.barangay ?? "",
    city: user?.city ?? "",
    province: user?.province ?? "",
  };
};

function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(() => buildProfile(user));
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

  const handleSave = async (e) => {
    e.preventDefault();

    try {
      const changes = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        barangay: formData.barangay.trim(),
        city: formData.city.trim(),
        province: formData.province.trim(),
      };

      await updateUserProfile(user.uid, changes);
      updateUser(changes);

      setProfile(formData);
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update error:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      alert(
        "New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
      );
      return;
    }

    if (newPassword === currentPassword) {
      alert("New password must be different from the current password.");
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      alert("Password changed successfully!");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Change password error:", error);

      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-login-credentials"
      ) {
        alert("Current password is incorrect.");
      } else if (error.code === "auth/too-many-requests") {
        alert("Too many attempts. Please try again later.");
      } else if (error.code === "auth/weak-password") {
        alert("New password is too weak.");
      } else {
        alert("Failed to change password. Please try again.");
      }
    }
  };

  const getInitials = () => {
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || profile.email.charAt(0).toUpperCase() || "?";
  };

  return (
    <main className="profile-page">

     

      <header className="profile-header">
        <h1>My Profile</h1>
        <p>Manage your personal information and account security.</p>
      </header>
      <section className="acct-card">
        <div className="profile-cover" aria-hidden="true" />

        {/* PROFILE TOP */}
        <div className="profile-top">

          <div className="acct-avatar">
            {getInitials()}
          </div>

          <div className="profile-user">
            <h2>
              {`${profile.firstName} ${profile.lastName}`.trim() || profile.email.split("@")[0]}
            </h2>

            <p>
              <Mail size={15} />
              {profile.email}
            </p>

            <span className="customer-badge">
              Customer
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
          className="acct-form"
          onSubmit={handleSave}
        >

          <div className="acct-section-title">
            <div className="acct-section-icon">
              <User size={18} />
            </div>

            <div>
              <h3>Personal Information</h3>
              <p>Your basic account information</p>
            </div>
          </div>

          <div className="acct-grid">

            {/* FIRST NAME */}
            <div className="acct-field">
              <label>First Name</label>

              <div className="acct-input">
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
            <div className="acct-field">
              <label>Last Name</label>

              <div className="acct-input">
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
            <div className="acct-field">
              <label>Email Address</label>

              <div className="acct-input">
                <Mail size={17} />

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled
                />
              </div>
            </div>

            {/* PHONE */}
            <div className="acct-field">
              <label>Phone Number</label>

              <div className="acct-input">
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
          <div className="acct-section-title address-title">
            <div className="acct-section-icon">
              <MapPin size={18} />
            </div>

            <div>
              <h3>Address Information</h3>
              <p>Your pickup and delivery address</p>
            </div>
          </div>

          <div className="acct-grid">

            <div className="acct-field">
              <label>Address</label>

              <div className="acct-input">
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

            <div className="acct-field">
              <label>Barangay</label>

              <div className="acct-input">
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

            <div className="acct-field">
              <label>City / Municipality</label>

              <div className="acct-input">
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

            <div className="acct-field">
              <label>Province</label>

              <div className="acct-input">
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
                className="acct-cancel-btn"
                onClick={handleCancel}
              >
                <X size={17} />
                Cancel
              </button>

              <button
                type="submit"
                className="acct-save-btn"
              >
                <Save size={17} />
                Save Changes
              </button>

            </div>
          )}

        </form>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="acct-password-card">

        <div className="acct-section-title">
          <div className="acct-section-icon password-icon">
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
          <div className="acct-field">
            <label>Current Password</label>

            <div className="acct-input password-wrapper">

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
          <div className="acct-field">
            <label>New Password</label>

            <div className="acct-input">
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
          <div className="acct-field">
            <label>Confirm New Password</label>

            <div className="acct-input">
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