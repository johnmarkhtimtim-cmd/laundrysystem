import { createWorker } from "tesseract.js";

/**
 * Browser OCR for common GCash receipt screenshots:
 * Send Money, Pay QR, Express Send, InstaPay-style confirmations.
 *
 * Extracts:
 * - masked/unmasked name on the receipt
 * - Ref No. / Reference Number (with or without spaces)
 */

function normalizeOcrNoise(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[●•·▪◦〇◎◉]/g, "*")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Common OCR label misreads
    .replace(/\bRef\s*No\b/gi, "Ref No")
    .replace(/\bReference\s*No\b/gi, "Reference No")
    .replace(/\bReference\s*Number\b/gi, "Reference Number");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatMaskedName(start, middle, end, rest = "") {
  return (
    String(start).toUpperCase() +
    "*".repeat(String(middle).length) +
    String(end).toUpperCase() +
    String(rest || "").replace(/[a-z]/g, (ch) => ch.toUpperCase())
  );
}

/**
 * Normalize GCash privacy-masked names across formats:
 * RO●●●D G. | ROeeeD G. | RO***D GC. | J***n D. | M****** S
 *
 * GCash masks names as:
 * - First name: 1–3 visible letters + bullet mask + 0–1 trailing letter
 * - Last name initial(s): single letter + dot (e.g. "G."), where Tesseract often
 *   misreads "G." or "G ." as "GC.", "G0.", "G,", "G:", etc.
 */
function normalizeLastInitialSuffix(rest = "") {
  const trimmed = String(rest || "").trim();
  if (!trimmed) return "";

  const tokens = trimmed
    .split(/\s+/)
    .map((token) => {
      // Single letter with optional dot: "G" or "G." -> "G."
      if (/^[A-Za-z]\.?$/.test(token)) {
        return `${token[0].toUpperCase()}.`;
      }
      // Common OCR misread of "<Initial>." where the period or antialiasing
      // turns into a second character + dot (e.g. "GC.", "GO.", "G0.", "Co.")
      if (/^[A-Za-z][CcOo0.,;:'`]\.?$/.test(token)) {
        return `${token[0].toUpperCase()}.`;
      }
      // Two uppercase letters followed by a dot on a masked GCash name (e.g. "GC.")
      // GCash only shows a 1-letter surname initial with a period.
      if (/^[A-Za-z]{2}\.$/.test(token)) {
        return `${token[0].toUpperCase()}.`;
      }
      return token.toUpperCase();
    })
    .filter(Boolean);

  return tokens.length ? ` ${tokens.join(" ")}` : "";
}

function normalizeMaskedGcashName(name) {
  const value = String(name || "")
    .trim()
    .replace(/\s+\.$/, ".");
  if (!value) return value;

  // Already contains asterisks from bullet normalization or OCR:
  // e.g. "RO***D GC." or "RO***D G." or "RO****D G."
  const directMasked = value.match(
    /^([A-Za-z]{1,4})(\*{2,12})([A-Za-z]{0,2})(\s+.+)?$/
  );
  if (directMasked) {
    const [, start, stars, end, rest = ""] = directMasked;
    // Standard GCash Send Money mask uses 3–5 bullets; clamp noisy star counts
    const starCount = Math.max(3, Math.min(stars.length, 6));
    return (
      start.toUpperCase() +
      "*".repeat(starCount) +
      end.toUpperCase() +
      normalizeLastInitialSuffix(rest)
    );
  }

  // Try common visible-prefix lengths when bullets were misread as e/o/a/c/0/etc.
  const prefixLengths = [2, 3, 1];
  for (const prefixLen of prefixLengths) {
    const pattern = new RegExp(
      `^([A-Za-z]{${prefixLen}})([eoacsuEOACSU0-9.*]{2,10})([A-Za-z]{1,2})(\\s+[A-Za-z0-9.,;:'\`]{1,4})?$`
    );
    const match = value.match(pattern);
    if (match) {
      return formatMaskedName(
        match[1],
        match[2],
        match[3],
        normalizeLastInitialSuffix(match[4] || "")
      );
    }
  }

  // Prefix + mask + last-name initial only: M****** S.
  for (const prefixLen of prefixLengths) {
    const pattern = new RegExp(
      `^([A-Za-z]{${prefixLen}})([eoacsuEOACSU0-9.*]{2,12})(\\s+[A-Za-z0-9.,;:'\`]{1,4})?$`
    );
    const match = value.match(pattern);
    if (match) {
      return (
        String(match[1]).toUpperCase() +
        "*".repeat(String(match[2]).length) +
        normalizeLastInitialSuffix(match[3] || "")
      );
    }
  }

  // In-string repair for noisy OCR lines
  return value.replace(
    /\b([A-Za-z]{2})([eoacsuEOACSU0-9*]{2,8})([A-Za-z]{1,2})(\s+[A-Za-z]{1,2}\.?)?\b/g,
    (full, start, middle, end, rest = "") => {
      if (!/^[eoacsuEOACSU0-9*]+$/.test(middle)) return full;
      return formatMaskedName(
        start,
        middle,
        end,
        normalizeLastInitialSuffix(rest)
      );
    }
  );
}

function cleanupName(value) {
  const name = String(value || "")
    .replace(/[●•·▪◦〇◎◉]/g, "*")
    .replace(/[^A-Za-z0-9 .*'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\-*'\s]+/, "");

  return normalizeMaskedGcashName(name).slice(0, 50);
}

function isJunkNameLine(line) {
  const value = String(line || "").trim();
  if (!value) return true;

  const junk = [
    /sent\s*via\s*gcash/i,
    /paid\s*via\s*gcash/i,
    /express\s*send/i,
    /pay\s*qr/i,
    /pay\s*bills/i,
    /buy\s*load/i,
    /instapay/i,
    /total\s*amount/i,
    /^amount\b/i,
    /convenience\s*fee/i,
    /ref(?:erence)?\s*(?:no|number|#)?/i,
    /carbon|footprint|digital|gco2e/i,
    /successful|success|completed|confirmed/i,
    /transaction\s*(details|successful)?/i,
    /you\s*have\s*sent/i,
    /payment\s*successful/i,
    /^php\b|^₱/i,
    /^\+?\d/,
    /^\d+([.,]\d+)?$/,
    /^gcash$/i,
    /^date\b/i,
    /^time\b/i,
  ];

  return junk.some((pattern) => pattern.test(value));
}

function looksLikePersonName(line) {
  const value = cleanupName(line);
  if (value.length < 3 || value.length > 50) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/^\d/.test(value)) return false;

  // Masked GCash names
  if (/^[A-Za-z]{1,4}\*{2,}[A-Za-z0-9 .*'-]*$/i.test(value)) return true;
  if (/^[A-Za-z]{1,4}\*{2,}$/i.test(value)) return true;

  // Normal personal / shop names
  if (/^[A-Za-z][A-Za-z* .'-]{1,40}\.?$/.test(value)) return true;
  if (/^[A-Za-z]+(?:\s+[A-Za-z*.]+){0,5}\.?$/.test(value)) return true;
  return false;
}

function extractReferenceNumber(compactText) {
  const compact = String(compactText || "");

  const labeledPatterns = [
    /ref(?:erence)?\s*\.?\s*no\.?\s*[:.\-]?\s*([0-9][0-9\s-]{8,40})/i,
    /ref(?:erence)?\s*(?:number|#)\s*[:.\-]?\s*([0-9][0-9\s-]{8,40})/i,
    /(?:transaction|trans)\s*(?:no|id|#|number)\.?\s*[:.\-]?\s*([0-9][0-9\s-]{8,40})/i,
    /(?:trace|confirmation)\s*(?:no|id|#|number)?\.?\s*[:.\-]?\s*([0-9][0-9\s-]{8,40})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = compact.match(pattern);
    if (!match?.[1]) continue;
    const digits = digitsOnly(match[1]);
    if (digits.length >= 10 && digits.length <= 16) {
      return digits;
    }
  }

  // Spaced groups commonly used by GCash: 1047 517 297170 / 6028 871 884223
  const spacedGroups = compact.match(/\b\d{3,5}(?:[\s-]+\d{2,7}){1,5}\b/g) || [];
  let best = "";
  for (const group of spacedGroups) {
    const digits = digitsOnly(group);
    if (digits.length >= 10 && digits.length <= 16 && digits.length >= best.length) {
      best = digits;
    }
  }
  if (best) return best;

  // Continuous 10–16 digit run (prefer 12–13)
  const plains = compact.match(/\b\d{10,16}\b/g) || [];
  if (plains.length) {
    const preferred =
      plains.find((item) => item.length === 13) ||
      plains.find((item) => item.length === 12) ||
      plains.sort((a, b) => b.length - a.length)[0];
    return preferred || "";
  }

  return "";
}

function extractNameFromLines(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const landmarkPatterns = [
    /sent\s*via\s*gcash/i,
    /paid\s*via\s*gcash/i,
    /express\s*send/i,
  ];

  // 1) Name above "Sent via GCash" / similar landmarks (skip phone line)
  for (let i = 0; i < list.length; i += 1) {
    if (!landmarkPatterns.some((pattern) => pattern.test(list[i]))) continue;
    for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
      const line = list[j];
      if (isJunkNameLine(line)) continue;
      if (/\+63|9\d{2}/.test(line) && !/[A-Za-z]{2,}/.test(line)) continue;
      if (looksLikePersonName(line)) return cleanupName(line);
    }
  }

  // 2) Labeled recipient / sender lines
  const labelPatterns = [
    /^(?:sent\s*to|to|recipient|receiver)\s*[:.\-]?\s*(.+)$/i,
    /^(?:from|sender|paid\s*by|account\s*name|gcash\s*name|name)\s*[:.\-]?\s*(.+)$/i,
  ];
  for (let i = 0; i < list.length; i += 1) {
    for (const pattern of labelPatterns) {
      const match = list[i].match(pattern);
      if (match?.[1] && looksLikePersonName(match[1])) {
        return cleanupName(match[1]);
      }
      if (pattern.test(list[i]) && !match?.[1] && looksLikePersonName(list[i + 1] || "")) {
        return cleanupName(list[i + 1]);
      }
    }
  }

  // 3) Name just above a +63 / masked phone line
  for (let i = 0; i < list.length; i += 1) {
    if (!/(\+63|9[*•\d]{6,})/i.test(list[i])) continue;
    for (let j = i - 1; j >= Math.max(0, i - 2); j -= 1) {
      if (isJunkNameLine(list[j])) continue;
      if (looksLikePersonName(list[j])) return cleanupName(list[j]);
    }
  }

  // 4) First plausible name in the upper part of the receipt
  const topLines = list.slice(0, Math.min(list.length, 16));
  for (const line of topLines) {
    if (isJunkNameLine(line)) continue;
    if (looksLikePersonName(line)) return cleanupName(line);
  }

  return "";
}

/**
 * Parse GCash / InstaPay receipt OCR text into name + reference number.
 */
export function parseGcashReceiptText(rawText = "") {
  const text = normalizeOcrNoise(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const compact = lines.join(" ").replace(/\s+/g, " ");

  return {
    gcashCustomerName: extractNameFromLines(lines),
    referenceNumber: extractReferenceNumber(compact),
    rawText: text,
  };
}

/**
 * Upscale + contrast so small / compressed receipt screenshots OCR more reliably.
 */
async function preprocessReceiptImage(file) {
  const bitmap = await createImageBitmap(file);
  const minEdge = 1700;
  const scale = Math.max(
    2,
    minEdge / Math.min(bitmap.width, bitmap.height)
  );

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close?.();
    return file;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const contrast = 1.4;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let value = gray * contrast + intercept;
    value = Math.max(0, Math.min(255, value));
    if (value > 195) value = 255;
    else if (value < 75) value = 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function mergeParsed(primary, secondary) {
  return {
    gcashCustomerName:
      primary.gcashCustomerName || secondary.gcashCustomerName || "",
    referenceNumber:
      primary.referenceNumber || secondary.referenceNumber || "",
    rawText: [primary.rawText, secondary.rawText].filter(Boolean).join("\n---\n"),
  };
}

/**
 * Run browser OCR on a receipt image File/Blob.
 */
export async function extractGcashReceiptFields(file, onProgress) {
  const report = (pct) => {
    if (typeof onProgress === "function") onProgress(pct);
  };

  report(4);
  const prepared = await preprocessReceiptImage(file);
  report(10);

  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message?.status === "recognizing text") {
        const pct = 10 + Math.round((Number(message.progress) || 0) * 75);
        report(Math.min(92, pct));
      }
    },
  });

  try {
    // Pass 1: general receipt layout
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
    });
    const first = await worker.recognize(prepared);
    let parsed = parseGcashReceiptText(first?.data?.text || "");

    // Pass 2: alternate segmentation if anything missing
    if (!parsed.referenceNumber || !parsed.gcashCustomerName) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "4",
      });
      const second = await worker.recognize(prepared);
      parsed = mergeParsed(
        parsed,
        parseGcashReceiptText(second?.data?.text || "")
      );
    }

    // Pass 3: digit-focused pass for stubborn Ref No.
    if (!parsed.referenceNumber) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz. #-:",
        tessedit_pageseg_mode: "6",
      });
      const third = await worker.recognize(prepared);
      parsed = mergeParsed(
        parsed,
        parseGcashReceiptText(third?.data?.text || "")
      );
    }

    report(100);
    return parsed;
  } finally {
    await worker.terminate();
  }
}
