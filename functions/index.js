/**
 * Optional Cloud Function mailer for LaundryMate OTP.
 * Deploy only if the Firebase project is on Blaze and Gmail SMTP is configured:
 *   firebase functions:secrets:set GMAIL_USER
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 *   firebase deploy --only functions
 *
 * The web app works without this (FormSubmit / EmailJS client mailer).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toOtpDocId(email) {
  return normalizeEmail(email).replace(/[^a-z0-9]/gi, "_");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

exports.sendRegistrationOtp = onCall(
  { secrets: [gmailUser, gmailAppPassword], cors: true },
  async (request) => {
    const email = normalizeEmail(request.data?.email);
    const firstName = String(request.data?.firstName || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Valid email is required.");
    }

    const user = gmailUser.value();
    const pass = gmailAppPassword.value();
    if (!user || !pass) {
      throw new HttpsError(
        "failed-precondition",
        "Gmail SMTP is not configured on the server."
      );
    }

    const otp = createOtpCode();
    const otpHash = hashValue(`${email}:${otp}`);
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await db
      .collection("emailOtps")
      .doc(toOtpDocId(email))
      .set({
        email,
        otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"LaundryMate" <${user}>`,
      to: email,
      subject: "LaundryMate verification code",
      text: `Hi ${firstName || "there"},\n\nYour LaundryMate OTP is ${otp}.\nIt expires in 10 minutes.\n`,
      html: `<p>Hi ${firstName || "there"},</p><p>Your LaundryMate OTP is <strong style="font-size:20px;letter-spacing:3px">${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });

    return { ok: true, email, expiresAt };
  }
);
