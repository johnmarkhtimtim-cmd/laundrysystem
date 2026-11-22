import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../services/firebase";
import {
  isRegistrationEmailVerified,
  sendRegistrationOtp,
  verifyRegistrationOtp,
} from "../services/otpService";

import "../styles/Registration.css";

/* REGISTRATION */
const Registration = () => {
  const navigate = useNavigate();

  /* STEP: 0 = Personal Info, 1 = Email OTP, 2 = Account Setup */
  const [step, setStep] = useState(0);

  /* FORM DATA */
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpInfo, setOtpInfo] = useState("");
  const otpInputRefs = useRef([]);

  const otpDigits = Array.from({ length: 6 }, (_, i) => otpCode[i] || "");

  const focusOtpBox = (index) => {
    const el = otpInputRefs.current[index];
    if (el) el.focus();
  };

  const handleOtpDigitChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const next = otpDigits.map((d, i) => (i === index ? digit : d));
    setOtpCode(next.join(""));
    setError("");
    if (digit && index < 5) focusOtpBox(index + 1);
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpCode(next.join(""));
      } else if (index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpCode(next.join(""));
        focusOtpBox(index - 1);
      }
      setError("");
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusOtpBox(index - 1);
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      focusOtpBox(index + 1);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    setOtpCode(pasted);
    setError("");
    focusOtpBox(Math.min(pasted.length, 5));
  };

  /* DATA PRIVACY */
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* STATUS */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (name) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    clearFieldError(name);
    setError("");

    if (name === "email") {
      setEmailVerified(false);
      setOtpCode("");
      setOtpInfo("");
    }
  };

  const validatePersonalInfo = () => {
    const { firstName, lastName, email, phone } = formData;
    const errors = {};

    if (!firstName.trim()) {
      errors.firstName = "First name cannot be blank.";
    }
    if (!lastName.trim()) {
      errors.lastName = "Last name cannot be blank.";
    }
    if (!email.trim()) {
      errors.email = "Email cannot be blank.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (!phone.trim()) {
      errors.phone = "Phone number cannot be blank.";
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError("Please fill in all required fields.");
      return false;
    }

    return true;
  };

  const validateAccountSetup = () => {
    const { password, confirmPassword } = formData;
    const errors = {};

    if (!password) {
      errors.password = "Password cannot be blank.";
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password cannot be blank.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      setError("Please fill in all required fields.");
      return false;
    }

    if (password.length < 8) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "Password must be at least 8 characters.",
      }));
      setError("Password must be at least 8 characters.");
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "Password must contain at least 1 uppercase letter.",
      }));
      setError("Password must contain at least 1 uppercase letter.");
      return false;
    }
    if (!/[a-z]/.test(password)) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "Password must contain at least 1 lowercase letter.",
      }));
      setError("Password must contain at least 1 lowercase letter.");
      return false;
    }
    if (!/\d/.test(password)) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "Password must contain at least 1 number.",
      }));
      setError("Password must contain at least 1 number.");
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setFieldErrors((prev) => ({
        ...prev,
        password: "Password must contain at least 1 special character.",
      }));
      setError("Password must contain at least 1 special character.");
      return false;
    }
    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match.",
      }));
      setError("Passwords do not match.");
      return false;
    }

    if (!privacyConsent) {
      setError("You must agree to the Data Privacy Notice before registering.");
      return false;
    }

    return true;
  };

  const requestOtp = async () => {
    setOtpSending(true);
    setError("");
    setOtpInfo("");

    try {
      const result = await sendRegistrationOtp({
        email: formData.email,
        firstName: formData.firstName,
      });
      setEmailVerified(false);
      setOtpCode("");

      if (result.needsActivation) {
        setOtpInfo(
          result.infoMessage ||
            "Check Gmail for a FormSubmit activation email, click Activate Form, then tap Resend OTP to receive your 6-digit code."
        );
      } else {
        setOtpInfo(
          result.infoMessage ||
            `A 6-digit OTP was sent to ${formData.email.trim()}. Check Inbox, Spam, and Promotions.`
        );
      }
    } catch (err) {
      console.error("OTP send error:", err);
      setError(err.message || "Unable to send OTP. Please try again.");
      throw err;
    } finally {
      setOtpSending(false);
    }
  };

  const goNextFromPersonalInfo = async () => {
    setError("");
    if (!validatePersonalInfo()) return;

    try {
      setLoading(true);
      setFieldErrors({});
      await requestOtp();
      setStep(1);
    } catch {
      // error already set
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("Enter the 6-digit OTP sent to your email.");
      return;
    }

    try {
      setLoading(true);
      await verifyRegistrationOtp({
        email: formData.email,
        otp: otpCode,
      });
      setEmailVerified(true);
      setSuccess("Email verified successfully.");
      setTimeout(() => {
        setSuccess("");
        setStep(2);
      }, 700);
    } catch (err) {
      console.error("OTP verify error:", err);
      setEmailVerified(false);
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      await requestOtp();
    } catch {
      // error already set
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError("");
    setSuccess("");
    setFieldErrors({});
    if (step === 0) {
      navigate("/");
      return;
    }
    setStep((prev) => prev - 1);
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const { firstName, lastName, email, phone, password } = formData;

    if (!validatePersonalInfo()) {
      setStep(0);
      return;
    }

    if (!emailVerified) {
      setError("Please verify your email with the OTP first.");
      setStep(1);
      return;
    }

    try {
      const stillVerified = await isRegistrationEmailVerified(email);
      if (!stillVerified) {
        setEmailVerified(false);
        setError("Email OTP expired. Please request a new code.");
        setStep(1);
        return;
      }
    } catch (err) {
      setError(err.message || "Unable to confirm email verification.");
      setStep(1);
      return;
    }

    if (!validateAccountSetup()) {
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: "customer",
        emailVerified: true,
        privacyConsent: true,
        privacyConsentAt: serverTimestamp(),
        privacyNoticeVersion: "1.0",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess("Registration successful!");

      setTimeout(() => {
        navigate("/?signin=1");
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === "auth/email-already-in-use") {
        setError("This email address is already registered.");
      } else if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        setError("Password must meet all password requirements.");
      } else if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError(error.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stepTitle =
    step === 0
      ? "Personal Information"
      : step === 1
        ? "Verify Email"
        : "Account Setup";

  return (
    <div className="registration-page">
      <div className="registration-shell">
        <div className="reg-topbar">
          <button type="button" className="reg-back" onClick={goBack}>
            <span className="reg-back-circle" aria-hidden="true">
              ←
            </span>
            <span>Back</span>
          </button>

          <div className="stepper" aria-label="Registration progress">
            <div className={`step-bar ${step >= 0 ? "active" : ""}`} />
            <div className={`step-bar ${step >= 1 ? "active" : ""}`} />
            <div className={`step-bar ${step >= 2 ? "active" : ""}`} />
          </div>

          <div className="reg-topbar-spacer" />
        </div>

        <div className="registration-container">
          <div className="step-page-title">
            <h1>{stepTitle}</h1>
          </div>

          <form className="registration-form" onSubmit={handleRegister}>
            {step === 0 && (
              <>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="firstName">
                      First Name <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Given name"
                      disabled={loading || otpSending}
                      autoComplete="given-name"
                      required
                      className={fieldErrors.firstName ? "input-error" : ""}
                    />
                    {fieldErrors.firstName && (
                      <span className="field-error">{fieldErrors.firstName}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">
                      Last Name <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Family name"
                      disabled={loading || otpSending}
                      autoComplete="family-name"
                      required
                      className={fieldErrors.lastName ? "input-error" : ""}
                    />
                    {fieldErrors.lastName && (
                      <span className="field-error">{fieldErrors.lastName}</span>
                    )}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="email">
                      Email Address <span className="req">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your Gmail / email"
                      disabled={loading || otpSending}
                      autoComplete="email"
                      required
                      className={fieldErrors.email ? "input-error" : ""}
                    />
                    {fieldErrors.email && (
                      <span className="field-error">{fieldErrors.email}</span>
                    )}
                    <p className="otp-help-text">
                      We will send a 6-digit OTP to this email for validation.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">
                      Phone Number <span className="req">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Enter your phone number"
                      disabled={loading || otpSending}
                      autoComplete="tel"
                      required
                      className={fieldErrors.phone ? "input-error" : ""}
                    />
                    {fieldErrors.phone && (
                      <span className="field-error">{fieldErrors.phone}</span>
                    )}
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="reg-footer">
                  <button
                    type="button"
                    className="next-button"
                    onClick={goNextFromPersonalInfo}
                    disabled={loading || otpSending}
                  >
                    {loading || otpSending ? "Sending OTP..." : "Next →"}
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="otp-panel">
                  <p className="otp-copy">
                    Enter the 6-digit OTP sent to{" "}
                    <strong>{formData.email.trim()}</strong>.
                  </p>

                  {otpInfo && <div className="otp-info-message">{otpInfo}</div>}

                  <ol className="otp-steps">
                    <li>Open Gmail for that address (check Spam/Promotions too).</li>
                    <li>
                      If you see <strong>Activate Form</strong> from FormSubmit,
                      click it once.
                    </li>
                    <li>
                      Come back here and tap <strong>Resend OTP</strong> to get
                      the 6-digit code.
                    </li>
                  </ol>

                  <div className="form-group otp-input-group">
                    <label id="otpCodeLabel">
                      Email OTP <span className="req">*</span>
                    </label>
                    <div
                      className="otp-boxes"
                      role="group"
                      aria-labelledby="otpCodeLabel"
                      onPaste={handleOtpPaste}
                    >
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) =>
                            handleOtpDigitChange(index, e.target.value)
                          }
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onFocus={(e) => e.target.select()}
                          disabled={loading}
                          autoComplete={index === 0 ? "one-time-code" : "off"}
                          aria-label={`OTP digit ${index + 1}`}
                          className="otp-box"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="otp-actions">
                    <button
                      type="button"
                      className="otp-resend"
                      onClick={handleResendOtp}
                      disabled={loading || otpSending}
                    >
                      {otpSending ? "Resending..." : "Resend OTP"}
                    </button>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="reg-footer">
                  <button
                    type="button"
                    className="next-button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.trim().length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify Email →"}
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="otp-verified-banner">
                  Email verified: <strong>{formData.email.trim()}</strong>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="password">
                      Password <span className="req">*</span>
                    </label>
                    <div className="reg-password-wrap">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a password"
                        disabled={loading}
                        autoComplete="new-password"
                        required
                        className={fieldErrors.password ? "input-error" : ""}
                      />
                      <button
                        type="button"
                        className="reg-password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <span className="field-error">{fieldErrors.password}</span>
                    )}

                    {formData.password && (
                      <div className="password-requirements password-requirements-visible">
                        <p className="password-requirements-title">
                          Password must contain:
                        </p>

                        <div
                          className={
                            formData.password.length >= 8
                              ? "password-requirement met"
                              : "password-requirement"
                          }
                        >
                          <span>
                            {formData.password.length >= 8 ? "✓" : "✕"}
                          </span>
                          <span>At least 8 characters</span>
                        </div>

                        <div
                          className={
                            /[A-Z]/.test(formData.password)
                              ? "password-requirement met"
                              : "password-requirement"
                          }
                        >
                          <span>
                            {/[A-Z]/.test(formData.password) ? "✓" : "✕"}
                          </span>
                          <span>At least 1 uppercase letter</span>
                        </div>

                        <div
                          className={
                            /[a-z]/.test(formData.password)
                              ? "password-requirement met"
                              : "password-requirement"
                          }
                        >
                          <span>
                            {/[a-z]/.test(formData.password) ? "✓" : "✕"}
                          </span>
                          <span>At least 1 lowercase letter</span>
                        </div>

                        <div
                          className={
                            /\d/.test(formData.password)
                              ? "password-requirement met"
                              : "password-requirement"
                          }
                        >
                          <span>
                            {/\d/.test(formData.password) ? "✓" : "✕"}
                          </span>
                          <span>At least 1 number</span>
                        </div>

                        <div
                          className={
                            /[^A-Za-z0-9]/.test(formData.password)
                              ? "password-requirement met"
                              : "password-requirement"
                          }
                        >
                          <span>
                            {/[^A-Za-z0-9]/.test(formData.password)
                              ? "✓"
                              : "✕"}
                          </span>
                          <span>At least 1 special character</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">
                      Confirm Password <span className="req">*</span>
                    </label>
                    <div className="reg-password-wrap">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm your password"
                        disabled={loading}
                        autoComplete="new-password"
                        required
                        className={
                          fieldErrors.confirmPassword ? "input-error" : ""
                        }
                      />
                      <button
                        type="button"
                        className="reg-password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <span className="field-error">
                        {fieldErrors.confirmPassword}
                      </span>
                    )}

                    {formData.confirmPassword && (
                      <div
                        className={
                          formData.password === formData.confirmPassword
                            ? "password-match-message matched"
                            : "password-match-message not-matched"
                        }
                      >
                        <span>
                          {formData.password === formData.confirmPassword
                            ? "✓"
                            : "✕"}
                        </span>
                        <span>
                          {formData.password === formData.confirmPassword
                            ? "Passwords match"
                            : "Password does not match"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="privacy-consent">
                  <label className="privacy-checkbox">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => {
                        setPrivacyConsent(e.target.checked);
                        setError("");
                      }}
                      disabled={loading}
                    />

                    <span>
                      I have read and understood the{" "}
                      <button
                        type="button"
                        className="privacy-link"
                        onClick={() => setShowPrivacyNotice(true)}
                        disabled={loading}
                      >
                        Data Privacy Notice
                      </button>{" "}
                      and agree to the processing of my personal information.
                    </span>
                  </label>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="reg-footer">
                  <button
                    type="submit"
                    className="register-button"
                    disabled={loading || !emailVerified}
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="login-link">
            Already have an account? <Link to="/?signin=1">Login</Link>
          </div>
        </div>
      </div>

      {showPrivacyNotice && (
        <div className="privacy-modal-overlay">
          <div className="privacy-modal">
            <div className="privacy-modal-header">
              <h2>Data Privacy Notice</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowPrivacyNotice(false)}
                aria-label="Close Data Privacy Notice"
              >
                ×
              </button>
            </div>

            <div className="privacy-modal-content">
              <h3>Data Privacy Act of 2012</h3>
              <p>
                In accordance with the Data Privacy Act of 2012 (Republic Act
                No. 10173), we respect your right to privacy and are committed
                to protecting your personal information.
              </p>

              <h3>Information We Collect</h3>
              <p>
                During registration, we may collect information such as your
                name, email address, and phone number.
              </p>

              <h3>Purpose of Collection</h3>
              <p>
                Your information may be used to create and manage your account,
                authenticate your identity, provide our services, process
                transactions, communicate with you, and maintain the security of
                the system.
              </p>

              <h3>Protection of Your Information</h3>
              <p>
                We implement reasonable organizational, physical, and technical
                measures to protect your personal information against
                unauthorized access, alteration, disclosure, or destruction.
              </p>

              <h3>Your Privacy Rights</h3>
              <p>
                Subject to applicable laws and regulations, you may have rights
                regarding your personal information, including the right to
                access, correct, and request the appropriate disposal of your
                personal information.
              </p>
              <p>
                By proceeding with registration, you acknowledge that you have
                read and understood this Data Privacy Notice and consent to the
                processing of your personal information for the purposes
                described above.
              </p>
            </div>

            <div className="privacy-modal-footer">
              <button
                type="button"
                className="privacy-agree-button"
                onClick={() => {
                  setPrivacyConsent(true);
                  setShowPrivacyNotice(false);
                  setError("");
                }}
              >
                I Understand and Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registration;
