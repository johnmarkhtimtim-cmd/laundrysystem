import emailjs from "@emailjs/browser";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const OTP_COLLECTION = "emailOtps";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim();
const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim();
const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toOtpDocId(email) {
  return normalizeEmail(email).replace(/[^a-z0-9]/gi, "_");
}

async function hashValue(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isEmailjsConfigured() {
  return Boolean(
    emailjsServiceId &&
      emailjsTemplateId &&
      emailjsPublicKey &&
      !emailjsServiceId.includes("your_service") &&
      !emailjsTemplateId.includes("your_template") &&
      !emailjsPublicKey.includes("your_public")
  );
}

async function sendOtpWithEmailjs({ email, otp, firstName }) {
  await emailjs.send(
    emailjsServiceId,
    emailjsTemplateId,
    {
      to_email: email,
      email,
      otp_code: otp,
      passcode: otp,
      otp,
      user_name: firstName || "LaundryMate user",
      to_name: firstName || "LaundryMate user",
      app_name: "LaundryMate",
      message: `Your LaundryMate verification code is ${otp}. It expires in 10 minutes.`,
    },
    { publicKey: emailjsPublicKey }
  );

  return { provider: "emailjs", needsActivation: false };
}

/**
 * Sends OTP to the exact address the user typed.
 * FormSubmit requires a one-time "Activate Form" click per new inbox.
 */
async function sendOtpWithFormSubmit({ email, otp, firstName }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response;
  try {
    response = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(email)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: firstName || "LaundryMate User",
          email,
          subject: "LaundryMate verification code",
          _subject: "LaundryMate verification code",
          message: `Your LaundryMate OTP is ${otp}. This code expires in 10 minutes.`,
          otp_code: otp,
          "OTP Code": otp,
          app_name: "LaundryMate",
          _template: "table",
          _captcha: "false",
          _honey: "",
        }),
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Email request timed out. Please tap Resend OTP.");
    }
    throw new Error(
      "Unable to reach the email service. Check your internet and try again."
    );
  } finally {
    clearTimeout(timeout);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const message = String(payload?.message || "");
  const lower = message.toLowerCase();
  const successFlag = String(payload?.success || "").toLowerCase();

  // First-time inbox: FormSubmit sends an Activate Form email instead of OTP.
  if (
    lower.includes("activation") ||
    lower.includes("activate form") ||
    lower.includes("confirm") ||
    (successFlag === "false" && lower.includes("activate"))
  ) {
    return {
      provider: "formsubmit",
      needsActivation: true,
      message:
        "Open Gmail and click the FormSubmit “Activate Form” link first. Then come back and tap Resend OTP — the 6-digit code will arrive next.",
    };
  }

  if (!response.ok || successFlag === "false") {
    throw new Error(
      message || "Unable to send OTP email. Please try Resend OTP."
    );
  }

  return { provider: "formsubmit", needsActivation: false };
}

async function sendOtpEmail({ email, otp, firstName }) {
  if (isEmailjsConfigured()) {
    return sendOtpWithEmailjs({ email, otp, firstName });
  }
  return sendOtpWithFormSubmit({ email, otp, firstName });
}

/**
 * Generate OTP, store hash in Firestore, email the code to the user.
 * @returns {{ email: string, expiresAt: number, needsActivation?: boolean, infoMessage?: string }}
 */
export async function sendRegistrationOtp({ email, firstName = "" }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  const otp = createOtpCode();
  const otpHash = await hashValue(`${normalizedEmail}:${otp}`);
  const docId = toOtpDocId(normalizedEmail);
  const expiresAt = Date.now() + OTP_TTL_MS;

  try {
    await setDoc(doc(db, OTP_COLLECTION, docId), {
      email: normalizedEmail,
      otpHash,
      expiresAt,
      verified: false,
      attempts: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("OTP store error:", error);
    throw new Error(
      "Unable to start email verification (database permissions). Please refresh and try again."
    );
  }

  let delivery;
  try {
    delivery = await sendOtpEmail({
      email: normalizedEmail,
      otp,
      firstName,
    });
  } catch (error) {
    console.error("OTP email error:", error);
    throw error;
  }

  return {
    email: normalizedEmail,
    expiresAt,
    needsActivation: Boolean(delivery?.needsActivation),
    infoMessage: delivery?.needsActivation
      ? delivery.message
      : `A 6-digit OTP was sent to ${normalizedEmail}. Check Inbox, Spam, and Promotions.`,
  };
}

export async function verifyRegistrationOtp({ email, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const code = String(otp || "").trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP sent to your email.");
  }

  const docRef = doc(db, OTP_COLLECTION, toOtpDocId(normalizedEmail));
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("No OTP found for this email. Please request a new code.");
  }

  const data = snapshot.data();

  if (data.verified) {
    return true;
  }

  if (Number(data.expiresAt) < Date.now()) {
    throw new Error("OTP expired. Please request a new code.");
  }

  const attempts = Number(data.attempts || 0);
  if (attempts >= MAX_ATTEMPTS) {
    throw new Error("Too many invalid attempts. Please request a new code.");
  }

  const otpHash = await hashValue(`${normalizedEmail}:${code}`);
  if (otpHash !== data.otpHash) {
    await updateDoc(docRef, {
      attempts: attempts + 1,
      updatedAt: serverTimestamp(),
    });
    throw new Error("Incorrect OTP. Please check your email and try again.");
  }

  await updateDoc(docRef, {
    verified: true,
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}

export async function isRegistrationEmailVerified(email) {
  const normalizedEmail = normalizeEmail(email);
  const snapshot = await getDoc(
    doc(db, OTP_COLLECTION, toOtpDocId(normalizedEmail))
  );

  if (!snapshot.exists()) return false;

  const data = snapshot.data();
  return Boolean(data.verified) && Number(data.expiresAt) >= Date.now();
}
