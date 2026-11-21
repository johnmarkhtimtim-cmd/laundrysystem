import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../context/AuthContext";
import { changePassword } from "../../services/authService";
import { updateUserProfile } from "../../services/userService";

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const name =
      user?.name ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      "Administrator";
    setFullName(name);
    setPhone(user?.phone || "");
  }, [user]);

  const email = user?.email || "";
  const displayName =
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Administrator";

  const handleSave = async () => {
    if (!user?.uid) return;
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
        phone: phone.trim(),
      });

      updateUser?.({
        firstName,
        lastName,
        name: fullName.trim() || "Administrator",
        phone: phone.trim(),
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
          {phone && <p>{phone}</p>}
          <span className="status-badge active">Active</span>
        </div>
        <button
          className="light-action"
          type="button"
          onClick={() => {
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label>
              Role
              <input defaultValue="Administrator" readOnly />
            </label>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Only if changing password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
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
