import { createWorker } from "tesseract.js";

/**
 * Browser OCR for GCash receipt screenshots:
 * Send Money, Pay QR, Express Send, InstaPay-style confirmations.
 *
 * Pipeline:
 * 1. Preprocess full receipt (EXIF orientation, upscale, grayscale, denoise, contrast, Otsu).
 * 2. Run Pass 1 on full receipt (extract Ref No., Amount, Date/Time, and locate Sender Name bbox).
 * 3. Crop the Sender Name region separately and run connected-component visual bullet detection.
 * 4. If masking bullets (•) are detected visually, erase the bullet blobs before running a
 *    dedicated PSM-7 sender-name OCR pass so Tesseract never hallucinates letters (e.g. JOeN MASK T.),
 *    then re-insert "•" at the exact visual bullet positions (e.g. JO•N MA•K T.).
 * 5. Validate and flag masked/ambiguous names without ever guessing hidden characters.
 */

const IS_DEV = Boolean(import.meta.env?.DEV);

const BULLET_CHARS_REGEX = /[●•·▪◦〇◎◉∙․‧*]/g;
const INLINE_DOT_REGEX = /([A-Za-z])\.+(?=[A-Za-z])/g;
const ALL_CAPS_MISREAD_BULLET_REGEX = /\b([A-Z]{2,})([eocsa]{1,6})([A-Z]{1,3})\b/g;

function devLog(label, payload) {
  if (!IS_DEV) return;
  console.debug(`[GCash OCR] ${label}:`, payload);
}

function normalizeLineText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bRef\s*\.?\s*No\b/gi, "Ref No")
    .replace(/\bReference\s*No\b/gi, "Reference No")
    .replace(/\bReference\s*Number\b/gi, "Reference Number");
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Dedicated GCash sender-name cleaner & validator.
 *
 * Rules:
 * - Preserves masking bullets (•) without inventing or guessing hidden letters.
 * - Flags ambiguous inline periods (e.g., "JO.N MA.K T.") and suspicious substitutions
 *   (e.g., lowercase letter sandwiched inside an ALL-CAPS word like "JOeN").
 * - Preserves legitimate spaces and legitimate name initials with periods ("T.", "D.", "J.R.").
 */
export function cleanGcashName(rawValue, options = {}) {
  const { visualBulletsDetected = 0 } = options;
  const reasons = [];

  let text = String(rawValue || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return {
      name: "",
      hasMaskedCharacters: visualBulletsDetected > 0,
      hasAmbiguousCharacters: false,
      isUncertain: true,
      shouldAutofill: false,
      reasons: ["No sender name text recognized"],
    };
  }

  // Normalize various bullet glyphs to standard Unicode bullet "•" (never guess letters)
  let hasMaskedCharacters =
    visualBulletsDetected > 0 || BULLET_CHARS_REGEX.test(text);
  BULLET_CHARS_REGEX.lastIndex = 0;

  if (visualBulletsDetected > 0) {
    reasons.push(
      `Detected ${visualBulletsDetected} visual masking bullet(s) in sender name`
    );
  }

  text = text
    .replace(BULLET_CHARS_REGEX, "•")
    .replace(/^[^A-Za-z•]+/, "")
    .replace(/[^A-Za-z0-9\s.•'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Collapse accidental spaces immediately around a masking bullet inside a token (e.g., "JO • N" -> "JO•N")
  text = text.replace(/([A-Za-z])\s*(•+)\s*([A-Za-z])/g, "$1$2$3");

  let hasAmbiguousCharacters = false;
  let hasSuspiciousSubstitution = false;

  const rawTokens = text.split(/\s+/).filter(Boolean);
  const cleanedTokens = [];

  for (const rawToken of rawTokens) {
    let token = rawToken;

    // Pure punctuation token (e.g., stray ".")
    if (/^[.'-]+$/.test(token)) {
      hasAmbiguousCharacters = true;
      reasons.push(`Removed stray punctuation token "${rawToken}"`);
      continue;
    }

    // Preserve legitimate double-initial tokens like "J.R."
    if (/^[A-Za-z]\.[A-Za-z]\.$/.test(token)) {
      cleanedTokens.push(token.toUpperCase());
      continue;
    }

    // Preserve legitimate single-letter initial like "D." or "T."
    if (/^[A-Za-z]\.?$/.test(token)) {
      const letter = token[0].toUpperCase();
      cleanedTokens.push(token.endsWith(".") ? `${letter}.` : letter);
      continue;
    }

    // Detect bullet masking inside token (e.g., "JO•N", "MA•K", "RO•••D") -> preserve "•"
    if (token.includes("•")) {
      hasMaskedCharacters = true;
      if (!reasons.some((r) => r.includes("masking bullet"))) {
        reasons.push(`Preserved masking bullet(s) in "${token}"`);
      }
      // Strip stray digits inside masked name token while preserving "•"
      token = token.replace(/\d+/g, "");
      if (token) cleanedTokens.push(token);
      continue;
    }

    // Detect ambiguous inline period between alphabetic characters (e.g., "JO.N", "MA.K")
    // Do NOT guess the hidden letter and do NOT blindly delete periods!
    if (INLINE_DOT_REGEX.test(token)) {
      INLINE_DOT_REGEX.lastIndex = 0;
      hasAmbiguousCharacters = true;
      reasons.push(
        `Ambiguous period between alphabetic characters in "${token}"`
      );
      cleanedTokens.push(token);
      continue;
    }

    // Detect suspicious OCR substitution: lowercase e/o/c/s/a sandwiched inside ALL-CAPS token
    // (e.g., "JOeN", "ROeeeD") caused by Tesseract misreading a masking bullet.
    if (ALL_CAPS_MISREAD_BULLET_REGEX.test(token)) {
      ALL_CAPS_MISREAD_BULLET_REGEX.lastIndex = 0;
      hasSuspiciousSubstitution = true;
      hasAmbiguousCharacters = true;
      reasons.push(
        `Rejected suspicious OCR bullet-to-letter substitution in "${token}"`
      );
      // Replace the suspicious lowercase middle with "•" rather than keeping a guessed letter
      token = token.replace(
        ALL_CAPS_MISREAD_BULLET_REGEX,
        (_, start, mid, end) => `${start}${"•".repeat(mid.length)}${end}`
      );
      hasMaskedCharacters = true;
      cleanedTokens.push(token);
      continue;
    }

    // Remove stray digits inside name tokens (OCR noise)
    if (/\d/.test(token)) {
      hasAmbiguousCharacters = true;
      reasons.push(`Removed stray digit(s) from name token "${token}"`);
      token = token.replace(/\d+/g, "");
    }

    if (token) {
      cleanedTokens.push(token);
    }
  }

  const finalName = cleanedTokens
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

  const isUncertain =
    !finalName ||
    hasAmbiguousCharacters ||
    hasSuspiciousSubstitution;

  // Autofill clean unmasked names OR cleanly preserved masked names (like "JO•N MA•K T.");
  // Do NOT autofill ambiguous/corrupted results like "JO.N MA.K T." as verified information.
  const shouldAutofill = Boolean(
    finalName && !hasAmbiguousCharacters && !hasSuspiciousSubstitution
  );

  return {
    name: finalName,
    hasMaskedCharacters,
    hasAmbiguousCharacters,
    hasSuspiciousSubstitution,
    isUncertain,
    shouldAutofill,
    reasons,
  };
}

function isJunkNameLine(line) {
  const value = String(line || "").trim();
  if (!value) return true;

  const junk = [
    /sent\s*via\s*gcash/i,
    /paid\s*via\s*gcash/i,
    /sent\s*via\s*gash/i,
    /express\s*send/i,
    /pay\s*qr/i,
    /pay\s*bills/i,
    /buy\s*load/i,
    /instapay/i,
    /total\s*amount/i,
    /^amount\b/i,
    /convenience\s*fee/i,
    /ref(?:erence)?\s*(?:no|number|#)?/i,
    /rot\s*no/i,
    /carbon|footprint|digital|gco2e/i,
    /successful|success|completed|confirmed/i,
    /transaction\s*(details|successful)?/i,
    /you\s*have\s*sent/i,
    /payment\s*successful/i,
    /^php\b|^₱|^£/i,
    /^\+?\d/,
    /^\d+([.,]\d+)?$/,
    /^gcash$/i,
    /^date\b/i,
    /^time\b/i,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b\s+\d{1,2}/i,
  ];

  return junk.some((pattern) => pattern.test(value));
}

function looksLikePersonName(line) {
  const { name } = cleanGcashName(line);
  if (name.length < 3 || name.length > 50) return false;
  if (!/[A-Za-z]{2,}/.test(name)) return false;
  if (/^\d/.test(name)) return false;

  return /^[A-Za-z][A-Za-z• .'-]{1,48}\.?$/.test(name);
}

/**
 * Extract transaction date and time separately from receipt lines.
 */
function extractTransactionDateTime(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const dateTimePatterns = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i,
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?/i,
    /\b\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
  ];

  for (const item of list) {
    const text = typeof item === "string" ? item : item.text;
    for (const pattern of dateTimePatterns) {
      const match = text.match(pattern);
      if (match?.[0]) {
        return {
          value: match[0].replace(/\s+/g, " ").trim(),
          confidence: typeof item === "object" ? item.confidence : null,
        };
      }
    }
  }

  return { value: "", confidence: null };
}

/**
 * Extract transaction amount separately from amount / total sections.
 */
function extractTransactionAmount(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const parseAmountFromText = (text) => {
    const match = String(text || "").match(
      /(?:₱|PHP|£|P)?\s*(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/i
    );
    if (!match?.[1]) return "";
    return match[1].replace(/,/g, "");
  };

  // Priority 1: "Total Amount Sent" / "Total Amount"
  for (let i = 0; i < list.length; i += 1) {
    const text = typeof list[i] === "string" ? list[i] : list[i].text;
    if (/total\s*amount/i.test(text)) {
      const direct = parseAmountFromText(text);
      if (direct) {
        return {
          value: direct,
          confidence: typeof list[i] === "object" ? list[i].confidence : null,
        };
      }
      if (list[i + 1]) {
        const nextText =
          typeof list[i + 1] === "string" ? list[i + 1] : list[i + 1].text;
        const fromNext = parseAmountFromText(nextText);
        if (fromNext) {
          return {
            value: fromNext,
            confidence:
              typeof list[i + 1] === "object" ? list[i + 1].confidence : null,
          };
        }
      }
    }
  }

  // Priority 2: "Amount" line
  for (let i = 0; i < list.length; i += 1) {
    const text = typeof list[i] === "string" ? list[i] : list[i].text;
    if (/^amount\b/i.test(text)) {
      const direct = parseAmountFromText(text);
      if (direct) {
        return {
          value: direct,
          confidence: typeof list[i] === "object" ? list[i].confidence : null,
        };
      }
      if (list[i + 1]) {
        const nextText =
          typeof list[i + 1] === "string" ? list[i + 1] : list[i + 1].text;
        const fromNext = parseAmountFromText(nextText);
        if (fromNext) {
          return {
            value: fromNext,
            confidence:
              typeof list[i + 1] === "object" ? list[i + 1].confidence : null,
          };
        }
      }
    }
  }

  // Priority 3: Currency-prefixed amount
  for (const item of list) {
    const text = typeof item === "string" ? item : item.text;
    const match = text.match(
      /(?:₱|PHP|£)\s*(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/i
    );
    if (match?.[1]) {
      return {
        value: match[1].replace(/,/g, ""),
        confidence: typeof item === "object" ? item.confidence : null,
      };
    }
  }

  return { value: "", confidence: null };
}

/**
 * Extract GCash reference number as digits only, independently from sender name.
 */
function extractReferenceNumber(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const isValidRefDigits = (digits) => {
    if (!/^\d{10,16}$/.test(digits)) return false;
    if (/^(?:09\d{9}|639\d{9})$/.test(digits)) return false;
    return true;
  };

  const stripDateTimeFromLine = (text) =>
    String(text || "")
      .replace(
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*\d{1,2}.*$/i,
        ""
      )
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}.*$/i, "")
      .trim();

  const labeledPatterns = [
    /(?:ref|rot)(?:erence)?\s*\.?\s*no\.?\s*[:-]?\s*([0-9][0-9\s-]{8,24})/i,
    /ref(?:erence)?\s*(?:number|#)\s*[:-]?\s*([0-9][0-9\s-]{8,24})/i,
    /(?:transaction|trans)\s*(?:no|id|#|number)\.?\s*[:-]?\s*([0-9][0-9\s-]{8,24})/i,
    /(?:trace|confirmation)\s*(?:no|id|#|number)?\.?\s*[:-]?\s*([0-9][0-9\s-]{8,24})/i,
  ];

  for (let i = 0; i < list.length; i += 1) {
    const rawLine = typeof list[i] === "string" ? list[i] : list[i].text;
    const line = stripDateTimeFromLine(rawLine);

    for (const pattern of labeledPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        if (/\d\.\d/.test(match[1])) continue;
        const digits = digitsOnly(match[1]);
        if (isValidRefDigits(digits)) {
          return {
            value: digits,
            confidence: typeof list[i] === "object" ? list[i].confidence : null,
          };
        }
      }
    }

    if (/ref(?:erence)?\s*(?:no|number|#)/i.test(line) && list[i + 1]) {
      const nextRaw =
        typeof list[i + 1] === "string" ? list[i + 1] : list[i + 1].text;
      const nextLine = stripDateTimeFromLine(nextRaw);
      if (!/\d\.\d/.test(nextLine)) {
        const digits = digitsOnly(nextLine);
        if (isValidRefDigits(digits)) {
          return {
            value: digits,
            confidence:
              typeof list[i + 1] === "object" ? list[i + 1].confidence : null,
          };
        }
      }
    }
  }

  for (const item of list) {
    const rawLine = typeof item === "string" ? item : item.text;
    if (/\+63|amount|total|₱|php/i.test(rawLine)) continue;
    const line = stripDateTimeFromLine(rawLine);
    const spacedGroups = line.match(/\b\d{3,5}(?:[\s-]+\d{2,7}){1,4}\b/g) || [];
    for (const group of spacedGroups) {
      const digits = digitsOnly(group);
      if (isValidRefDigits(digits)) {
        return {
          value: digits,
          confidence: typeof item === "object" ? item.confidence : null,
        };
      }
    }
  }

  const candidates = [];
  for (const item of list) {
    const rawLine = typeof item === "string" ? item : item.text;
    if (/\+63|amount|total|₱|php/i.test(rawLine)) continue;
    const line = stripDateTimeFromLine(rawLine);
    const plains = line.match(/\b\d{10,16}\b/g) || [];
    for (const digits of plains) {
      if (isValidRefDigits(digits)) {
        candidates.push({
          value: digits,
          confidence: typeof item === "object" ? item.confidence : null,
        });
      }
    }
  }

  if (candidates.length) {
    return (
      candidates.find((c) => c.value.length === 13) ||
      candidates.find((c) => c.value.length === 12) ||
      candidates.sort((a, b) => b.value.length - a.value.length)[0]
    );
  }

  return { value: "", confidence: null };
}

/**
 * Flatten Tesseract.js v7 blocks -> lines with bounding boxes and confidence.
 */
function extractStructuredLines(ocrData, fallbackText = "") {
  const lines = [];

  if (Array.isArray(ocrData?.blocks)) {
    for (const block of ocrData.blocks) {
      for (const paragraph of block?.paragraphs || []) {
        for (const line of paragraph?.lines || []) {
          const text = normalizeLineText(line?.text || "")
            .replace(/\s+/g, " ")
            .trim();
          if (!text) continue;
          lines.push({
            text,
            confidence:
              typeof line?.confidence === "number"
                ? Math.round(line.confidence)
                : null,
            bbox: line?.bbox || null,
          });
        }
      }
    }
  }

  if (lines.length === 0 && Array.isArray(ocrData?.lines)) {
    for (const line of ocrData.lines) {
      const text = normalizeLineText(line?.text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      lines.push({
        text,
        confidence:
          typeof line?.confidence === "number"
            ? Math.round(line.confidence)
            : null,
        bbox: line?.bbox || null,
      });
    }
  }

  if (lines.length === 0) {
    const normalizedText = normalizeLineText(fallbackText);
    for (const rawLine of normalizedText.split("\n")) {
      const text = rawLine.replace(/\s+/g, " ").trim();
      if (!text) continue;
      lines.push({
        text,
        confidence:
          typeof ocrData?.confidence === "number"
            ? Math.round(ocrData.confidence)
            : null,
        bbox: null,
      });
    }
  }

  return lines;
}

/**
 * Locate the sender name line (and its bounding box if available) from structured receipt lines.
 */
function findSenderNameLine(lines) {
  const list = Array.isArray(lines) ? lines : [];

  const landmarkPatterns = [
    /sent\s*via\s*g(?:cash|ash)/i,
    /paid\s*via\s*gcash/i,
    /express\s*send/i,
  ];

  // 1) Line above "Sent via GCash" (skipping the +63 mobile line)
  for (let i = 0; i < list.length; i += 1) {
    const lineText = typeof list[i] === "string" ? list[i] : list[i].text;
    if (!landmarkPatterns.some((pattern) => pattern.test(lineText))) continue;

    for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
      const candidateText =
        typeof list[j] === "string" ? list[j] : list[j].text;
      if (isJunkNameLine(candidateText)) continue;
      if (
        /\+63|9[*●•·\d]{4,}/.test(candidateText) &&
        !/[A-Za-z]{2,}/.test(candidateText)
      ) {
        continue;
      }
      if (looksLikePersonName(candidateText)) {
        return { item: list[j], rawText: candidateText };
      }
    }
  }

  // 2) Line directly above a +63 / masked mobile line
  for (let i = 0; i < list.length; i += 1) {
    const lineText = typeof list[i] === "string" ? list[i] : list[i].text;
    if (!/(\+63|9[*●•·\d]{5,})/i.test(lineText)) continue;

    for (let j = i - 1; j >= Math.max(0, i - 2); j -= 1) {
      const candidateText =
        typeof list[j] === "string" ? list[j] : list[j].text;
      if (isJunkNameLine(candidateText)) continue;
      if (looksLikePersonName(candidateText)) {
        return { item: list[j], rawText: candidateText };
      }
    }
  }

  // 3) Explicitly labeled sender/recipient lines
  const labelPatterns = [
    /^(?:from|sender|paid\s*by|account\s*name|gcash\s*name|name)\s*[:.-]?\s*(.+)$/i,
    /^(?:sent\s*to|to|recipient|receiver)\s*[:.-]?\s*(.+)$/i,
  ];
  for (let i = 0; i < list.length; i += 1) {
    const lineText = typeof list[i] === "string" ? list[i] : list[i].text;
    for (const pattern of labelPatterns) {
      const match = lineText.match(pattern);
      if (match?.[1] && looksLikePersonName(match[1])) {
        return { item: list[i], rawText: match[1] };
      }
      if (pattern.test(lineText) && !match?.[1] && list[i + 1]) {
        const nextText =
          typeof list[i + 1] === "string" ? list[i + 1] : list[i + 1].text;
        if (looksLikePersonName(nextText)) {
          return { item: list[i + 1], rawText: nextText };
        }
      }
    }
  }

  // 4) First plausible name in upper section (stop before Amount/Total/Ref No.)
  const upperLimit = Math.min(list.length, 10);
  for (let i = 0; i < upperLimit; i += 1) {
    const candidateText = typeof list[i] === "string" ? list[i] : list[i].text;
    if (/^(?:amount|total\s*amount|ref(?:erence)?\s*no)/i.test(candidateText)) {
      break;
    }
    if (isJunkNameLine(candidateText)) continue;
    if (looksLikePersonName(candidateText)) {
      return { item: list[i], rawText: candidateText };
    }
  }

  return { item: null, rawText: "" };
}

/**
 * Parse GCash / InstaPay receipt OCR text (and optional Tesseract block/line metadata)
 * into separate validated fields.
 */
export function parseGcashReceiptText(rawText = "", ocrData = null) {
  const normalizedText = normalizeLineText(rawText);
  const structuredLines = extractStructuredLines(ocrData, normalizedText);

  const nameMatch = findSenderNameLine(structuredLines);
  const cleanedName = cleanGcashName(nameMatch.rawText);
  const refResult = extractReferenceNumber(structuredLines);
  const amountResult = extractTransactionAmount(structuredLines);
  const dateTimeResult = extractTransactionDateTime(structuredLines);

  const overallConfidence =
    typeof ocrData?.confidence === "number"
      ? Math.round(ocrData.confidence)
      : null;

  const nameConfidence =
    (typeof nameMatch.item === "object" ? nameMatch.item?.confidence : null) ??
    overallConfidence;
  const refConfidence = refResult.confidence ?? overallConfidence;

  const nameNeedsVerification =
    cleanedName.isUncertain || (nameConfidence !== null && nameConfidence < 75);

  const refNeedsVerification =
    !refResult.value ||
    refResult.value.length < 10 ||
    refResult.value.length > 16 ||
    (refConfidence !== null && refConfidence < 70);

  return {
    gcashCustomerName: cleanedName.name,
    rawExtractedName: nameMatch.rawText,
    senderNameBbox:
      typeof nameMatch.item === "object" ? nameMatch.item?.bbox || null : null,
    referenceNumber: refResult.value,
    transactionAmount: amountResult.value,
    transactionDateTime: dateTimeResult.value,
    hasMaskedName: cleanedName.hasMaskedCharacters,
    hasAmbiguousName: cleanedName.hasAmbiguousCharacters,
    shouldAutofillName: cleanedName.shouldAutofill,
    nameReasons: cleanedName.reasons,
    confidence: {
      overall: overallConfidence,
      name: nameConfidence,
      referenceNumber: refConfidence,
      amount: amountResult.confidence ?? overallConfidence,
      dateTime: dateTimeResult.confidence ?? overallConfidence,
    },
    needsVerification: {
      name: nameNeedsVerification,
      referenceNumber: refNeedsVerification,
    },
    rawText: normalizedText,
  };
}

/**
 * Compute Otsu's optimal global threshold from a 256-bin grayscale histogram.
 */
function computeOtsuThreshold(histogram, totalPixels) {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 160;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;

    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const diff = meanBackground - meanForeground;
    const variance = weightBackground * weightForeground * diff * diff;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Decode image file with EXIF orientation correction and upscale without reducing resolution.
 */
async function decodeAndUpscaleReceipt(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const minEdge = 1400;
  const maxEdge = 3200;
  const shortest = Math.min(bitmap.width, bitmap.height);
  const longest = Math.max(bitmap.width, bitmap.height);

  let scale = 1;
  if (shortest < minEdge) {
    scale = Math.min(4, minEdge / shortest);
  }
  if (longest * scale > maxEdge) {
    scale = Math.max(1, maxEdge / longest);
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close?.();
    return null;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return canvas;
}

/**
 * Apply grayscale, 5-neighbor cross median denoising, percentile contrast stretch,
 * and Otsu-guided soft thresholding to a canvas copy.
 */
function buildPreprocessedCanvas(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const pixelCount = width * height;
  const gray = new Uint8Array(pixelCount);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = Math.round(
      data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    );
  }

  const denoised = new Uint8Array(pixelCount);
  denoised.set(gray);
  const neighbors = new Uint8Array(5);

  for (let y = 1; y < height - 1; y += 1) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const idx = rowOffset + x;
      neighbors[0] = gray[idx];
      neighbors[1] = gray[idx - 1];
      neighbors[2] = gray[idx + 1];
      neighbors[3] = gray[idx - width];
      neighbors[4] = gray[idx + width];
      neighbors.sort();
      denoised[idx] = neighbors[2];
    }
  }

  const rawHist = new Uint32Array(256);
  for (let p = 0; p < pixelCount; p += 1) {
    rawHist[denoised[p]] += 1;
  }

  let lowClip = 0;
  let highClip = 255;
  const lowTarget = Math.floor(pixelCount * 0.02);
  const highTarget = Math.floor(pixelCount * 0.98);
  let cumulative = 0;

  for (let i = 0; i < 256; i += 1) {
    cumulative += rawHist[i];
    if (cumulative >= lowTarget) {
      lowClip = i;
      break;
    }
  }

  cumulative = 0;
  for (let i = 0; i < 256; i += 1) {
    cumulative += rawHist[i];
    if (cumulative >= highTarget) {
      highClip = i;
      break;
    }
  }

  const range = Math.max(1, highClip - lowClip);
  const stretchedHist = new Uint32Array(256);

  for (let p = 0; p < pixelCount; p += 1) {
    let val = Math.round(((denoised[p] - lowClip) * 255) / range);
    if (val < 0) val = 0;
    else if (val > 255) val = 255;
    denoised[p] = val;
    stretchedHist[val] += 1;
  }

  const otsu = computeOtsuThreshold(stretchedHist, pixelCount);
  const darkCutoff = Math.max(30, otsu - 25);
  const lightCutoff = Math.min(235, otsu + 20);
  const transitionSpan = Math.max(1, lightCutoff - darkCutoff);

  for (let p = 0, i = 0; p < pixelCount; p += 1, i += 4) {
    const val = denoised[p];
    let out;
    if (val <= darkCutoff) out = 0;
    else if (val >= lightCutoff) out = 255;
    else out = Math.round(((val - darkCutoff) * 255) / transitionSpan);

    data[i] = out;
    data[i + 1] = out;
    data[i + 2] = out;
    data[i + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Connected-component detector on a cropped single-line sender-name canvas.
 * Detects GCash solid circular masking bullets (•) by geometry:
 * - height & width between 30% and 65% of uppercase cap height
 * - circular aspect ratio (0.70 .. 1.40)
 * - solid filled disk (fill ratio >= 0.66, vs hollow letters o/e/c/s < 0.55)
 * - mid-line vertical position (relCenterY 0.25 .. 0.75, vs baseline period "." > 0.80)
 *
 * Returns detected bullet boxes, cap height, and an erased canvas copy where
 * the bullet blobs are painted white so Tesseract won't hallucinate letters for them.
 */
export function detectAndEraseVisualBullets(nameCanvas) {
  const width = nameCanvas.width;
  const height = nameCanvas.height;
  const ctx = nameCanvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const pixelCount = width * height;
  const gray = new Uint8Array(pixelCount);
  const hist = new Uint32Array(256);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const g = Math.round(
      data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    );
    gray[p] = g;
    hist[g] += 1;
  }

  const thresh = computeOtsuThreshold(hist, pixelCount);
  const visited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  const components = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || gray[start] >= thresh) continue;

      let top = 0;
      stack[top++] = start;
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const pixels = [];

      while (top > 0) {
        const idx = stack[--top];
        const cx = idx % width;
        const cy = (idx - cx) / width;
        pixels.push(idx);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx > 0 && !visited[idx - 1] && gray[idx - 1] < thresh) {
          visited[idx - 1] = 1;
          stack[top++] = idx - 1;
        }
        if (cx + 1 < width && !visited[idx + 1] && gray[idx + 1] < thresh) {
          visited[idx + 1] = 1;
          stack[top++] = idx + 1;
        }
        if (cy > 0 && !visited[idx - width] && gray[idx - width] < thresh) {
          visited[idx - width] = 1;
          stack[top++] = idx - width;
        }
        if (
          cy + 1 < height &&
          !visited[idx + width] &&
          gray[idx + width] < thresh
        ) {
          visited[idx + width] = 1;
          stack[top++] = idx + width;
        }
      }

      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      const area = pixels.length;
      if (area < 8 || ch > height * 0.92 || cw > width * 0.5) continue;

      components.push({
        minX,
        maxX,
        minY,
        maxY,
        w: cw,
        h: ch,
        area,
        aspect: cw / ch,
        fill: area / (cw * ch),
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        pixels,
      });
    }
  }

  if (components.length < 2) {
    return { bullets: [], capH: 0, erasedCanvas: null };
  }

  const heights = components.map((c) => c.h).sort((a, b) => a - b);
  const capH = heights[Math.floor(heights.length * 0.75)] || 0;
  const tallComps = components.filter((c) => c.h >= capH * 0.75);
  if (capH < 12 || tallComps.length === 0) {
    return { bullets: [], capH, erasedCanvas: null };
  }

  const lineTop = Math.min(...tallComps.map((c) => c.minY));
  const lineBottom = Math.max(...tallComps.map((c) => c.maxY));
  const lineH = Math.max(1, lineBottom - lineTop);

  const bullets = components
    .filter((c) => {
      const relCenterY = (c.centerY - lineTop) / lineH;
      return (
        c.h >= capH * 0.3 &&
        c.h <= capH * 0.65 &&
        c.w >= capH * 0.3 &&
        c.w <= capH * 0.65 &&
        c.aspect >= 0.7 &&
        c.aspect <= 1.4 &&
        c.fill >= 0.66 &&
        relCenterY >= 0.25 &&
        relCenterY <= 0.75 &&
        c.maxY < lineBottom - capH * 0.04
      );
    })
    .sort((a, b) => a.minX - b.minX);

  if (bullets.length === 0) {
    return { bullets: [], visualSpaces: [], capH, erasedCanvas: null };
  }

  // Detect true visual word spaces from pixel ink gaps across all sorted components
  const sortedAll = [...components].sort((a, b) => a.minX - b.minX);
  const wordGapThreshold = Math.max(8, capH * 0.3);
  const visualSpaces = [];
  for (let i = 1; i < sortedAll.length; i += 1) {
    const prev = sortedAll[i - 1];
    const curr = sortedAll[i];
    const gap = curr.minX - prev.maxX;
    if (gap >= wordGapThreshold) {
      visualSpaces.push((prev.maxX + curr.minX) / 2);
    }
  }

  // Paint a clean white rectangle over each detected bullet blob (+2px margin)
  const erasedCanvas = document.createElement("canvas");
  erasedCanvas.width = width;
  erasedCanvas.height = height;
  const erasedCtx = erasedCanvas.getContext("2d", { willReadFrequently: true });
  erasedCtx.drawImage(nameCanvas, 0, 0);
  erasedCtx.fillStyle = "#ffffff";
  for (const b of bullets) {
    const pad = 2;
    erasedCtx.fillRect(
      Math.max(0, b.minX - pad),
      Math.max(0, b.minY - pad),
      b.w + pad * 2,
      b.h + pad * 2
    );
  }

  return { bullets, visualSpaces, capH, erasedCanvas };
}

/**
 * Reconstruct sender name by merging Tesseract symbol bounding boxes (from the bullet-erased
 * sender-name image) with the exact visual bullet X-coordinates and visual ink word spaces.
 */
function reconstructNameWithVisualBullets(ocrData, bullets, visualSpaces = []) {
  const symbols = [];
  if (Array.isArray(ocrData?.blocks)) {
    for (const block of ocrData.blocks) {
      for (const paragraph of block?.paragraphs || []) {
        for (const line of paragraph?.lines || []) {
          for (const word of line?.words || []) {
            for (const sym of word?.symbols || []) {
              const ch = String(sym?.text || "").trim();
              if (!ch || !sym?.bbox) continue;
              symbols.push({
                kind: "char",
                text: ch,
                centerX: (sym.bbox.x0 + sym.bbox.x1) / 2,
              });
            }
          }
        }
      }
    }
  }

  if (symbols.length === 0) {
    return "";
  }

  const items = [
    ...symbols,
    ...bullets.map((b) => ({
      kind: "bullet",
      text: "•",
      centerX: b.centerX,
    })),
    ...visualSpaces.map((sx) => ({
      kind: "space",
      text: " ",
      centerX: sx,
    })),
  ].sort((a, b) => a.centerX - b.centerX);

  return items
    .map((item) => item.text)
    .join("")
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Crop the sender name band from the upscaled receipt canvas using Pass 1 bbox
 * (or fallback to standard GCash top-name band).
 */
function cropSenderNameCanvas(sourceCanvas, senderNameBbox) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  let x0;
  let y0;
  let cropW;
  let cropH;

  if (
    senderNameBbox &&
    senderNameBbox.x1 > senderNameBbox.x0 &&
    senderNameBbox.y1 > senderNameBbox.y0
  ) {
    const lineH = senderNameBbox.y1 - senderNameBbox.y0;
    const padX = Math.max(24, Math.round(lineH * 1.2));
    const padY = Math.max(16, Math.round(lineH * 0.7));
    x0 = Math.max(0, Math.floor(senderNameBbox.x0 - padX));
    y0 = Math.max(0, Math.floor(senderNameBbox.y0 - padY));
    const x1 = Math.min(w, Math.ceil(senderNameBbox.x1 + padX));
    const y1 = Math.min(h, Math.ceil(senderNameBbox.y1 + padY));
    cropW = Math.max(1, x1 - x0);
    cropH = Math.max(1, y1 - y0);
  } else {
    x0 = Math.round(w * 0.08);
    y0 = Math.round(h * 0.14);
    cropW = Math.round(w * 0.84);
    cropH = Math.round(h * 0.16);
  }

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const ctx = cropCanvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cropW, cropH);
  ctx.drawImage(sourceCanvas, x0, y0, cropW, cropH, 0, 0, cropW, cropH);

  return cropCanvas;
}

function mergeParsed(primary, secondary) {
  const usePrimaryName = Boolean(primary.gcashCustomerName);
  const usePrimaryRef = Boolean(primary.referenceNumber);
  const usePrimaryAmount = Boolean(primary.transactionAmount);
  const usePrimaryDateTime = Boolean(primary.transactionDateTime);

  return {
    gcashCustomerName: usePrimaryName
      ? primary.gcashCustomerName
      : secondary.gcashCustomerName || "",
    rawExtractedName: usePrimaryName
      ? primary.rawExtractedName
      : secondary.rawExtractedName || "",
    senderNameBbox: primary.senderNameBbox || secondary.senderNameBbox || null,
    referenceNumber: usePrimaryRef
      ? primary.referenceNumber
      : secondary.referenceNumber || "",
    transactionAmount: usePrimaryAmount
      ? primary.transactionAmount
      : secondary.transactionAmount || "",
    transactionDateTime: usePrimaryDateTime
      ? primary.transactionDateTime
      : secondary.transactionDateTime || "",
    hasMaskedName: usePrimaryName
      ? primary.hasMaskedName
      : secondary.hasMaskedName,
    hasAmbiguousName: usePrimaryName
      ? primary.hasAmbiguousName
      : secondary.hasAmbiguousName,
    shouldAutofillName: usePrimaryName
      ? primary.shouldAutofillName
      : secondary.shouldAutofillName,
    nameReasons: usePrimaryName ? primary.nameReasons : secondary.nameReasons,
    confidence: {
      overall:
        primary.confidence?.overall ?? secondary.confidence?.overall ?? null,
      name: usePrimaryName
        ? primary.confidence?.name ?? null
        : secondary.confidence?.name ?? null,
      referenceNumber: usePrimaryRef
        ? primary.confidence?.referenceNumber ?? null
        : secondary.confidence?.referenceNumber ?? null,
      amount: usePrimaryAmount
        ? primary.confidence?.amount ?? null
        : secondary.confidence?.amount ?? null,
      dateTime: usePrimaryDateTime
        ? primary.confidence?.dateTime ?? null
        : secondary.confidence?.dateTime ?? null,
    },
    needsVerification: {
      name: usePrimaryName
        ? primary.needsVerification?.name
        : secondary.needsVerification?.name ?? true,
      referenceNumber: usePrimaryRef
        ? primary.needsVerification?.referenceNumber
        : secondary.needsVerification?.referenceNumber ?? true,
    },
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
  const upscaled = await decodeAndUpscaleReceipt(file);
  const prepared = upscaled ? buildPreprocessedCanvas(upscaled) : file;
  report(12);

  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message?.status === "recognizing text") {
        const pct = 12 + Math.round((Number(message.progress) || 0) * 65);
        report(Math.min(82, pct));
      }
    },
  });

  try {
    // Pass 1: full receipt layout with block/line bounding boxes
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
    });
    const first = await worker.recognize(prepared, {}, { blocks: true });
    devLog("Raw full-receipt OCR output", first?.data?.text || "");
    devLog("Full-receipt OCR confidence", first?.data?.confidence ?? null);

    let parsed = parseGcashReceiptText(first?.data?.text || "", first?.data);

    // Pass 2: alternate segmentation if Ref No. or name bbox missing
    if (!parsed.referenceNumber || !parsed.senderNameBbox) {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "4",
      });
      const second = await worker.recognize(prepared, {}, { blocks: true });
      parsed = mergeParsed(
        parsed,
        parseGcashReceiptText(second?.data?.text || "", second?.data)
      );
    }

    // Pass 3: Dedicated cropped sender-name OCR pass with visual bullet detection
    if (upscaled) {
      report(85);
      const rawNameCrop = cropSenderNameCanvas(upscaled, parsed.senderNameBbox);
      const processedNameCrop = buildPreprocessedCanvas(rawNameCrop);
      const bulletInfo = detectAndEraseVisualBullets(rawNameCrop);

      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "7",
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .'-",
      });

      const targetNameCanvas =
        bulletInfo.bullets.length > 0 && bulletInfo.erasedCanvas
          ? buildPreprocessedCanvas(bulletInfo.erasedCanvas)
          : processedNameCrop;

      const namePass = await worker.recognize(
        targetNameCanvas,
        {},
        { blocks: true }
      );
      const croppedRawText = String(namePass?.data?.text || "").trim();
      const croppedConf =
        typeof namePass?.data?.confidence === "number"
          ? Math.round(namePass.data.confidence)
          : null;

      devLog("Cropped sender-name OCR output", croppedRawText);
      devLog("Cropped sender-name OCR confidence", croppedConf);
      devLog("Detected visual bullets count", bulletInfo.bullets.length);

      let candidateNameText = croppedRawText;
      if (bulletInfo.bullets.length > 0) {
        const reconstructed = reconstructNameWithVisualBullets(
          namePass?.data,
          bulletInfo.bullets,
          bulletInfo.visualSpaces
        );
        if (reconstructed) {
          candidateNameText = reconstructed;
        }
      }

      if (candidateNameText) {
        const cleaned = cleanGcashName(candidateNameText, {
          visualBulletsDetected: bulletInfo.bullets.length,
        });

        devLog("Extracted sender name (candidate)", candidateNameText);
        devLog("Cleaned sender name", cleaned.name);
        if (cleaned.reasons.length > 0) {
          devLog("Uncertain/masking reasons", cleaned.reasons);
        }

        parsed = {
          ...parsed,
          gcashCustomerName: cleaned.name,
          rawExtractedName: candidateNameText,
          hasMaskedName: cleaned.hasMaskedCharacters,
          hasAmbiguousName: cleaned.hasAmbiguousCharacters,
          shouldAutofillName: cleaned.shouldAutofill,
          nameReasons: cleaned.reasons,
          confidence: {
            ...parsed.confidence,
            name: croppedConf ?? parsed.confidence.name,
          },
          needsVerification: {
            ...parsed.needsVerification,
            name:
              cleaned.isUncertain ||
              (croppedConf !== null && croppedConf < 75),
          },
        };
      }
    }

    // Pass 4: digit-focused pass for stubborn Ref No. (completely independent of name)
    if (!parsed.referenceNumber) {
      report(92);
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz #-:",
        tessedit_pageseg_mode: "6",
      });
      const refPass = await worker.recognize(prepared, {}, { blocks: true });
      const refOnly = parseGcashReceiptText(
        refPass?.data?.text || "",
        refPass?.data
      );
      if (refOnly.referenceNumber) {
        parsed = {
          ...parsed,
          referenceNumber: refOnly.referenceNumber,
          confidence: {
            ...parsed.confidence,
            referenceNumber: refOnly.confidence.referenceNumber,
          },
          needsVerification: {
            ...parsed.needsVerification,
            referenceNumber: refOnly.needsVerification.referenceNumber,
          },
        };
      }
    }

    report(100);
    return parsed;
  } finally {
    await worker.terminate();
  }
}
