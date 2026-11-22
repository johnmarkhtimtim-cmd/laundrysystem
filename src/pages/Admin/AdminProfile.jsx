import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../context/AuthContext";
import { changePassword } from "../../services/authService";
import { updateUserProfile } from "../../services/userService";
import {
  isValidPhMobile,
  normalizePhMobile,
  sanitizePhMobileInput,
} from "../../utils/phPhone";

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const email = user?.email || "";
  const displayName =
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Administrator";
  const savedPhone = user?.phone || "";
  const [fullName, setFullName] = useState(displayName);
  const [phone, setPhone] = useState(savedPhone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSave = async () => {
    if (!user?.uid) return;
    if (phone.trim() && !isValidPhMobile(phone)) {
      setError(
        "Please enter a valid PH mobile number (11 digits starting with 09, e.g., 09171234567)."
      );
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || "Administrator";
      const lastName = parts.slice(1).join(" ");

      await updateUserProfile(user.uid, {
        firstName,
        lastName,
        name: fullName.trim() || "Administrator",
        phone: phone.trim() ? normalizePhMobile(phone) : "",
      });

      updateUser?.({
        firstName,
        lastName,
        name: fullName.trim() || "Administrator",
        phone: phone.trim() ? normalizePhMobile(phone) : "",
        displayName: fullName.trim() || "Administrator",
      });

      if (currentPassword && newPassword) {
        await changePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
      }

      setMessage("Profile saved.");
      setEditing(false);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin Profile"
        description="Manage your personal details and account security."
      />
      <section className="portal-card profile-card">
        <div className="profile-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2>{displayName}</h2>
          <p>{email}</p>
          {(editing ? phone : savedPhone) && <p>{editing ? phone : savedPhone}</p>}
          <span className="status-badge active">Active</span>
        </div>
        <button
          className="light-action"
          type="button"
          onClick={() => {
            if (!editing) {
              setFullName(displayName);
              setPhone(savedPhone);
            }
            setEditing(!editing);
            setMessage("");
            setError("");
          }}
        >
          {editing ? "Cancel" : "Edit profile"}
        </button>
        {editing && (
          <div className="profile-form">
            <label>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input value={email} type="email" readOnly />
            </label>
            <label>
              Phone
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="09XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(sanitizePhMobileInput(e.target.value))}
              />
            </label>
            <label>
              Role
              <input defaultValue="Administrator" readOnly />
            </label>
            <label>
              Current password
              <div className="admin-password-wrap">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Only if changing password"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={
                    showCurrentPassword
                      ? "Hide current password"
                      : "Show current password"
                  }
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label>
              New password
              <div className="admin-password-wrap">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={
                    showNewPassword ? "Hide new password" : "Show new password"
                  }
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button
              className="primary-action"
              type="button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
            {message && <small>{message}</small>}
            {error && (
              <small style={{ color: "#b91c1c", display: "block" }}>
                {error}
              </small>
            )}
          </div>
        )}
      </section>
    </>
  );
}
