import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, firebaseConfig } from "./firebase";

const EMPLOYEE_CREATOR_APP = "AdminEmployeeCreator";

const getEmployeeCreatorAuth = () => {
  const existing = getApps().find((app) => app.name === EMPLOYEE_CREATOR_APP);
  const secondaryApp =
    existing || initializeApp(firebaseConfig, EMPLOYEE_CREATOR_APP);
  return getAuth(secondaryApp);
};

/**
 * Create a staff or rider Auth account + Firestore user doc
 * without signing out the current admin (uses a secondary Firebase app).
 */
export const createEmployeeAccount = async ({
  email,
  password,
  firstName,
  lastName,
  phone = "",
  role = "staff",
}) => {
  const normalizedRole = role === "rider" ? "rider" : "staff";
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedFirst = String(firstName || "").trim();
  const trimmedLast = String(lastName || "").trim();
  const trimmedPhone = String(phone || "").trim();
  const fullName = `${trimmedFirst} ${trimmedLast}`.trim() || trimmedEmail;

  if (!trimmedEmail || !password) {
    throw new Error("Email and password are required.");
  }
  if (String(password).length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const secondaryAuth = getEmployeeCreatorAuth();

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      trimmedEmail,
      password
    );
    const uid = credential.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      name: fullName,
      email: trimmedEmail,
      phone: trimmedPhone,
      role: normalizedRole,
      status: "Active",
      emailVerified: true,
      active_booking_count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await signOut(secondaryAuth);

    return { uid, email: trimmedEmail, role: normalizedRole, name: fullName };
  } catch (error) {
    try {
      await signOut(secondaryAuth);
    } catch {
      // ignore secondary sign-out failures
    }
    throw error;
  }
};

const getTimestampMilliseconds = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeUserStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "inactive") return "Inactive";
  if (value === "archived") return "Archived";
  return "Active";
};

const mapUserDoc = (userDoc) => {
  const data = userDoc.data();
  const firstName =
    data.firstName ||
    data.first_name ||
    (data.name ? String(data.name).split(" ")[0] : "") ||
    "";
  const lastName =
    data.lastName ||
    data.last_name ||
    (data.name ? String(data.name).split(" ").slice(1).join(" ") : "") ||
    "";
  const fullName =
    data.name ||
    `${firstName} ${lastName}`.trim() ||
    data.email ||
    "User";

  return {
    id: userDoc.id,
    ...data,
    firstName,
    lastName,
    name: fullName,
    phone: data.phone || data.phoneNumber || "",
    email: data.email || "",
    role: data.role || "customer",
    status: normalizeUserStatus(data.status),
    address:
      data.address ||
      [data.barangay, data.city, data.province].filter(Boolean).join(", ") ||
      "",
    createdAt: data.createdAt || data.created_at || null,
    archivedAt: data.archivedAt || null,
  };
};

export const getStaffNames = async () => {
  const snapshot = await getDocs(
    query(collection(db, "users"), where("role", "==", "staff"))
  );

  return Object.fromEntries(
    snapshot.docs.map((staffDoc) => {
      const staff = mapUserDoc(staffDoc);
      return [staff.id, staff.name];
    })
  );
};

/**
 * Load users that match one or more roles (e.g. staff, admin).
 */
export const getUsersByRoles = async (roles = []) => {
  const roleList = Array.isArray(roles) ? roles.filter(Boolean) : [roles];
  if (roleList.length === 0) return [];

  const snapshots = await Promise.all(
    roleList.map((role) =>
      getDocs(query(collection(db, "users"), where("role", "==", role)))
    )
  );

  const usersById = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((userDoc) => {
      const user = mapUserDoc(userDoc);
      if (normalizeUserStatus(user.status) === "Archived") return;
      usersById.set(user.id, user);
    });
  });

  return Array.from(usersById.values());
};

export const getUserData = async (uid) => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return mapUserDoc(docSnap);
  }

  return null;
};

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const updateUserStatus = async (uid, status) => {
  const nextStatus = normalizeUserStatus(status);
  const payload = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  };

  if (nextStatus === "Archived") {
    payload.archivedAt = serverTimestamp();
  } else {
    payload.archivedAt = null;
  }

  await updateDoc(doc(db, "users", uid), payload);
};

export const archiveUserAccount = async (uid) => {
  await updateUserStatus(uid, "Archived");
};

export const unarchiveUserAccount = async (uid) => {
  await updateUserStatus(uid, "Active");
};

export const deleteUserAccount = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
};

/**
 * Subscribe to users filtered by one or more roles.
 */
export const subscribeToUsersByRoles = (roles, onUsers, onError) => {
  const roleList = Array.isArray(roles) ? roles : [roles];

  return onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      const users = snapshot.docs
        .map(mapUserDoc)
        .filter((user) => roleList.includes(user.role))
        .sort(
          (a, b) =>
            getTimestampMilliseconds(b.createdAt) -
            getTimestampMilliseconds(a.createdAt)
        );
      onUsers(users);
    },
    onError
  );
};

/**
 * Count bookings per customer id from a bookings snapshot list.
 */
export const countBookingsByCustomer = (bookings = []) => {
  const counts = {};
  bookings.forEach((booking) => {
    const customerId = booking.customer_id || booking.customerId;
    if (!customerId) return;
    counts[customerId] = (counts[customerId] || 0) + 1;
  });
  return counts;
};

/**
 * Count active assignments per staff/rider.
 */
export const countActiveJobsByUser = (bookings = []) => {
  const counts = {};
  const closed = new Set([
    "completed",
    "cancelled",
    "canceled",
    "declined",
    "delivered",
  ]);

  bookings.forEach((booking) => {
    const status = String(booking.status || "").toLowerCase();
    if (closed.has(status)) return;

    const staffId = booking.staff_id || booking.staffId;
    const riderId = booking.rider_id || booking.riderId;

    if (staffId) counts[staffId] = (counts[staffId] || 0) + 1;
    if (riderId) counts[riderId] = (counts[riderId] || 0) + 1;
  });

  return counts;
};
