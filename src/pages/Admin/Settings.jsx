import { useEffect, useRef, useState } from "react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../context/AuthContext";
import { uploadGcashQr } from "../../services/fileUploadService";
import {
  getGeneralSettings,
  getPaymentSettings,
  updateGeneralSettings,
  updatePaymentSettings,
} from "../../services/paymentService";
import {
  GCASH_QR_RULES,
  validateUserUpload,
} from "../../utils/fileValidation";

export default function Settings() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [savedGeneral, setSavedGeneral] = useState(false);
  const [savedPayment, setSavedPayment] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState("");
  const [qrError, setQrError] = useState("");
  const [businessName, setBusinessName] = useState("LaundryMate");
  const [pickupWindow, setPickupWindow] = useState("Same day");
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState(50);
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQr, setGcashQr] = useState("");
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState("");

  useEffect(() => {
    let mounted = true;

    Promise.all([getGeneralSettings(), getPaymentSettings()])
      .then(([general, payment]) => {
        if (!mounted) return;
        setBusinessName(general.businessName || "LaundryMate");
        setPickupWindow(general.pickupWindow || "Same day");
        {
          const parsedMax = Number(general.maxBookingsPerDay);
          setMaxBookingsPerDay(
            Number.isFinite(parsedMax) && parsedMax >= 0
              ? Math.floor(parsedMax)
              : 50
          );
        }
        setGcashName(payment.gcashName || "");
        setGcashNumber(payment.gcashNumber || "");
        setGcashQr(payment.gcashQr || "");
      })
      .catch((loadError) => {
        console.error(loadError);
        if (mounted) setError("Unable to load settings.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (qrPreview && qrPreview.startsWith("blob:")) {
        URL.revokeObjectURL(qrPreview);
      }
    };
  }, [qrPreview]);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    setError("");
    setSavedGeneral(false);
    try {
      const saved = await updateGeneralSettings({
        businessName: businessName.trim(),
        pickupWindow,
        maxBookingsPerDay,
      });
      if (saved?.maxBookingsPerDay != null) {
        setMaxBookingsPerDay(saved.maxBookingsPerDay);
      }
      setSavedGeneral(true);
    } catch (saveError) {
      console.error(saveError);
      setError("Could not save general settings.");
    } finally {
      setSavingGeneral(false);
    }
  };

  const clearSelectedQr = () => {
    if (qrPreview && qrPreview.startsWith("blob:")) {
      URL.revokeObjectURL(qrPreview);
    }
    setQrFile(null);
    setQrPreview("");
    setQrError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleQrFileChange = async (event) => {
    const file = event.target.files?.[0];
    setQrError("");
    setSavedPayment(false);

    if (!file) {
      clearSelectedQr();
      return;
    }

    const validation = await validateUserUpload(file, GCASH_QR_RULES);
    if (!validation.ok) {
      clearSelectedQr();
      setQrError(validation.error);
      return;
    }

    if (qrPreview && qrPreview.startsWith("blob:")) {
      URL.revokeObjectURL(qrPreview);
    }

    setQrFile(validation.file);
    setQrPreview(URL.createObjectURL(validation.file));
  };

  const handleSavePaymentSettings = async () => {
    setSavingPayment(true);
    setError("");
    setQrError("");
    setSavedPayment(false);
    try {
      let nextQr = gcashQr.trim();

      if (qrFile) {
        if (!user?.uid) {
          throw new Error("You must be signed in to upload a GCash QR.");
        }
        const uploaded = await uploadGcashQr({
          file: qrFile,
          userId: user.uid,
        });
        nextQr = uploaded.gcashQr;
      }

      if (!nextQr) {
        setQrError("Please upload a GCash QR image before saving.");
        return;
      }

      await updatePaymentSettings({
        gcashName: gcashName.trim(),
        gcashNumber: gcashNumber.trim(),
        gcashQr: nextQr,
      });

      setGcashQr(nextQr);
      clearSelectedQr();
      setSavedPayment(true);
    } catch (saveError) {
      console.error(saveError);
      const code = String(saveError?.code || "");
      const message = String(saveError?.message || "");
      if (code.includes("permission") || message.toLowerCase().includes("permission")) {
        setError(
          "Missing or insufficient permissions. Your account can open Admin, but Firestore blocked the save. Ask to deploy firestore.rules, or re-check that users/{yourUid}.role is admin."
        );
      } else {
        setError(message || "Could not save payment settings.");
      }
    } finally {
      setSavingPayment(false);
    }
  };

  const previewSrc = qrPreview || gcashQr;

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Manage business information, GCash details, and defaults."
      />

      <section className="portal-card settings-form">
        <h2>General</h2>
        <div className="settings-fields">
          <label className="settings-field-full">
            Business name
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </label>
          <label>
            Pickup & Delivery window
            <select
              value={pickupWindow}
              onChange={(e) => setPickupWindow(e.target.value)}
            >
              <option>Same day</option>
              <option>Next day</option>
            </select>
          </label>
          <label>
            Max bookings per day
            <input
              type="number"
              min="0"
              step="1"
              value={maxBookingsPerDay}
              onChange={(e) => setMaxBookingsPerDay(e.target.value)}
            />
          </label>
        </div>
        <p style={{ marginTop: 0, marginBottom: 18, color: "#64748b", fontSize: 14 }}>
          Limits how many customer bookings can be scheduled for one pickup date.
          Set to 0 to block all new bookings until you set a positive number again.
        </p>
        <button
          className="primary-action"
          type="button"
          onClick={handleSaveGeneral}
          disabled={savingGeneral}
        >
          {savingGeneral ? "Saving..." : "Save general settings"}
        </button>
        {savedGeneral && <small>General settings saved.</small>}
      </section>

      <section className="portal-card settings-form">
        <h2>GCash payment details</h2>
        <p style={{ marginTop: 0, marginBottom: 18, color: "#64748b", fontSize: 15 }}>
          These details appear on the customer Payments page for online
          transfers.
        </p>
        <div className="settings-fields">
          <label>
            GCash account name
            <input
              value={gcashName}
              onChange={(e) => setGcashName(e.target.value)}
              placeholder="Shop GCash name"
            />
          </label>
          <label>
            GCash number
            <input
              value={gcashNumber}
              onChange={(e) => setGcashNumber(e.target.value)}
              placeholder="09XXXXXXXXX"
            />
          </label>
        </div>

        <div className="settings-qr-block">
          <span className="settings-qr-label">GCash QR image</span>
          <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 14 }}>
            Upload a clear JPG, PNG, or WEBP of your shop GCash QR (max 2 MB).
            Customers will see this on the Payments page.
          </p>

          {previewSrc ? (
            <div className="settings-qr-preview">
              <img src={previewSrc} alt="GCash QR preview" />
              {qrFile && (
                <button
                  type="button"
                  className="settings-qr-clear"
                  onClick={clearSelectedQr}
                >
                  Remove selected file
                </button>
              )}
            </div>
          ) : (
            <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 14 }}>
              No QR uploaded yet.
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={handleQrFileChange}
          />
          {qrError && (
            <small style={{ color: "#b91c1c", display: "block", marginTop: 8 }}>
              {qrError}
            </small>
          )}
        </div>

        <button
          className="primary-action"
          type="button"
          onClick={handleSavePaymentSettings}
          disabled={savingPayment}
        >
          {savingPayment
            ? qrFile
              ? "Uploading QR..."
              : "Saving..."
            : "Save payment settings"}
        </button>
        {savedPayment && <small>Payment settings saved.</small>}
        {error && (
          <small style={{ color: "#b91c1c", display: "block" }}>{error}</small>
        )}
      </section>
    </>
  );
}
