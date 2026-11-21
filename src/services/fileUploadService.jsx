import {
  GCASH_QR_RULES,
  PAYMENT_RECEIPT_RULES,
  validateUserUpload,
} from "../utils/fileValidation";

const FIRESTORE_IMAGE_MAX_CHARS = 700000; // stay under ~1MB Firestore doc limit

/**
 * Compress an image File into a data URL small enough for Firestore.
 */
const fileToCompressedDataUrl = (file, maxEdge = 900, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to process the image."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = objectUrl;
  });

const compressForFirestore = async (file) => {
  let dataUrl = await fileToCompressedDataUrl(file, 900, 0.75);
  if (dataUrl.length > FIRESTORE_IMAGE_MAX_CHARS) {
    dataUrl = await fileToCompressedDataUrl(file, 640, 0.62);
  }
  if (dataUrl.length > FIRESTORE_IMAGE_MAX_CHARS) {
    dataUrl = await fileToCompressedDataUrl(file, 480, 0.5);
  }
  if (dataUrl.length > FIRESTORE_IMAGE_MAX_CHARS) {
    throw new Error(
      "Image is still too large after compression. Please upload a smaller JPG/PNG."
    );
  }
  return dataUrl;
};

/**
 * Save a customer payment receipt without Firebase Storage.
 * Compresses the image into a data URL stored on the payment document.
 */
export const uploadPaymentReceipt = async ({
  file,
  userId,
  bookingId,
}) => {
  if (!userId) {
    throw new Error("You must be signed in to upload a receipt.");
  }

  if (!bookingId) {
    throw new Error("Missing booking ID for receipt upload.");
  }

  const validation = await validateUserUpload(file, PAYMENT_RECEIPT_RULES);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const dataUrl = await compressForFirestore(validation.file);

  return {
    receipt_url: dataUrl,
    receipt_path: "",
    receipt_name: validation.safeName,
    receipt_content_type: "image/jpeg",
    receipt_size: dataUrl.length,
  };
};

/**
 * Save shop GCash QR image (admin) without Firebase Storage.
 * Compresses the image and returns a data URL for Firestore settings.
 */
export const uploadGcashQr = async ({ file, userId }) => {
  if (!userId) {
    throw new Error("You must be signed in to upload a GCash QR.");
  }

  const validation = await validateUserUpload(file, GCASH_QR_RULES);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const dataUrl = await compressForFirestore(validation.file);

  return {
    gcashQr: dataUrl,
    gcashQrPath: null,
    gcashQrName: validation.safeName,
  };
};
