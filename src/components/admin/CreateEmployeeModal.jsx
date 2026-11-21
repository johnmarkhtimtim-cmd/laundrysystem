import { useState } from "react";
import { createEmployeeAccount } from "../../services/userService";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

/** Normalize PH mobile to 09XXXXXXXXX when possible. */
const normalizePhMobile = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
};

const isValidPhMobile = (value) => /^09\d{9}$/.test(normalizePhMobile(value));

const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
    error: "Password must be at least 8 characters.",
  },
  {
    id: "upper",
    label: "At least 1 uppercase letter",
    test: (password) => /[A-Z]/.test(password),
    error: "Password must contain at least 1 uppercase letter.",
  },
  {
    id: "lower",
    label: "At least 1 lowercase letter",
    test: (password) => /[a-z]/.test(password),
    error: "Password must contain at least 1 lowercase letter.",
  },
  {
    id: "number",
    label: "At least 1 number",
    test: (password) => /\d/.test(password),
    error: "Password must contain at least 1 number.",
  },
  {
    id: "special",
    label: "At least 1 special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
    error: "Password must contain at least 1 special character.",
  },
];

const getPasswordError = (password) => {
  if (!password) return "Password cannot be blank.";
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed?.error || "";
};

export default function CreateEmployeeModal({
  role = "staff",
  open,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const isRider = role === "rider";
  const label = isRider ? "Rider" : "Staff";
  const passwordsMatch =
    form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "phone") {
      // Digits only; keep enough room for 09… or 63…
      const digits = value.replace(/\D/g, "").slice(0, 12);
      setForm((prev) => ({ ...prev, phone: digits }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    if (error) setError("");
  };

  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setError("");
    setSubmitting(false);
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!isValidPhMobile(form.phone)) {
      setError("Enter a valid PH mobile number (09XXXXXXXXX).");
      return;
    }

    const passwordError = getPasswordError(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!form.confirmPassword) {
      setError("Confirm password cannot be blank.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const normalizedPhone = normalizePhMobile(form.phone);

    setSubmitting(true);
    try {
      const created = await createEmployeeAccount({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: normalizedPhone,
        password: form.password,
        role: isRider ? "rider" : "staff",
      });
      setForm(EMPTY_FORM);
      onCreated?.(created);
      onClose?.();
    } catch (createError) {
      console.error(createError);
      if (createError?.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (createError?.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (createError?.code === "auth/weak-password") {
        setError("Password must meet all password requirements.");
      } else {
        setError(
          createError?.message || `Could not create ${label.toLowerCase()} account.`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="customer-modal-overlay" onClick={resetAndClose}>
      <div
        className="customer-details-modal employee-create-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="customer-modal-header">
          <div>
            <span>ACCOUNT</span>
            <h2>Create {label} Account</h2>
          </div>
          <button
            type="button"
            className="customer-close-btn"
            onClick={resetAndClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="employee-create-form" onSubmit={handleSubmit}>
          {error && <div className="employee-create-error">{error}</div>}

          <div className="employee-create-grid">
            <label>
              First name <span>*</span>
              <input
                name="firstName"
                type="text"
                value={form.firstName}
                onChange={handleChange}
                placeholder="Juan"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Last name <span>*</span>
              <input
                name="lastName"
                type="text"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Dela Cruz"
                autoComplete="off"
                required
              />
            </label>
          </div>

          <label>
            Email <span>*</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder={`${isRider ? "rider" : "staff"}@example.com`}
              autoComplete="off"
              required
            />
          </label>

          <label>
            Phone <span>*</span>
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={handleChange}
              placeholder="09XXXXXXXXX"
              maxLength={12}
              autoComplete="off"
              required
            />
            <small className="employee-field-hint">
              PH mobile only — 11 digits starting with 09
            </small>
          </label>

          <div className="employee-create-grid">
            <div className="employee-password-field">
              <label htmlFor="employee-password">
                Password <span>*</span>
              </label>
              <input
                id="employee-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
              {form.password && (
                <div className="password-requirements password-requirements-visible">
                  <p className="password-requirements-title">
                    Password must contain:
                  </p>
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(form.password);
                    return (
                      <div
                        key={rule.id}
                        className={
                          met ? "password-requirement met" : "password-requirement"
                        }
                      >
                        <span>{met ? "✓" : "✕"}</span>
                        <span>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="employee-password-field">
              <label htmlFor="employee-confirm-password">
                Confirm password <span>*</span>
              </label>
              <input
                id="employee-confirm-password"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
              {form.confirmPassword && (
                <div
                  className={
                    passwordsMatch
                      ? "password-match-message matched"
                      : "password-match-message not-matched"
                  }
                >
                  <span>{passwordsMatch ? "✓" : "✕"}</span>
                  <span>
                    {passwordsMatch
                      ? "Passwords match"
                      : "Password does not match"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="customer-modal-footer employee-create-actions">
            <button
              type="button"
              className="customer-modal-close"
              onClick={resetAndClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="employee-create-submit"
              disabled={submitting}
            >
              {submitting ? "Creating..." : `Create ${label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
