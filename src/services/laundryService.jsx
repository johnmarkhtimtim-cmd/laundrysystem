import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const defaultServices = [
  {
    id: "wash-fold",
    name: "Wash & Fold",
    description: "Professional washing, drying, and folding service.",
    price: 80,
    icon: "🧺",
    status: "Active",
  },
  {
    id: "dry-cleaning",
    name: "Dry Cleaning",
    description: "Gentle cleaning for delicate and special garments.",
    price: 150,
    icon: "👔",
    status: "Active",
  },
  {
    id: "ironing",
    name: "Ironing",
    description: "Neat and professional ironing for your clothes.",
    price: 60,
    icon: "👕",
    status: "Active",
  },
  {
    id: "bedding-care",
    name: "Bedding Care",
    description: "Special cleaning service for blankets and bedding.",
    price: 200,
    icon: "🛏️",
    status: "Inactive",
  },
];

export const ensureDefaultServices = async () => {
  const markerRef = doc(db, "systemMetadata", "services");
  const markerSnapshot = await getDoc(markerRef);

  if (markerSnapshot.exists()) {
    return;
  }

  const servicesRef = collection(db, "services");
  const servicesSnapshot = await getDocs(servicesRef);
  const batch = writeBatch(db);

  if (servicesSnapshot.empty) {
    defaultServices.forEach(({ id, ...service }) => {
      batch.set(doc(servicesRef, id), {
        ...service,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  batch.set(markerRef, {
    initializedAt: serverTimestamp(),
  });

  await batch.commit();
};

export const subscribeToServices = (onServices, onError) =>
  onSnapshot(
    collection(db, "services"),
    (snapshot) => {
      const services = snapshot.docs.map((serviceDoc) => ({
        id: serviceDoc.id,
        ...serviceDoc.data(),
      }));

      onServices(services);
    },
    onError
  );

export const addService = (service) =>
  addDoc(collection(db, "services"), {
    ...service,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

export const updateService = (serviceId, updates) =>
  updateDoc(doc(db, "services", serviceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

export const deleteService = (serviceId) =>
  deleteDoc(doc(db, "services", serviceId));
