/**
 * Secure client-side validation for user-uploaded files.
 * Checks size, MIME/extension match, dangerous names, and magic bytes.
 */

export const PAYMENT_RECEIPT_RULES = {
  maxBytes: 2 * 1024 * 1024, // 2 MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedExtensions: ["jpg", "jpeg", "png", "webp"],
};

export const GCASH_QR_RULES = {
  maxBytes: 2 * 1024 * 1024, // 2 MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedExtensions: ["jpg", "jpeg", "png", "webp"],
};

const MAGIC_SIGNATURES = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
];

function getExtension(filename = "") {
  const parts = String(filename).toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1];
}

export function sanitizeFileName(filename = "") {
  const base = String(filename).split(/[/\\]/).pop() || "upload";
  const cleaned = base
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);

  const ext = getExtension(cleaned);
  const nameOnly = cleaned.replace(/\.[^.]+$/, "") || "receipt";
  return ext ? nameOnly + "." + ext : nameOnly + ".bin";
}

function hasDangerousName(filename = "") {
  const lower = String(filename).toLowerCase();
  if (lower.includes("..") || lower.includes("/") || lower.includes("\\")) {
    return true;
  }
  // block double extensions like invoice.pdf.jpg or .exe.png
  const parts = lower.split(".");
  if (parts.length > 2) {
    const risky = ["exe", "js", "mjs", "html", "htm", "svg", "php", "sh", "bat", "cmd", "dll"];
    if (parts.slice(0, -1).some((part) => risky.includes(part))) {
      return true;
    }
  }
  return false;
}

async function readFileHeader(file, length = 16) {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesMagic(bytes, mime) {
  if (mime === "image/webp") {
    // RIFF....WEBP
    const isRiff =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46;
    const isWebp =
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    return isRiff && isWebp;
  }

  const signature = MAGIC_SIGNATURES.find((item) => item.mime === mime);
  if (!signature) return false;
  return signature.bytes.every((value, index) => bytes[index] === value);
}

/**
 * Validate a browser File before upload.
 * @returns {Promise<{ok:true, file:File, safeName:string, mime:string}|{ok:false, error:string}>}
 */
export async function validateUserUpload(file, rules = PAYMENT_RECEIPT_RULES) {
  if (!file) {
    return { ok: false, error: "Please choose a file to upload." };
  }

  if (!(file instanceof File)) {
    return { ok: false, error: "Invalid file selection." };
  }

  if (!file.size || file.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > rules.maxBytes) {
    const mb = (rules.maxBytes / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      error: "File is too large. Maximum allowed size is " + mb + " MB.",
    };
  }

  if (hasDangerousName(file.name)) {
    return {
      ok: false,
      error: "Invalid file name. Please rename the file and try again.",
    };
  }

  const extension = getExtension(file.name);
  if (!rules.allowedExtensions.includes(extension)) {
    return {
      ok: false,
      error: "Only JPG, PNG, or WEBP image files are allowed.",
    };
  }

  const mime = String(file.type || "").toLowerCase();
  if (!rules.allowedMimeTypes.includes(mime)) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a JPG, PNG, or WEBP image.",
    };
  }

  // Extension must agree with declared MIME type
  const mimeExtMap = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  if (!(mimeExtMap[mime] || []).includes(extension)) {
    return {
      ok: false,
      error: "File extension does not match the image type.",
    };
  }

  try {
    const header = await readFileHeader(file, 16);
    if (!matchesMagic(header, mime)) {
      return {
        ok: false,
        error: "File content is not a valid image. Please upload a real JPG, PNG, or WEBP file.",
      };
    }
  } catch (error) {
    console.error("Unable to inspect file header:", error);
    return {
      ok: false,
      error: "Unable to validate the selected file. Please try another image.",
    };
  }

  return {
    ok: true,
    file,
    safeName: sanitizeFileName(file.name),
    mime,
  };
}
