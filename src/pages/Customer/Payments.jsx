import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { createBooking, getCustomerBookings } from "../../services/bookingService";
import {
  createPayment,
  DEFAULT_PAYMENT_SETTINGS,
  getCustomerPayments,
  subscribeToPaymentSettings,
  updateCustomerPayment,
} from "../../services/paymentService";
import { uploadPaymentReceipt } from "../../services/fileUploadService";
import { materializeFileInMemory, validateUserUpload } from "../../utils/fileValidation";
import { extractGcashReceiptFields } from "../../utils/gcashReceiptOcr";
import { formatShortBookingId, getBookingId } from "../../utils/bookingId";
import { subscribeToServices } from "../../services/laundryService";
import "../../styles/Payments.css";

function getDateMilliseconds(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();

  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
}

function normalizePayment(payment) {
  return {
    ...payment,
    paymentId: payment.payment_id || payment.id,
    bookingId: payment.booking_id || payment.bookingId,
    userId: payment.customer_id || payment.userId,
    paymentMethod: payment.payment_method || payment.paymentMethod,
    paymentStatus: payment.payment_status || payment.paymentStatus,
    referenceNumber: payment.reference_number || payment.referenceNumber,
    receiptUrl: payment.receipt_url || payment.receiptUrl || "",
    receiptName: payment.receipt_name || payment.receiptName || "",
    gcashCustomerName:
      payment.gcash_customer_name || payment.gcashCustomerName,
    totalAmount: payment.total_amount ?? payment.totalAmount ?? payment.amount,
    createdAt: payment.created_at || payment.createdAt,
  };
}

const DRAFT_BOOKING_ID = "__draft_booking__";

function getDraftStorageKey(uid) {
  return uid ? `laundrymate_pending_booking_draft_${uid}` : "";
}

function readStoredBookingDraft(uid) {
  if (!uid) return null;
  try {
    const raw = sessionStorage.getItem(getDraftStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.services) || parsed.services.length === 0) {
      return null;
    }
    return {
      ...parsed,
      id: DRAFT_BOOKING_ID,
      booking_id: DRAFT_BOOKING_ID,
      isDraft: true,
    };
  } catch {
    return null;
  }
}

function clearStoredBookingDraft(uid) {
  if (!uid) return;
  try {
    sessionStorage.removeItem(getDraftStorageKey(uid));
  } catch {
    // Ignore storage errors
  }
}

function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // =========================================================
  // STATE
  // =========================================================

  const [bookings, setBookings] = useState([]);
  const [pendingBookingDraft, setPendingBookingDraft] = useState(() => {
    const fromState = location.state?.pendingBookingDraft;
    if (fromState && Array.isArray(fromState.services) && fromState.services.length > 0) {
      return {
        ...fromState,
        id: DRAFT_BOOKING_ID,
        booking_id: DRAFT_BOOKING_ID,
        isDraft: true,
      };
    }
    return readStoredBookingDraft(user?.uid);
  });
  const [selectedBookingId, setSelectedBookingId] = useState(() =>
    location.state?.pendingBookingDraft || readStoredBookingDraft(user?.uid)
      ? DRAFT_BOOKING_ID
      : ""
  );
  const selectedBookingIdRef = useRef(selectedBookingId);
  const isSubmittingRef = useRef(false);
  const draftCreatedBookingIdRef = useRef(null);
  const [draftCreatedBookingId, setDraftCreatedBookingId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [services, setServices] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState("GCash");

  // CUSTOMER GCASH NAME
  const [gcashCustomerName, setGcashCustomerName] =
    useState("");

  // GCASH REFERENCE
  const [referenceNumber, setReferenceNumber] =
    useState("");

  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusTone, setOcrStatusTone] = useState("neutral");
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isDuplicateReference, setIsDuplicateReference] = useState(false);
  const manualEditsRef = useRef({
    gcashCustomerName: false,
    referenceNumber: false,
  });
  const ocrRunIdRef = useRef(0);
  const referenceCheckTimerRef = useRef(null);

  // SHOP GCASH SETTINGS
  const [gcashName, setGcashName] =
    useState(DEFAULT_PAYMENT_SETTINGS.gcashName);

  const [gcashNumber, setGcashNumber] =
    useState(DEFAULT_PAYMENT_SETTINGS.gcashNumber);

  const [gcashQr, setGcashQr] =
    useState(DEFAULT_PAYMENT_SETTINGS.gcashQr);

  const [qrMaximized, setQrMaximized] = useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [showPaymentSummary, setShowPaymentSummary] =
    useState(false);

  const [submittedPayment, setSubmittedPayment] =
    useState(null);

  const [editingPayment, setEditingPayment] =
    useState(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const activePendingDraft = useMemo(() => {
    if (!user?.uid) return null;
    const fromState = location.state?.pendingBookingDraft;
    if (fromState && Array.isArray(fromState.services) && fromState.services.length > 0) {
      return {
        ...fromState,
        id: DRAFT_BOOKING_ID,
        booking_id: DRAFT_BOOKING_ID,
        isDraft: true,
      };
    }
    return pendingBookingDraft;
  }, [user?.uid, location.state, pendingBookingDraft]);

  const selectableBookings = useMemo(() => {
    return activePendingDraft ? [activePendingDraft, ...bookings] : bookings;
  }, [activePendingDraft, bookings]);

  const booking = useMemo(() => {
    if (!selectedBookingId) return null;
    return (
      selectableBookings.find(
        (item) => String(getBookingId(item)) === String(selectedBookingId)
      ) || null
    );
  }, [selectedBookingId, selectableBookings]);

  const syncPaymentFormForSelection = useCallback(
    (nextBookingId, nextSelectable, nextPayments) => {
      if (!nextBookingId) return;

      const matched = nextSelectable.find(
        (item) => String(getBookingId(item)) === String(nextBookingId)
      );

      const relatedPayment =
        matched?.isDraft
          ? null
          : nextPayments.find(
              (payment) =>
                String(getBookingId(payment)) === String(nextBookingId) &&
                ["pending", "rejected"].includes(
                  String(payment.paymentStatus || payment.status || "").toLowerCase()
                )
            );

      ocrRunIdRef.current += 1;
      if (referenceCheckTimerRef.current) {
        clearTimeout(referenceCheckTimerRef.current);
        referenceCheckTimerRef.current = null;
      }
      manualEditsRef.current = {
        gcashCustomerName: false,
        referenceNumber: false,
      };
      setOcrStatus("");
      setOcrStatusTone("neutral");
      setOcrProgress(0);
      setOcrDetectedAmount(null);
      setIsOcrRunning(false);
      setIsDuplicateReference(false);

      if (relatedPayment) {
        setEditingPayment(relatedPayment);
        setPaymentMethod(relatedPayment.paymentMethod || "GCash");
        setGcashCustomerName(relatedPayment.gcashCustomerName || "");
        setReferenceNumber(relatedPayment.referenceNumber || "");
        setReceiptFile(null);
        setReceiptPreview(relatedPayment.receiptUrl || "");
        setReceiptError("");
      } else {
        setEditingPayment(null);
        setPaymentMethod("GCash");
        setGcashCustomerName("");
        setReferenceNumber("");
        setReceiptFile(null);
        setReceiptPreview("");
        setReceiptError("");
      }
    },
    []
  );

  const isReferenceAlreadyUsed = async (reference, excludePaymentId) => {
    if (!user?.uid) return false;

    const clean = String(reference || "").trim().toLowerCase();
    if (!clean) return false;

    try {
      const freshPayments = await getCustomerPayments(user.uid);
      return freshPayments.some((payment) => {
        const paymentKeys = [
          payment.id,
          payment.payment_id,
          payment.paymentId,
        ]
          .filter(Boolean)
          .map(String);

        if (
          excludePaymentId &&
          paymentKeys.includes(String(excludePaymentId))
        ) {
          return false;
        }

        const existingRef = String(
          payment.reference_number || payment.referenceNumber || ""
        )
          .trim()
          .toLowerCase();

        return Boolean(existingRef) && existingRef === clean;
      });
    } catch (checkError) {
      console.error("Duplicate reference check failed:", checkError);
      return false;
    }
  };

  // Debounced live duplicate-reference check: runs when OCR autofills the
  // reference or the customer edits it manually, so a reused receipt is
  // flagged before Confirm Payment is clicked.
  const scheduleReferenceCheck = (value, methodOverride) => {
    if (referenceCheckTimerRef.current) {
      clearTimeout(referenceCheckTimerRef.current);
      referenceCheckTimerRef.current = null;
    }

    const effectiveMethod = methodOverride || paymentMethod;
    const clean = String(value || "").trim();
    if (effectiveMethod !== "GCash" || !user?.uid || clean.length < 6) {
      setIsDuplicateReference(false);
      return;
    }

    referenceCheckTimerRef.current = setTimeout(async () => {
      const duplicate = await isReferenceAlreadyUsed(
        clean,
        editingPayment?.id
      );
      setIsDuplicateReference(duplicate);
    }, 400);
  };

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setBookings([]);
      selectedBookingIdRef.current = "";
      setSelectedBookingId("");
      setPayments([]);
      return;
    }

    const [userBookings, storedPayments] = await Promise.all([
      getCustomerBookings(user.uid),
      getCustomerPayments(user.uid),
    ]);

    const sortedBookings = [...userBookings].sort(
      (a, b) =>
        getDateMilliseconds(b.booking_date || b.created_at || b.createdAt) -
        getDateMilliseconds(a.booking_date || a.created_at || a.createdAt)
    );

    const normalizedPayments = storedPayments.map(normalizePayment);
    setBookings(sortedBookings);
    setPayments(normalizedPayments);

    const fromState = location.state?.pendingBookingDraft;
    const draftItem =
      fromState && Array.isArray(fromState.services) && fromState.services.length > 0
        ? {
            ...fromState,
            id: DRAFT_BOOKING_ID,
            booking_id: DRAFT_BOOKING_ID,
            isDraft: true,
          }
        : readStoredBookingDraft(user.uid);

    const nextSelectable = draftItem ? [draftItem, ...sortedBookings] : sortedBookings;
    const hasDraft = Boolean(draftItem);

    let resolvedSelection = selectedBookingIdRef.current;
    if (resolvedSelection === DRAFT_BOOKING_ID && hasDraft) {
      resolvedSelection = DRAFT_BOOKING_ID;
    } else if (
      resolvedSelection &&
      sortedBookings.some(
        (item) => String(getBookingId(item)) === String(resolvedSelection)
      )
    ) {
      // keep current selection
    } else if (hasDraft) {
      resolvedSelection = DRAFT_BOOKING_ID;
    } else {
      resolvedSelection = sortedBookings[0]
        ? String(getBookingId(sortedBookings[0]))
        : "";
    }

    selectedBookingIdRef.current = resolvedSelection;
    setSelectedBookingId(resolvedSelection);
    syncPaymentFormForSelection(resolvedSelection, nextSelectable, normalizedPayments);
  }, [user, location.state, syncPaymentFormForSelection]);

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    let isMounted = true;
    const refreshData = async () => {
      try {
        await loadData();
        if (isMounted) setError("");
      } catch (error) {
        console.error("Failed to load payment data:", error);
        if (isMounted) {
          setBookings([]);
          setPayments([]);
          setError("Unable to load your booking or payment records. Please refresh to try again.");
        }
      }
    };

    refreshData();

    window.addEventListener(
      "laundrymatePaymentUpdated",
      refreshData
    );

    window.addEventListener(
      "laundrymateBookingUpdated",
      refreshData
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "laundrymatePaymentUpdated",
        refreshData
      );

      window.removeEventListener(
        "laundrymateBookingUpdated",
        refreshData
      );
    };
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = subscribeToPaymentSettings(
      (settings) => {
        setGcashName(settings.gcashName || DEFAULT_PAYMENT_SETTINGS.gcashName);
        setGcashNumber(settings.gcashNumber || DEFAULT_PAYMENT_SETTINGS.gcashNumber);
        setGcashQr(settings.gcashQr || DEFAULT_PAYMENT_SETTINGS.gcashQr);
      },
      (settingsError) => {
        console.error("Unable to load payment settings:", settingsError);
      }
    );

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!qrMaximized) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setQrMaximized(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qrMaximized]);



  // =========================================================
  // LOAD LIVE SERVICE PRICING (ADMIN SERVICES/PRICING MODULE)
  // =========================================================

  useEffect(() => {
    const unsubscribe = subscribeToServices(
      (nextServices) => setServices(nextServices),
      (loadError) => {
        console.error("Unable to load service pricing:", loadError);
      }
    );

    return () => unsubscribe?.();
  }, []);

  // =========================================================
  // GET SERVICE PRICE
  // =========================================================

  const getServicePrice = useCallback(
    (serviceName) => {
      const normalizedName = String(serviceName).toLowerCase().trim();

      const service = services.find(
        (item) =>
          item.status !== "Inactive" &&
          String(item.name).toLowerCase().trim() === normalizedName
      );

      return service ? Number(service.price) || 0 : 0;
    },
    [services]
  );

  // =========================================================
  // GET BOOKING SERVICES
  // =========================================================

  const bookingServices = useMemo(() => {
    if (!booking) return [];

    if (Array.isArray(booking.services)) {
      return booking.services;
    }

    if (booking.services) {
      return String(booking.services)
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);
    }

    if (booking.service) {
      return String(booking.service)
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);
    }

    return [];
  }, [booking]);

  // =========================================================
  // CALCULATE LAUNDRY SUBTOTAL
  // =========================================================

  const laundrySubtotal = useMemo(() => {
    if (!booking) return 0;

    // Current Book Now does not require weight.
    // If a future booking contains weight, support it.
    const weight = Number(
      booking.weight || 0
    );

    if (
      weight > 0 &&
      bookingServices.length > 0
    ) {
      return bookingServices.reduce(
        (total, service) =>
          total +
          getServicePrice(service) *
            weight,
        0
      );
    }

    return bookingServices.reduce(
      (total, service) =>
        total +
        getServicePrice(service),
      0
    );
  }, [booking, bookingServices, getServicePrice]);

  // =========================================================
  // PICKUP FEE
  // =========================================================

  const pickupFee = useMemo(() => {
    if (!booking) return 0;

    const pickupType =
      booking.pickupType ||
      booking.pickupOption ||
      booking.deliveryType ||
      booking.pickup ||
      "Pickup & Delivery";

    if (
      String(pickupType)
        .toLowerCase()
        .includes("pickup only")
    ) {
      return 15;
    }

    return 30;
  }, [booking]);

  // =========================================================
  // TOTAL
  // =========================================================

  const calculatedTotal = useMemo(() => {
    if (!booking) return 0;

    const savedTotal = Number(
      booking.total_amount ??
        booking.totalAmount ??
        booking.estimatedTotal ??
        0
    );

    if (savedTotal > 0) {
      return savedTotal;
    }

    return laundrySubtotal + pickupFee;
  }, [
    booking,
    laundrySubtotal,
    pickupFee,
  ]);

  const expectedAmountToSend = useMemo(
    () => Number(Number(calculatedTotal || 0).toFixed(2)),
    [calculatedTotal]
  );

  const parsedOcrAmount = useMemo(() => {
    if (
      ocrDetectedAmount === null ||
      ocrDetectedAmount === undefined ||
      ocrDetectedAmount === ""
    ) {
      return null;
    }
    const num = Number(ocrDetectedAmount);
    return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
  }, [ocrDetectedAmount]);

  const isReceiptAmountMismatched = useMemo(() => {
    if (paymentMethod !== "GCash" || !receiptFile || isOcrRunning) {
      return false;
    }
    if (parsedOcrAmount === null) {
      return true;
    }
    return Math.abs(parsedOcrAmount - expectedAmountToSend) > 0.009;
  }, [
    paymentMethod,
    receiptFile,
    isOcrRunning,
    parsedOcrAmount,
    expectedAmountToSend,
  ]);

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (amount) => {
    return `₱${Number(
      amount || 0
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );
  };

  // =========================================================
  // BOOKING SCHEDULE
  // =========================================================

  const getBookingSchedule = () => {
    if (!booking) return "—";

    // New Book Now format
    if (
      booking.schedule &&
      booking.time
    ) {
      return `${formatDate(
        booking.schedule
      )} • ${booking.time}`;
    }

    return (
      booking.pickup_date ||
      booking.pickupDate ||
      booking.schedule ||
      booking.date ||
      "—"
    );
  };

  // =========================================================
  // ADDRESS
  // =========================================================

  const getAddress = () => {
    if (!booking) return "—";

    return (
      booking.address ||
      booking.pickupAddress ||
      booking.laundryAddress ||
      "—"
    );
  };

  // =========================================================
  // BARANGAY
  // =========================================================

  const getBarangay = () => {
    if (!booking) return "—";

    return (
      booking.barangay ||
      booking.addressBarangay ||
      "—"
    );
  };

  // =========================================================
  // CITY
  // =========================================================

  const getCity = () => {
    if (!booking) return "—";

    return (
      booking.city ||
      booking.addressCity ||
      "—"
    );
  };

  // =========================================================
  // PROVINCE
  // =========================================================

  const getProvince = () => {
    if (!booking) return "—";

    return (
      booking.province ||
      booking.addressProvince ||
      "—"
    );
  };

  // =========================================================
  // LANDMARK
  // =========================================================

  const getLandmark = () => {
    if (!booking) return "—";

    return (
      booking.landmark ||
      "—"
    );
  };

  // =========================================================
  // PAYMENT METHOD
  // =========================================================

  const handlePaymentMethodChange = (
    method
  ) => {
    setPaymentMethod(method);
    scheduleReferenceCheck(referenceNumber, method);
    setError("");
  };

  // =========================================================
  // GCASH CUSTOMER NAME
  // =========================================================

  const handleGcashCustomerNameChange = (event) => {
    const nextValue = event.target.value;
    manualEditsRef.current.gcashCustomerName = Boolean(nextValue.trim());
    setGcashCustomerName(nextValue);

    if (error) {
      setError("");
    }
  };

  // =========================================================
  // GCASH REFERENCE
  // =========================================================

  const handleReferenceChange = (event) => {
    const nextValue = event.target.value;
    manualEditsRef.current.referenceNumber = Boolean(nextValue.trim());
    setReferenceNumber(nextValue);
    scheduleReferenceCheck(nextValue);

    if (error) {
      setError("");
    }
  };

  const clearReceiptSelection = () => {
    ocrRunIdRef.current += 1;
    setReceiptFile(null);
    setReceiptError("");
    setOcrStatus("");
    setOcrStatusTone("neutral");
    setOcrProgress(0);
    setOcrDetectedAmount(null);
    setIsOcrRunning(false);
    setReceiptPreview((current) => {
      if (current && current.startsWith("blob:")) URL.revokeObjectURL(current);
      return "";
    });
  };

  const handleReceiptChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setReceiptError("");
    setOcrStatus("");
    setOcrStatusTone("neutral");
    setOcrProgress(0);
    setOcrDetectedAmount(null);
    setIsOcrRunning(false);

    if (!file) {
      clearReceiptSelection();
      return;
    }

    const validation = await validateUserUpload(file);
    if (!validation.ok) {
      clearReceiptSelection();
      setReceiptError(validation.error);
      event.target.value = "";
      return;
    }

    let safeFile;
    try {
      safeFile = await materializeFileInMemory(
        validation.file,
        validation.safeName,
        validation.mime
      );
    } catch (readErr) {
      console.error("Unable to buffer selected receipt:", readErr);
      clearReceiptSelection();
      setReceiptError(
        "Unable to read the selected image. Please try choosing it again."
      );
      event.target.value = "";
      return;
    }

    const runId = ocrRunIdRef.current + 1;
    ocrRunIdRef.current = runId;

    setReceiptPreview((current) => {
      if (current && current.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(safeFile);
    });
    setReceiptFile(safeFile);
    if (error) setError("");

    // Auto-fill name + reference from receipt via browser OCR (no Firebase needed)
    setIsOcrRunning(true);
    setOcrStatus("Reading receipt...");
    setOcrStatusTone("neutral");
    try {
      const extracted = await extractGcashReceiptFields(
        safeFile,
        (pct) => {
          if (ocrRunIdRef.current !== runId) return;
          setOcrProgress(pct);
          setOcrStatus(`Reading receipt... ${pct}%`);
        }
      );

      if (ocrRunIdRef.current !== runId) return;

      const detectedName = extracted.gcashCustomerName || "";
      const detectedRef = extracted.referenceNumber || "";
      const rawAmountStr = extracted.transactionAmount || "";
      const scannedNumeric =
        rawAmountStr !== "" && Number.isFinite(Number(rawAmountStr))
          ? Number(Number(rawAmountStr).toFixed(2))
          : null;

      setOcrDetectedAmount(scannedNumeric);

      const canAutofillName = Boolean(
        detectedName &&
          extracted.shouldAutofillName !== false &&
          !extracted.hasAmbiguousName
      );

      if (canAutofillName && !manualEditsRef.current.gcashCustomerName) {
        setGcashCustomerName(detectedName.slice(0, 50));
      }
      if (detectedRef && !manualEditsRef.current.referenceNumber) {
        setReferenceNumber(detectedRef.slice(0, 30));
      }
      scheduleReferenceCheck(
        detectedRef && !manualEditsRef.current.referenceNumber
          ? detectedRef.slice(0, 30)
          : referenceNumber
      );

      const details = [];
      if (extracted.transactionAmount) {
        details.push(`Amount: ₱${extracted.transactionAmount}`);
      }
      if (extracted.transactionDateTime) {
        details.push(extracted.transactionDateTime);
      }
      const detailSuffix = details.length ? ` (${details.join(" • ")})` : "";

      const nameUncertain = Boolean(
        !canAutofillName ||
          extracted.hasAmbiguousName ||
          extracted.needsVerification?.name
      );

      const requiredAmount = Number(Number(calculatedTotal || 0).toFixed(2));
      const amountMissing = scannedNumeric === null;
      const amountDoesNotMatch =
        scannedNumeric !== null &&
        Math.abs(scannedNumeric - requiredAmount) > 0.009;

      if (amountDoesNotMatch) {
        setOcrStatusTone("warning");
        setOcrStatus(
          `Receipt amount (₱${scannedNumeric.toFixed(
            2
          )}) does not match the Amount to Send (${formatCurrency(
            requiredAmount
          )}).`
        );
        setReceiptError(
          `Payment cannot be confirmed: Your receipt shows ${formatCurrency(
            scannedNumeric
          )}, but the exact Amount to Send is ${formatCurrency(
            requiredAmount
          )}. Please upload a receipt for ${formatCurrency(requiredAmount)}.`
        );
      } else if (amountMissing) {
        setOcrStatusTone("warning");
        setOcrStatus(
          `Could not verify the amount on this receipt. Amount to Send is ${formatCurrency(
            requiredAmount
          )}.`
        );
        setReceiptError(
          `Payment cannot be confirmed: Could not detect the amount on your receipt. Please upload a clear GCash receipt showing ${formatCurrency(
            requiredAmount
          )}.`
        );
      } else if (!detectedName && !detectedRef) {
        setOcrStatusTone("warning");
        setOcrStatus(
          `Could not confidently read GCash name or reference number${detailSuffix}. Please enter them manually.`
        );
      } else if (nameUncertain) {
        setOcrStatusTone("warning");
        setOcrStatus(
          `Please verify your GCash name. Some characters may be hidden in the receipt.${detailSuffix}`
        );
      } else if (!detectedRef) {
        setOcrStatusTone("warning");
        setOcrStatus(
          `Filled GCash name from receipt${detailSuffix}. Could not read reference number clearly—please enter it manually.`
        );
      } else {
        setOcrStatusTone("success");
        setOcrStatus(
          `Filled GCash name and reference number from receipt${detailSuffix}.`
        );
      }
    } catch (ocrError) {
      if (ocrRunIdRef.current !== runId) return;
      console.error("Receipt OCR failed:", ocrError);
      setOcrDetectedAmount(null);
      setOcrStatusTone("warning");
      setOcrStatus(
        "OCR could not read this image. Please upload a clear GCash receipt showing the exact Amount to Send."
      );
      setReceiptError(
        `Unable to verify receipt amount. Please upload a clear GCash receipt showing ${formatCurrency(
          calculatedTotal
        )}.`
      );
    } finally {
      if (ocrRunIdRef.current === runId) {
        setOcrProgress(0);
        setIsOcrRunning(false);
      }
    }
  };

  // =========================================================
  // CONFIRM PAYMENT
  // =========================================================

  const handleConfirmPayment = async () => {
    if (!booking) {
      setError(
        "You do not have a booking to pay."
      );
      return;
    }

    if (isSubmitting || isSubmittingRef.current) return;

    const isDraftBooking = Boolean(booking.isDraft);
    let bookingId = isDraftBooking
      ? draftCreatedBookingIdRef.current || ""
      : getBookingId(booking);

    // =====================================================
    // DUPLICATE PENDING PAYMENT
    // =====================================================

    if (!isDraftBooking && bookingId) {
      const paidPayment = payments.find(
        (payment) =>
          String(getBookingId(payment)) === String(bookingId) &&
          String(payment.paymentStatus || payment.status || "").toLowerCase() ===
            "paid"
      );

      if (paidPayment) {
        setError("This booking is already marked as paid.");
        return;
      }

      const duplicatePayment = payments.find(
        (payment) =>
          String(getBookingId(payment)) === String(bookingId) &&
          String(payment.paymentStatus || payment.status || "").toLowerCase() ===
            "pending"
      );

      if (duplicatePayment && editingPayment?.id !== duplicatePayment.id) {
        setError("This booking already has a pending payment.");
        return;
      }
    }

    // =====================================================
    // GCASH VALIDATION
    // =====================================================

    if (paymentMethod === "GCash") {
      const cleanName =
        gcashCustomerName.trim();

      const cleanReference =
        referenceNumber.trim();

      if (!cleanName) {
        setError(
          "Please enter your GCash account name."
        );
        return;
      }

      if (cleanName.length < 2) {
        setError(
          "Please enter a valid GCash account name."
        );
        return;
      }

      if (!cleanReference) {
        setError(
          "Please enter your GCash reference number."
        );
        return;
      }

      if (cleanReference.length < 6) {
        setError(
          "GCash reference number must contain at least 6 characters."
        );
        return;
      }

      if (isDuplicateReference) {
        setError(
          "Duplicate reference number — this GCash reference was already used for another payment. Please upload the receipt for your own payment."
        );
        return;
      }

      if (!receiptFile && !editingPayment?.receiptUrl) {
        setError(
          "Please upload your GCash payment receipt (JPG, PNG, or WEBP, max 2 MB)."
        );
        return;
      }

      if (isOcrRunning) {
        setError(
          "Please wait for the receipt scan to finish before confirming payment."
        );
        return;
      }

      if (receiptFile) {
        if (parsedOcrAmount === null) {
          setError(
            `Payment cannot be confirmed: Could not detect the amount on your receipt. Please upload a clear GCash receipt showing the exact Amount to Send (${formatCurrency(
              expectedAmountToSend
            )}).`
          );
          return;
        }

        if (Math.abs(parsedOcrAmount - expectedAmountToSend) > 0.009) {
          setError(
            `Payment cannot be confirmed: Your receipt amount (${formatCurrency(
              parsedOcrAmount
            )}) does not match the Amount to Send (${formatCurrency(
              expectedAmountToSend
            )}).`
          );
          return;
        }
      }

    }

    // =====================================================
    // START SUBMIT
    // =====================================================

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      if (!user?.uid) {
        throw new Error("You must be signed in to submit a payment.");
      }

      // =====================================================
      // DUPLICATE GCASH REFERENCE NUMBER
      // =====================================================

      if (paymentMethod === "GCash") {
        const reusedReference = await isReferenceAlreadyUsed(
          referenceNumber,
          editingPayment?.id
        );

        if (reusedReference) {
          throw new Error(
            "Duplicate reference number — this GCash reference was already used for another payment. Please upload the receipt for your own payment."
          );
        }
      }

      // Validate and compress GCash receipt BEFORE creating any Firestore records
      let receiptMeta = {};
      if (paymentMethod === "GCash" && receiptFile) {
        receiptMeta = await uploadPaymentReceipt({
          file: receiptFile,
          userId: user.uid,
          bookingId: bookingId || DRAFT_BOOKING_ID,
        });
      }

      // Create the booking in Firestore ONLY when Confirm Payment is clicked
      if (isDraftBooking && !bookingId) {
        const draftPayload = { ...booking };
        delete draftPayload.id;
        delete draftPayload.booking_id;
        delete draftPayload.isDraft;
        bookingId = await createBooking(user.uid, "", {
          ...draftPayload,
          total_amount: calculatedTotal,
          estimatedTotal: calculatedTotal,
          laundrySubtotal,
          deliveryFee: pickupFee,
          payment_method: paymentMethod,
          payment_status: "Pending",
          status: "Pending",
        });
        draftCreatedBookingIdRef.current = bookingId;
        setDraftCreatedBookingId(bookingId);
        clearStoredBookingDraft(user.uid);
      }

      const paymentDetails = {
        customer_name:
          user?.displayName ||
          user?.name ||
          booking.customer_name ||
          booking.customerName ||
          "Customer",
        gcash_customer_name:
          paymentMethod === "GCash"
            ? gcashCustomerName.trim()
            : "",
        reference_number:
          paymentMethod === "GCash"
            ? referenceNumber.trim()
            : "",
        services: bookingServices.join(", "),
        total_amount: calculatedTotal,
        ...receiptMeta,
      };

      let paymentId;
      if (editingPayment?.id) {
        await updateCustomerPayment(editingPayment.id, {
            amount: calculatedTotal,
            payment_method: paymentMethod,
            ...paymentDetails,
          });
        paymentId = editingPayment.id;
      } else {
        paymentId = await createPayment(
            bookingId,
            user.uid,
            calculatedTotal,
            paymentMethod,
            "Pending",
            paymentDetails
          );
      }

      if (isDraftBooking) {
        clearStoredBookingDraft(user.uid);
        setPendingBookingDraft(null);
        draftCreatedBookingIdRef.current = null;
        setDraftCreatedBookingId(null);
      }

      const paymentData = {
        id: paymentId,
        paymentId,
        bookingId,
        userId: user.uid,
        customerId: user.uid,
        customerName:
          user?.displayName ||
          user?.name ||
          booking.customer_name ||
          booking.customerName ||
          "Customer",
        gcashCustomerName: paymentDetails.gcash_customer_name,
        services: paymentDetails.services,
        totalAmount: calculatedTotal,
        amount: calculatedTotal,
        paymentMethod,
        paymentStatus: "Pending",
        status: "Pending",
        referenceNumber: paymentDetails.reference_number,
        createdAt:
          editingPayment?.createdAt ||
          new Date().toISOString(),
      };

      setPayments((currentPayments) =>
        [
          paymentData,
          ...currentPayments.filter((payment) => payment.id !== paymentId),
        ].sort(
          (a, b) =>
            getDateMilliseconds(b.createdAt) -
            getDateMilliseconds(a.createdAt)
        )
      );

      setSubmittedPayment(paymentData);
      setEditingPayment(null);
      setSuccessMessage(
        "Payment submitted successfully! It is pending staff verification."
      );
      clearReceiptSelection();

      window.dispatchEvent(new Event("laundrymatePaymentUpdated"));
      window.dispatchEvent(new Event("laundrymateBookingUpdated"));

      // Return to customer dashboard after successful submit/update
      navigate("/customer", {
        replace: true,
        state: {
          paymentNotice:
            "Payment submitted successfully! It is pending staff verification.",
        },
      });
    } catch (error) {
      console.error(
        "Payment submission error:",
        error
      );

      const code = String(error?.code || "");
      const message = String(error?.message || "");
      if (code.includes("permission") || message.toLowerCase().includes("permission")) {
        setError(
          "Payment was blocked by permissions. Please sign out, sign in again, then retry."
        );
      } else if (message) {
        setError(message);
      } else {
        setError(
          "Something went wrong while submitting your payment. Please try again."
        );
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // =========================================================
  // CANCEL EDIT
  // =========================================================

  const handleCancelEdit = () => {
    setEditingPayment(null);

    setPaymentMethod("GCash");

    setGcashCustomerName("");

    setReferenceNumber("");
    scheduleReferenceCheck("");

    setError("");
  };

  // =========================================================
  // DONE
  // =========================================================

  const handleDone = () => {
    setShowPaymentSummary(false);
    setSubmittedPayment(null);
    clearReceiptSelection();
    navigate("/customer", {
      replace: true,
      state: {
        paymentNotice:
          "Payment submitted successfully! It is pending staff verification.",
      },
    });
  };

  // =========================================================
  // NO BOOKING
  // =========================================================

  const selectedPaymentStatus = useMemo(() => {
    if (!booking) return "";
    const bookingId = getBookingId(booking);
    const related = payments.find(
      (payment) => String(getBookingId(payment)) === String(bookingId)
    );
    return String(
      related?.paymentStatus ||
        related?.status ||
        booking.payment_status ||
        ""
    );
  }, [booking, payments]);

  const isSelectedBookingPaid =
    selectedPaymentStatus.toLowerCase() === "paid";

  if (!selectableBookings.length || !booking) {
    return (
      <div className="payments-page">

        <div className="payments-header">
          <div>
            <span className="page-label">
              CUSTOMER PORTAL
            </span>

            <h1>Payments</h1>

            <p>
              Manage your laundry payments
              in one place.
            </p>
          </div>
        </div>

        <div className="empty-payment-card">

          <div className="empty-payment-icon">
            💳
          </div>

          <h2>
            No Confirmed Booking
          </h2>

          <p>
            You need to create a booking
            before making a payment.
          </p>

        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="payments-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="payments-header">

        <div>

          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>
            Payments
          </h1>

          <p>
            Review your booking and
            complete your payment.
          </p>

        </div>

        <div className="booking-picker">
          <label htmlFor="bookingPicker">Select booking</label>
          <select
            id="bookingPicker"
            value={selectedBookingId}
            onChange={(event) => {
              const nextId = event.target.value;
              selectedBookingIdRef.current = nextId;
              setSelectedBookingId(nextId);
              syncPaymentFormForSelection(nextId, selectableBookings, payments);
            }}
          >
            {selectableBookings.map((item) => {
              const id = getBookingId(item);
              return (
                <option key={id} value={id}>
                  {item.isDraft
                    ? "New Booking (Draft) · Confirm Payment to Submit"
                    : `#${formatShortBookingId(id)} · ${item.status || "Pending"} · ${item.payment_status || "Unpaid"}`}
                </option>
              );
            })}
          </select>
        </div>

      </div>

      {isSelectedBookingPaid && (
        <div className="payment-success-alert">
          <span>✓</span>
          <div>
            <strong>This booking is already paid.</strong>
            <p>Select another booking if you still need to submit a payment.</p>
          </div>
        </div>
      )}

      {/* =====================================================
          SUCCESS ALERT
      ===================================================== */}

      {successMessage && (
        <div className="payment-success-alert">

          <span>✓</span>

          <div>
            <strong>
              {successMessage}
            </strong>

            <p>
              Your payment is now pending
              verification by the laundry
              staff.
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          EDIT MODE
      ===================================================== */}

      {editingPayment && (
        <div className="edit-payment-alert">

          <div>
            <strong>
              Editing Pending Payment
            </strong>

            <p>
              Update your payment details
              and confirm again.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleCancelEdit
            }
            className="cancel-edit-btn"
          >
            Cancel
          </button>

        </div>
      )}

      {/* =====================================================
          MAIN GRID
      ===================================================== */}

      <div className="payment-main-grid">

        {/* ===================================================
            BOOKING SUMMARY
        =================================================== */}

        <div className="payment-card booking-summary-card">

          <div className="payment-card-header">

            <div>

              <span className="card-label">
                CURRENT BOOKING
              </span>

              <h2>
                Booking Summary
              </h2>

            </div>

            <span className="booking-status">
              {booking.status ||
                "Pending"}
            </span>

          </div>

          {/* BOOKING ID */}

          <div className="booking-id-box">

            <span>
              Booking ID
            </span>

            <strong
              title={
                booking.isDraft
                  ? draftCreatedBookingId
                    ? `#${getBookingId(draftCreatedBookingId)}`
                    : "A unique Booking ID will be generated when you confirm payment"
                  : `#${getBookingId(booking)}`
              }
            >
              {booking.isDraft
                ? draftCreatedBookingId
                  ? `#${formatShortBookingId(draftCreatedBookingId)}`
                  : "Assigned on confirm"
                : `#${formatShortBookingId(booking)}`}
            </strong>

          </div>

          {/* SERVICES */}

          <div className="summary-group">

            <span className="summary-label">
              Laundry Services
            </span>

            <div className="service-list">

              {bookingServices.length >
              0 ? (
                bookingServices.map(
                  (
                    service,
                    index
                  ) => (
                    <div
                      key={`${service}-${index}`}
                      className="service-row"
                    >

                      <span>
                        {service}
                      </span>

                      <strong>
                        {formatCurrency(
                          getServicePrice(
                            service
                          )
                        )}
                        {Number(
                          booking.weight
                        ) > 0
                          ? "/kg"
                          : ""}
                      </strong>

                    </div>
                  )
                )
              ) : (
                <span>
                  No service information
                </span>
              )}

            </div>

          </div>

          {/* SCHEDULE */}

          <div className="summary-info-grid">

            <div className="summary-info-item">

              <span>
                📅 Pickup Schedule
              </span>

              <strong>
                {getBookingSchedule()}
              </strong>

            </div>

            <div className="summary-info-item">

              <span>
                🚚 Pickup Option
              </span>

              <strong>
                {booking.pickupType ||
                  booking.pickupOption ||
                  booking.deliveryType ||
                  "Pickup & Delivery"}
              </strong>

            </div>

          </div>

          {/* ADDRESS */}

          <div className="summary-address">

            <span className="summary-label">
              Pickup Address
            </span>

            <strong>
              {getAddress()}
            </strong>

            <p>
              {getBarangay()}
              {getBarangay() !== "—" &&
                ", "}
              {getCity()}
              {getCity() !== "—" &&
                ", "}
              {getProvince()}
            </p>

            {getLandmark() !==
              "—" && (
              <small>
                📍 Landmark:{" "}
                {getLandmark()}
              </small>
            )}

          </div>

          {/* PRICE BREAKDOWN */}

          <div className="payment-price-breakdown">

            <div>
              <span>
                Laundry Services
              </span>

              <strong>
                {formatCurrency(
                  laundrySubtotal
                )}
              </strong>
            </div>

            <div>
              <span>
                {booking.pickupType ===
                "Pickup Only"
                  ? "Pickup Fee"
                  : "Pickup & Delivery Fee"}
              </span>

              <strong>
                {formatCurrency(
                  pickupFee
                )}
              </strong>
            </div>

          </div>

          {/* TOTAL */}

          <div className="booking-total-box">

            <div>

              <span>
                Total Amount
              </span>

              <small>
                Final amount for this
                booking
              </small>

            </div>

            <strong>
              {formatCurrency(
                calculatedTotal
              )}
            </strong>

          </div>

        </div>

        {/* ===================================================
            PAYMENT FORM
        =================================================== */}

        <div className="payment-card payment-form-card">

          <div className="payment-card-header">

            <div>

              <span className="card-label">
                PAYMENT
              </span>

              <h2>
                Payment Method
              </h2>

            </div>

          </div>

          {/* PAYMENT OPTIONS */}

          <div className="payment-methods">

            <button
              type="button"
              className={`payment-method ${
                paymentMethod ===
                "GCash"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handlePaymentMethodChange(
                  "GCash"
                )
              }
            >

              <span className="method-icon">
                G
              </span>

              <span>

                <strong>
                  GCash
                </strong>

                <small>
                  Online payment
                </small>

              </span>

              <span className="radio-circle">
                {paymentMethod ===
                  "GCash" &&
                  "✓"}
              </span>

            </button>

            <button
              type="button"
              className={`payment-method ${
                paymentMethod ===
                "Cash"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handlePaymentMethodChange(
                  "Cash"
                )
              }
            >

              <span className="method-icon cash-icon">
                ₱
              </span>

              <span>

                <strong>
                  Cash
                </strong>

                <small>
                  Pay upon pickup
                </small>

              </span>

              <span className="radio-circle">
                {paymentMethod ===
                  "Cash" &&
                  "✓"}
              </span>

            </button>

          </div>

          {/* =================================================
              GCASH
          ================================================= */}

          {paymentMethod ===
            "GCash" && (
            <div className="gcash-payment-box">

              <div className="gcash-header">

                <div>

                  <h3>
                    Pay using GCash
                  </h3>

                  <p>
                    Scan the QR code,
                    send the exact amount,
                    then enter your payment
                    details.
                  </p>

                </div>

              </div>

              <div className="gcash-content">

                {/* QR */}

                <div className="gcash-qr-wrapper">
                  {gcashQr ? (
                    <>
                      <button
                        type="button"
                        className="gcash-qr-toggle"
                        onClick={() => setQrMaximized(true)}
                        aria-label="Maximize GCash QR"
                        title="Maximize"
                      >
                        <Maximize2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="gcash-qr-hit"
                        onClick={() => setQrMaximized(true)}
                        aria-label="Maximize GCash QR image"
                      >
                        <img
                          src={gcashQr}
                          alt="Prince-Tyler Laundry Shop GCash QR"
                          className="gcash-qr"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            const fallback =
                              event.currentTarget
                                .closest(".gcash-qr-wrapper")
                                ?.querySelector(".gcash-qr-fallback");
                            if (fallback) {
                              fallback.style.display = "flex";
                            }
                          }}
                        />
                      </button>
                    </>
                  ) : null}

                  <div
                    className="gcash-qr-fallback"
                    style={{
                      display: gcashQr ? "none" : "flex",
                    }}
                  >
                    <span>QR</span>
                    <small>GCash QR unavailable</small>
                  </div>
                </div>

                {qrMaximized && gcashQr ? (
                  <div
                    className="gcash-qr-lightbox"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Maximized GCash QR"
                    onClick={() => setQrMaximized(false)}
                  >
                    <div
                      className="gcash-qr-lightbox-panel"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="gcash-qr-lightbox-toolbar">
                        <span>GCash QR</span>
                        <div className="gcash-qr-lightbox-actions">
                          <button
                            type="button"
                            className="gcash-qr-toggle"
                            onClick={() => setQrMaximized(false)}
                            aria-label="Minimize GCash QR"
                            title="Minimize"
                          >
                            <Minimize2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="gcash-qr-toggle"
                            onClick={() => setQrMaximized(false)}
                            aria-label="Close maximized GCash QR"
                            title="Close"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <img
                        src={gcashQr}
                        alt="Maximized Prince-Tyler Laundry Shop GCash QR"
                        className="gcash-qr-lightbox-image"
                      />
                    </div>
                  </div>
                ) : null}

                {/* SHOP DETAILS */}

                <div className="gcash-details">

                  <div>

                    <span>
                      Account Name
                    </span>

                    <strong>
                      {gcashName}
                    </strong>

                  </div>

                  {gcashNumber && (
                    <div>

                      <span>
                        GCash Number
                      </span>

                      <strong>
                        {gcashNumber}
                      </strong>

                    </div>
                  )}

                  <div>

                    <span>
                      Amount to Send
                    </span>

                    <strong>
                      {formatCurrency(
                        calculatedTotal
                      )}
                    </strong>

                  </div>

                </div>

              </div>

              {/* RECEIPT FIRST — OCR fills name + reference below */}

              <div className="form-group">
                <label htmlFor="paymentReceipt">
                  Payment Receipt Screenshot
                  <span>*</span>
                </label>

                <input
                  id="paymentReceipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleReceiptChange}
                />

                <small>
                  Upload a clear JPG, PNG, or WEBP screenshot of your GCash receipt (max 2 MB).
                  OCR will auto-fill your GCash name and reference number below.
                </small>

                {ocrStatus && (
                  <div
                    className={
                      "receipt-ocr-status" +
                      (ocrStatusTone === "warning"
                        ? " is-warning"
                        : ocrStatusTone === "success"
                          ? " is-success"
                          : "")
                    }
                    role="status"
                  >
                    <p>{ocrStatus}</p>
                    {ocrProgress > 0 && ocrProgress < 100 && (
                      <div className="receipt-ocr-bar">
                        <span style={{ width: `${ocrProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}

                {receiptError && (
                  <p className="receipt-error" role="alert">
                    {receiptError}
                  </p>
                )}

                {receiptPreview && (
                  <div className="receipt-preview">
                    <img
                      src={receiptPreview}
                      alt="Selected GCash receipt preview"
                    />
                    <button
                      type="button"
                      className="receipt-remove-btn"
                      onClick={() => {
                        clearReceiptSelection();
                        const input = document.getElementById("paymentReceipt");
                        if (input) input.value = "";
                      }}
                    >
                      Remove file
                    </button>
                  </div>
                )}
              </div>

              {/* CUSTOMER GCASH NAME (auto-filled by OCR) */}

              <div className="form-group">

                <label htmlFor="gcashCustomerName">
                  Your GCash Name
                  <span>*</span>
                </label>

                <input
                  id="gcashCustomerName"
                  type="text"
                  value={
                    gcashCustomerName
                  }
                  onChange={
                    handleGcashCustomerNameChange
                  }
                  placeholder="Enter the name on your GCash account"
                  maxLength={50}
                />

                <small>
                  Auto-filled from your receipt when possible. Check and edit if needed.
                </small>

              </div>

              {/* REFERENCE NUMBER (auto-filled by OCR) */}

              <div className="form-group">

                <label htmlFor="referenceNumber">
                  GCash Reference Number
                  <span>*</span>
                </label>

                <input
                  id="referenceNumber"
                  type="text"
                  value={
                    referenceNumber
                  }
                  onChange={
                    handleReferenceChange
                  }
                  placeholder="Enter your GCash reference number"
                  maxLength={30}
                />

                {isDuplicateReference && (
                  <p className="receipt-error" role="alert">
                    Duplicate reference number — this GCash reference was
                    already used for another payment.
                  </p>
                )}

                <small>
                  Auto-filled from your receipt when possible. Check and edit if needed.
                </small>

              </div>

            </div>
          )}

          {/* =================================================
              CASH
          ================================================= */}

          {paymentMethod ===
            "Cash" && (
            <div className="cash-payment-box">

              <div className="cash-icon-large">
                ₱
              </div>

              <div>

                <h3>
                  Cash Payment
                </h3>

                <p>
                  You selected cash payment.
                  Please prepare the exact
                  amount when your laundry is
                  picked up or delivered.
                </p>

                <strong>
                  Amount to prepare:{" "}
                  {formatCurrency(
                    calculatedTotal
                  )}
                </strong>

              </div>

            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="payment-error">

              <span>!</span>

              <p>
                {error}
              </p>

            </div>
          )}

          {/* TOTAL */}

          <div className="payment-total">

            <span>
              Amount to Pay
            </span>

            <strong>
              {formatCurrency(
                calculatedTotal
              )}
            </strong>

          </div>

          {/* CONFIRM */}

          <button
            type="button"
            className="confirm-payment-btn"
            onClick={
              handleConfirmPayment
            }
            disabled={
              isSubmitting ||
              isOcrRunning ||
              isSelectedBookingPaid ||
              isDuplicateReference ||
              !booking ||
              isReceiptAmountMismatched
            }
          >

            {isSubmitting ? (
              <>
                <span className="spinner" />
                Submitting...
              </>
            ) : isSelectedBookingPaid ? (
              "Already Paid"
            ) : editingPayment ? (
              String(editingPayment.paymentStatus || "").toLowerCase() ===
              "rejected"
                ? "Resubmit Payment"
                : "Update Payment"
            ) : (
              "Confirm Payment"
            )}

          </button>

          <p className="payment-note">
            Your payment will be marked as
            <strong>
              {" "}
              Pending
            </strong>{" "}
            until it is verified by the
            laundry staff.
          </p>

        </div>

      </div>

      {/* =====================================================
          PAYMENT SUMMARY MODAL
      ===================================================== */}

      {showPaymentSummary &&
        submittedPayment && (
          <div className="payment-modal-overlay">

            <div className="payment-summary-modal">

              {/* SUCCESS ICON */}

              <div className="submitted-icon">
                ✓
              </div>

              <h2>
                Payment Submitted!
              </h2>

              <p className="submitted-message">
                Your booking payment has
                been successfully recorded.
                It is now pending verification.
              </p>

              {/* STATUS */}

              <div className="submitted-status">

                <span>
                  Payment Status
                </span>

                <strong>
                  Pending
                </strong>

              </div>

              {/* DETAILS */}

              <div className="submitted-details">

                <div>

                  <span>
                    Booking ID
                  </span>

                  <strong title={`#${getBookingId(submittedPayment.bookingId)}`}>
                    #{formatShortBookingId(submittedPayment.bookingId)}
                  </strong>

                </div>

                <div>

                  <span>
                    Payment ID
                  </span>

                  <strong>
                    {
                      submittedPayment.paymentId
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Payment Method
                  </span>

                  <strong>
                    {
                      submittedPayment.paymentMethod
                    }
                  </strong>

                </div>

                {submittedPayment.gcashCustomerName && (
                  <div>

                    <span>
                      GCash Name
                    </span>

                    <strong>
                      {
                        submittedPayment.gcashCustomerName
                      }
                    </strong>

                  </div>
                )}

                {submittedPayment.referenceNumber && (
                  <div>

                    <span>
                      GCash Reference
                    </span>

                    <strong>
                      {
                        submittedPayment.referenceNumber
                      }
                    </strong>

                  </div>
                )}

                <div>

                  <span>
                    Pickup Schedule
                  </span>

                  <strong>
                    {getBookingSchedule()}
                  </strong>

                </div>

                <div>

                  <span>
                    Services
                  </span>

                  <strong>
                    {
                      submittedPayment.services
                    }
                  </strong>

                </div>

              </div>

              {/* TOTAL */}

              <div className="submitted-total">

                <span>
                  Total Amount
                </span>

                <strong>
                  {formatCurrency(
                    submittedPayment.totalAmount
                  )}
                </strong>

              </div>

              {/* DONE */}

              <button
                type="button"
                className="done-payment-btn"
                onClick={
                  handleDone
                }
              >
                Done
              </button>

            </div>

          </div>
        )}

    </div>
  );
}

export default Payment;