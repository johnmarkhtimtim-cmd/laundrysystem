import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscribeToServices } from "../../services/laundryService";
import {
  getLocalDateKey,
  subscribeToDailyBookingCapacityStatus,
} from "../../services/bookingService";
import { subscribeToGeneralSettings } from "../../services/paymentService";
import { useAuth } from "../../context/AuthContext";

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey)
    .split("-")
    .map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "../../styles/BookNow.css";

// Vite doesn't bundle Leaflet's default marker images, so point to the CDN.
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PICKUP_START_TIME = "08:00";
const PICKUP_END_TIME = "16:00";

// ======================================================
// PICKUP OPTIONS
// ======================================================

const PICKUP_OPTIONS = [
  {
    name: "Pickup & Delivery",
    fee: 30,
    icon: "🚚",
    description: "We pick up and deliver your laundry.",
  },
  {
    name: "Pickup Only",
    fee: 15,
    icon: "📦",
    description: "Your laundry will be prepared for pickup.",
  },
];

// ======================================================
// DEFAULT LOCATION
// ======================================================

const DEFAULT_LOCATION = {
  latitude: 17.04,
  longitude: 121.85,
};

// ======================================================
// MAP CENTER CONTROLLER
// ======================================================

function MapCenterController({ latitude, longitude }) {
  const map = useMapEvents({});

  useEffect(() => {
    map.setView([latitude, longitude], 17, {
      animate: true,
    });
  }, [latitude, longitude, map]);

  return null;
}

// ======================================================
// MAP LOCATION MARKER
// ======================================================

function LocationMarker({
  latitude,
  longitude,
  onLocationChange,
}) {
  useMapEvents({
    click(event) {
      onLocationChange(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return (
    <Marker
      position={[latitude, longitude]}
      draggable={true}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target;
          const position = marker.getLatLng();

          onLocationChange(
            position.lat,
            position.lng
          );
        },
      }}
    >
      <Popup>
        <strong>Pickup Location</strong>
        <br />
        Drag the marker or click the map to change
        the location.
      </Popup>
    </Marker>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function BookNow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // ====================================================
  // FORM STATE
  // ====================================================

  const [services, setServices] = useState(() => {
    const requestedService = searchParams.get("service");
    return requestedService ? [requestedService] : [];
  });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [serviceLoadError, setServiceLoadError] = useState("");
  const [pickup, setPickup] = useState("");

  const [schedule, setSchedule] = useState(
    () => getLocalDateKey() || new Date().toISOString().slice(0, 10)
  );
  const [pickupWindow, setPickupWindow] = useState("Same day");
  const [capacityStatus, setCapacityStatus] = useState(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [time, setTime] = useState("");

  // Admin "Same day" / "Next day" → exactly one selectable pickup date
  const allowedPickupDate = useMemo(() => {
    const todayKey = getLocalDateKey() || new Date().toISOString().slice(0, 10);
    if (String(pickupWindow).toLowerCase().includes("next")) {
      return addDaysToDateKey(todayKey, 1) || todayKey;
    }
    return todayKey;
  }, [pickupWindow]);
  const isTimeUnavailable =
    Boolean(time) &&
    (time < PICKUP_START_TIME || time > PICKUP_END_TIME);

  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [landmark, setLandmark] = useState("");

  const [latitude, setLatitude] = useState(
    DEFAULT_LOCATION.latitude
  );

  const [longitude, setLongitude] = useState(
    DEFAULT_LOCATION.longitude
  );

  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  const [showMap, setShowMap] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isLocating, setIsLocating] =
    useState(false);

  const [locationPermissionIssue, setLocationPermissionIssue] =
    useState(false);

  // ====================================================
  // PRICE CALCULATION
  // ====================================================

  const laundryTotal = services.reduce(
    (total, serviceName) => {
      const service = serviceOptions.find(
        (item) => item.name === serviceName
      );

      return total + (Number(service?.price) || 0);
    },
    0
  );

  const selectedPickup = PICKUP_OPTIONS.find(
    (item) => item.name === pickup
  );

  const deliveryFee = selectedPickup?.fee || 0;

  const estimatedTotal =
    laundryTotal + deliveryFee;

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    Promise.resolve().then(() => {
      if (!isMounted) return;

      try {
        unsubscribe = subscribeToServices(
          (allServices) => {
            if (!isMounted) return;

            const activeServices = allServices.filter(
              (service) => service.status === "Active"
            );

            setServiceOptions(activeServices);
            setServices((selectedServices) =>
              selectedServices.filter((selectedName) =>
                activeServices.some(
                  (service) => service.name === selectedName
                )
              )
            );
            setIsLoadingServices(false);
            setServiceLoadError("");
          },
          (loadError) => {
            if (!isMounted) return;

            console.error("Error loading booking services:", loadError);
            setServiceLoadError(
              "Unable to load available services. Please refresh and try again."
            );
            setIsLoadingServices(false);
          }
        );
      } catch (loadError) {
        if (!isMounted) return;

        console.error("Error initializing booking services:", loadError);
        setServiceLoadError(
          "Unable to load available services. Please refresh and try again."
        );
        setIsLoadingServices(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // ====================================================
  // HELPERS
  // ====================================================

  const formatCurrency = (amount) => {
    return `₱${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Not selected";
    }

    const date = new Date(
      `${dateValue}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const locationText =
    [
      address,
      barangay,
      city,
      province,
    ]
      .filter(
        (item) =>
          item && item.trim()
      )
      .join(", ") ||
    "Not provided";

  // ====================================================
  // SELECT SERVICE
  // ====================================================

  const toggleService = (serviceName) => {
    setError("");

    setServices((currentServices) => {
      if (
        currentServices.includes(serviceName)
      ) {
        return currentServices.filter(
          (service) =>
            service !== serviceName
        );
      }

      return [
        ...currentServices,
        serviceName,
      ];
    });
  };

  // ====================================================
  // SELECT PICKUP
  // ====================================================

  const handlePickupChange = (pickupType) => {
    setError("");
    setPickup(pickupType);
  };

  // ====================================================
  // REVERSE GEOCODING
  // ====================================================

  const reverseGeocode = async (
    lat,
    lng
  ) => {
    const PH_REGIONS = new Set([
      "ilocos region",
      "cagayan valley",
      "central luzon",
      "calabarzon",
      "mimaropa",
      "bicol region",
      "western visayas",
      "central visayas",
      "eastern visayas",
      "zamboanga peninsula",
      "northern mindanao",
      "davao region",
      "soccsksargen",
      "caraga",
      "cordillera administrative region",
      "national capital region",
      "metro manila",
      "bangsamoro autonomous region in muslim mindanao",
    ]);

    const cleanPart = (val) =>
      val ? String(val).replace(/\s+/g, " ").trim() : "";

    const isRegionName = (val) => {
      const cleaned = cleanPart(val).toLowerCase();
      if (!cleaned) return false;
      if (
        cleaned === "national capital region" ||
        cleaned === "metro manila"
      ) {
        return false;
      }
      return (
        PH_REGIONS.has(cleaned) ||
        /^region\s+[ivx0-9]+/i.test(cleaned)
      );
    };

    try {
      const [nomRes, bdcRes] = await Promise.allSettled([
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        ).then((r) => (r.ok ? r.json() : null)),
      ]);

      const nomData =
        nomRes.status === "fulfilled" ? nomRes.value : null;
      const bdcData =
        bdcRes.status === "fulfilled" ? bdcRes.value : null;

      const location = nomData?.address || {};
      const displayParts = String(nomData?.display_name || "")
        .split(",")
        .map((part) => cleanPart(part))
        .filter(
          (part) =>
            part &&
            !/^philippines$/i.test(part) &&
            !/^\d{4}$/.test(part)
        );

      const adminList = Array.isArray(
        bdcData?.localityInfo?.administrative
      )
        ? bdcData.localityInfo.administrative
        : [];

      const bdcProvince = cleanPart(
        adminList.find(
          (item) =>
            (item.adminLevel === 5 ||
              /province/i.test(item.description || "")) &&
            !isRegionName(item.name)
        )?.name ||
          (!isRegionName(bdcData?.principalSubdivision)
            ? bdcData?.principalSubdivision
            : "")
      );

      // 1. PROVINCE
      const provinceCandidates = [
        location.province,
        location.state_district,
        !isRegionName(location.state) ? location.state : "",
        bdcProvince,
        !isRegionName(location.county) ? location.county : "",
        location.state,
        bdcData?.principalSubdivision,
        location.region,
      ]
        .map(cleanPart)
        .filter(Boolean);

      const provinceValue = provinceCandidates[0] || "";

      // 2. CITY / MUNICIPALITY
      const bdcCity = cleanPart(
        (!isRegionName(bdcData?.city) &&
        cleanPart(bdcData?.city).toLowerCase() !==
          provinceValue.toLowerCase()
          ? bdcData?.city
          : "") ||
          adminList.find(
            (item) =>
              (item.adminLevel === 6 ||
                item.adminLevel === 7 ||
                /municipality|city/i.test(
                  item.description || ""
                )) &&
              cleanPart(item.name).toLowerCase() !==
                provinceValue.toLowerCase() &&
              !isRegionName(item.name)
          )?.name
      );

      const cityCandidates = [
        location.city,
        location.town,
        location.municipality,
        location.city_district,
        bdcCity,
        location.county &&
        cleanPart(location.county).toLowerCase() !==
          provinceValue.toLowerCase() &&
        !isRegionName(location.county)
          ? location.county
          : "",
        bdcData?.locality &&
        cleanPart(bdcData?.locality).toLowerCase() !==
          provinceValue.toLowerCase()
          ? bdcData?.locality
          : "",
        location.village,
        location.suburb,
        location.hamlet,
      ]
        .map(cleanPart)
        .filter(Boolean);

      let cityValue = cityCandidates[0] || "";

      if (!cityValue && displayParts.length > 0) {
        const provIdx = displayParts.findIndex(
          (p) =>
            p.toLowerCase() === provinceValue.toLowerCase()
        );
        if (provIdx > 0) {
          cityValue = displayParts[provIdx - 1];
        } else {
          cityValue =
            displayParts.find(
              (p) =>
                !isRegionName(p) &&
                p.toLowerCase() !== provinceValue.toLowerCase()
            ) || "";
        }
      }

      // 3. BARANGAY
      const bdcBarangay = cleanPart(
        adminList.find(
          (item) =>
            (item.adminLevel >= 8 ||
              /barangay|village|suburb|locality/i.test(
                item.description || ""
              )) &&
            cleanPart(item.name).toLowerCase() !==
              cityValue.toLowerCase() &&
            cleanPart(item.name).toLowerCase() !==
              provinceValue.toLowerCase()
        )?.name ||
          (bdcData?.locality &&
          cleanPart(bdcData?.locality).toLowerCase() !==
            cityValue.toLowerCase() &&
          cleanPart(bdcData?.locality).toLowerCase() !==
            provinceValue.toLowerCase()
            ? bdcData.locality
            : "")
      );

      const barangayCandidates = [
        location.suburb,
        location.village,
        location.quarter,
        location.neighbourhood,
        location.hamlet,
        location.residential,
        location.district,
        bdcBarangay,
      ]
        .map(cleanPart)
        .filter(Boolean);

      let barangayValue =
        barangayCandidates.find(
          (b) => b.toLowerCase() !== cityValue.toLowerCase()
        ) ||
        barangayCandidates[0] ||
        "";

      if (!barangayValue && displayParts.length > 1) {
        const cityIdx = displayParts.findIndex(
          (p) => p.toLowerCase() === cityValue.toLowerCase()
        );
        if (cityIdx > 0) {
          barangayValue = displayParts[cityIdx - 1];
        }
      }
      if (!barangayValue) {
        barangayValue = cityValue || provinceValue;
      }

      // 4. STREET / ADDRESS
      const streetLine = [
        cleanPart(location.house_number),
        cleanPart(
          location.road ||
            location.street ||
            location.pedestrian ||
            location.footway ||
            location.path ||
            location.highway
        ),
      ]
        .filter(Boolean)
        .join(" ");

      const placeName = cleanPart(
        nomData?.name ||
          location.amenity ||
          location.building ||
          location.shop ||
          location.office ||
          location.tourism ||
          location.leisure ||
          location.historic
      );

      let road =
        streetLine ||
        (placeName &&
        placeName.toLowerCase() !== barangayValue.toLowerCase() &&
        placeName.toLowerCase() !== cityValue.toLowerCase()
          ? placeName
          : "") ||
        cleanPart(location.neighbourhood) ||
        "";

      if (!road && displayParts.length > 0) {
        const firstPart = displayParts[0];
        if (
          firstPart &&
          firstPart.toLowerCase() !== provinceValue.toLowerCase() &&
          !isRegionName(firstPart)
        ) {
          road = firstPart;
        }
      }
      if (!road) {
        road =
          [barangayValue, cityValue].filter(Boolean).join(", ") ||
          `Lat ${Number(lat).toFixed(5)}, Lng ${Number(lng).toFixed(5)}`;
      }

      // 5. LANDMARK (optional helper)
      const landmarkCandidate =
        placeName ||
        (streetLine && road !== streetLine ? streetLine : "");

      setAddress(road);
      setBarangay(barangayValue);
      setCity(cityValue || barangayValue);
      setProvince(provinceValue || cityValue);
      if (landmarkCandidate) {
        setLandmark((prev) => prev || landmarkCandidate);
      }
    } catch (error) {
      console.error(
        "Reverse geocoding error:",
        error
      );
    }
  };

  // ====================================================
  // LOCATION CHANGE
  // ====================================================

  const handleLocationChange = async (
    lat,
    lng
  ) => {
    setLatitude(lat);
    setLongitude(lng);

    await reverseGeocode(lat, lng);
  };

  // ====================================================
  // CURRENT LOCATION
  // ====================================================

  const openPermissionSettings = () => {
    if (typeof window !== "undefined" && window.LaundryMateAndroid?.requestAllPermissions) {
      window.LaundryMateAndroid.requestAllPermissions();
      return;
    }
    if (typeof window !== "undefined" && window.LaundryMateAndroid?.openAppSettings) {
      window.LaundryMateAndroid.openAppSettings();
      return;
    }
    if (typeof window !== "undefined" && window.LaundryMateAndroid?.requestCurrentLocation) {
      window.LaundryMateAndroid.requestCurrentLocation();
      return;
    }
    detectCurrentLocation();
  };

  const openDeviceLocationSettings = () => {
    if (typeof window !== "undefined" && window.LaundryMateAndroid?.openLocationSettings) {
      window.LaundryMateAndroid.openLocationSettings();
      return;
    }
    openPermissionSettings();
  };

  const applyDetectedCoordinates = async (lat, lng, accuracy = null) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setLatitude(lat);
    setLongitude(lng);
    if (accuracy !== null && Number.isFinite(accuracy)) {
      setGpsAccuracy(accuracy);
    }
    setShowMap(true);
    setIsLocating(false);
    setLocationPermissionIssue(false);
    setError("");

    await reverseGeocode(lat, lng);
  };

  const requestGeolocationCoordinates = () => {
    let resolved = false;
    let bestAccuracy = Infinity;

    const safetyTimer = window.setTimeout(() => {
      if (!resolved) {
        setIsLocating(false);
        setShowMap(true);
        setLocationPermissionIssue(true);
        setError(
          "Could not get a GPS fix in time. Please ensure Location/GPS is turned on, or tap the map below to set your pickup location."
        );
      }
    }, 10000);

    const handleSuccess = async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = position.coords.accuracy ?? 100;

      if (!resolved || acc < bestAccuracy) {
        resolved = true;
        bestAccuracy = acc;
        window.clearTimeout(safetyTimer);
        await applyDetectedCoordinates(lat, lng, acc);
      }
    };

    const handleFailure = (geoError) => {
      if (resolved) return;
      console.error(geoError);

      const isAndroidBridge =
        typeof window !== "undefined" && Boolean(window.LaundryMateAndroid);

      if (geoError?.code === 1 || geoError?.code === 2) {
        setLocationPermissionIssue(true);
      }

      const messages = {
        1: isAndroidBridge
          ? "Location permission was denied. Tap 'Open Settings to Activate Permission' below to enable Location access, or select your location on the map."
          : "Location permission was denied. Allow location access in your browser/app settings, or select your location on the map.",
        2: isAndroidBridge
          ? "Your location is currently unavailable. Please turn on device Location (GPS) in Settings, or select your location on the map."
          : "Your location is currently unavailable. Please turn on device Location (GPS) or select your location on the map.",
        3: "Getting your location timed out. Please try again or select your location on the map.",
      };

      window.clearTimeout(safetyTimer);
      setError(
        messages[geoError?.code] ||
          "Unable to get your current location. Please select your location on the map."
      );
      setShowMap(true);
      setIsLocating(false);
    };

    // 1. Fast network / Wi-Fi / cell / fused location (resolves in < 1s on mobile)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (fastError) => {
        if (fastError?.code === 1 && !resolved) {
          handleFailure(fastError);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000,
      }
    );

    // 2. Parallel high-accuracy GPS fix to refine coordinates
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (gpsError) => {
        if (!resolved) {
          handleFailure(gpsError);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 15000,
      }
    );
  };

  const locationCallbacksRef = useRef({
    applyDetectedCoordinates,
    requestGeolocationCoordinates,
  });
  useEffect(() => {
    locationCallbacksRef.current = {
      applyDetectedCoordinates,
      requestGeolocationCoordinates,
    };
  });

  const detectCurrentLocation = () => {
    setError("");
    setLocationPermissionIssue(false);

    const hasAndroidNativeLocation =
      typeof window !== "undefined" &&
      typeof window.LaundryMateAndroid?.requestCurrentLocation === "function";

    if (!navigator.geolocation && !hasAndroidNativeLocation) {
      setError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    setIsLocating(true);
    setShowMap(true);

    // If running inside the Android APK, immediately request native Android LocationManager coordinates
    if (hasAndroidNativeLocation) {
      window.LaundryMateAndroid.requestCurrentLocation();
    }

    // Also run Web Geolocation in parallel if available
    if (navigator.geolocation && window.isSecureContext) {
      requestGeolocationCoordinates();
    }
  };

  useEffect(() => {
    const onNativeLocation = (event) => {
      const detail = event?.detail;
      if (
        detail &&
        Number.isFinite(Number(detail.latitude)) &&
        Number.isFinite(Number(detail.longitude))
      ) {
        locationCallbacksRef.current.applyDetectedCoordinates(
          Number(detail.latitude),
          Number(detail.longitude),
          Number(detail.accuracy)
        );
      }
    };

    const onNativeLocationError = (event) => {
      const code = event?.detail?.code;
      setIsLocating(false);
      setShowMap(true);
      setLocationPermissionIssue(true);
      if (code === 1) {
        setError(
          "Location permission was denied. Tap 'Open Settings to Activate Permission' below to enable Location access, or select your location on the map."
        );
      } else {
        setError(
          "Device Location (GPS) is turned off or unavailable. Tap 'Turn On Device Location' below, or select your location on the map."
        );
      }
    };

    const onAndroidPermissionResult = (event) => {
      if (event?.detail?.granted) {
        setLocationPermissionIssue(false);
        setError("");
        setIsLocating(true);
        setShowMap(true);
        if (typeof window.LaundryMateAndroid?.requestCurrentLocation === "function") {
          window.LaundryMateAndroid.requestCurrentLocation();
        }
        if (navigator.geolocation && window.isSecureContext) {
          locationCallbacksRef.current.requestGeolocationCoordinates();
        }
      } else if (isLocating) {
        setIsLocating(false);
        setLocationPermissionIssue(true);
        setError(
          "Location permission was denied. Tap 'Open Settings to Activate Permission' below to enable Location access, or select your location on the map."
        );
      }
    };

    const onVisibilityOrFocus = () => {
      if (
        document.visibilityState === "visible" &&
        locationPermissionIssue &&
        typeof window !== "undefined" &&
        typeof window.LaundryMateAndroid?.hasLocationPermission === "function" &&
        window.LaundryMateAndroid.hasLocationPermission()
      ) {
        setLocationPermissionIssue(false);
        setError("");
        setIsLocating(true);
        setShowMap(true);
        if (typeof window.LaundryMateAndroid?.requestCurrentLocation === "function") {
          window.LaundryMateAndroid.requestCurrentLocation();
        }
        if (navigator.geolocation && window.isSecureContext) {
          locationCallbacksRef.current.requestGeolocationCoordinates();
        }
      }
    };

    window.addEventListener("laundrymateNativeLocation", onNativeLocation);
    window.addEventListener(
      "laundrymateNativeLocationError",
      onNativeLocationError
    );
    window.addEventListener(
      "laundrymateLocationPermissionResult",
      onAndroidPermissionResult
    );
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      window.removeEventListener("laundrymateNativeLocation", onNativeLocation);
      window.removeEventListener(
        "laundrymateNativeLocationError",
        onNativeLocationError
      );
      window.removeEventListener(
        "laundrymateLocationPermissionResult",
        onAndroidPermissionResult
      );
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [locationPermissionIssue, isLocating]);

  // ====================================================
  
  // Live capacity — updates when admin changes max bookings (no refresh)
  useEffect(() => {
    if (!schedule) {
      return undefined;
    }

    return subscribeToDailyBookingCapacityStatus(
      schedule,
      (status) => {
        setCapacityStatus(status);
        setCapacityLoading(false);
      },
      (loadError) => {
        console.error("Unable to load booking capacity:", loadError);
        setCapacityStatus(null);
        setCapacityLoading(false);
      }
    );
  }, [schedule]);

  // Live general settings — pickup window / max bookings without refresh
  useEffect(() => {
    return subscribeToGeneralSettings(
      (settings) => {
        const nextWindow = settings?.pickupWindow || "Same day";
        setPickupWindow(nextWindow);
        const todayKey =
          getLocalDateKey() || new Date().toISOString().slice(0, 10);
        const nextAllowed = String(nextWindow).toLowerCase().includes("next")
          ? addDaysToDateKey(todayKey, 1) || todayKey
          : todayKey;
        setSchedule((current) =>
          current === nextAllowed ? current : nextAllowed
        );
      },
      (settingsError) => {
        console.error("Unable to load pickup window settings:", settingsError);
      }
    );
  }, []);

  // SUBMIT BOOKING
  // ====================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (services.length === 0) {
      setError(
        "Please select at least one laundry service."
      );
      return;
    }

    if (!pickup) {
      setError(
        "Please select a pickup option."
      );
      return;
    }

    if (!schedule) {
      setError(
        "Please select a pickup date."
      );
      return;
    }

    if (schedule !== allowedPickupDate) {
      setError(
        pickupWindow === "Next day"
          ? "Pickup is next-day only. Please use tomorrow's date."
          : "Pickup is same-day only. Please use today's date."
      );
      setSchedule(allowedPickupDate);
      return;
    }

    if (!time) {
      setError(
        "Please select a pickup time."
      );
      return;
    }

    if (isTimeUnavailable) {
      setError(
        "Not available. Pickup time must be between 8:00 AM and 4:00 PM."
      );
      return;
    }

    if (capacityStatus?.isFull) {
      setError(
        "Bookings are full for the selected date. Please choose another pickup date."
      );
      return;
    }

    if (!address.trim()) {
      setError(
        "Please enter your pickup address."
      );
      return;
    }

    if (!barangay.trim()) {
      setError(
        "Please enter your barangay."
      );
      return;
    }

    if (!city.trim()) {
      setError(
        "Please enter your city or municipality."
      );
      return;
    }

    if (!province.trim()) {
      setError(
        "Please enter your province."
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // -----------------------------------------------
      // BOOKING ID
      // -----------------------------------------------

      // -----------------------------------------------
      // BOOKING DATA
      // -----------------------------------------------

      const pendingBookingDraft = {
        id: "__draft_booking__",
        booking_id: "__draft_booking__",
        isDraft: true,
        userId: user.uid,
        customer_id: user.uid,
        customer_name:
          [user?.firstName, user?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          user?.name ||
          user?.fullName ||
          user?.displayName ||
          user?.email?.split("@")[0] ||
          "Customer",

        contactNumber:
          user?.phone ||
          user?.phoneNumber ||
          user?.contactNumber ||
          "",

        services,

        schedule,
        pickup_date: schedule,
        time,

        pickupType: pickup,

        address,
        barangay,
        city,
        province,
        landmark,

        latitude,
        longitude,
        gpsAccuracy,

        laundrySubtotal: laundryTotal,

        deliveryFee,

        estimatedTotal,
        total_amount: estimatedTotal,

        status: "Pending",
        payment_status: "Unpaid",

        createdAt: new Date().toISOString(),
      };

      // -----------------------------------------------
      // CONTINUE TO PAYMENT ONLY (DO NOT WRITE TO FIRESTORE YET)
      // Actual booking & payment creation happens on Confirm Payment.
      // -----------------------------------------------

      try {
        sessionStorage.setItem(
          `laundrymate_pending_booking_draft_${user.uid}`,
          JSON.stringify(pendingBookingDraft)
        );
      } catch {
        // Ignore storage quota errors; router state still carries the draft.
      }

      navigate("/customer/payments", {
        state: { pendingBookingDraft },
      });

    } catch (error) {
      console.error(
        "Booking error:",
        error
      );

      {
        const message = String(error?.message || "");
        const code = String(error?.code || "");
        if (
          message.toLowerCase().includes("full") ||
          message.toLowerCase().includes("closed") ||
          message.toLowerCase().includes("max bookings")
        ) {
          setError(message);
        } else if (
          code.includes("permission") ||
          message.toLowerCase().includes("permission")
        ) {
          setError(
            "Booking was blocked by permissions. Please sign out, sign in again, then retry."
          );
        } else if (message) {
          setError(message);
        } else {
          setError(
            "Something went wrong while saving your booking. Please try again."
          );
        }
      }

      setIsSubmitting(false);
    }
  };

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="booknow-page">

      <div className="booknow-container">

        {/* ==================================================
            PAGE HEADER
        ================================================== */}

        <header className="booknow-header">

          <span className="page-label">
            CUSTOMER PORTAL
          </span>

          <h1>
            Book Laundry Service
          </h1>

          <p>
            Select your laundry service,
            pickup schedule, and location.
          </p>

        </header>

        {serviceLoadError && (
          <div className="form-alert error-alert" role="alert">
            <span className="alert-icon">!</span>
            <div>
              <strong>Services unavailable</strong>
              <p>{serviceLoadError}</p>
            </div>
          </div>
        )}

        {/* ==================================================
            ERROR MESSAGE
        ================================================== */}

        {error && (
          <div className="form-alert error-alert">

            <span className="alert-icon">
              !
            </span>

            <div>

              <strong>
                Please check your booking
              </strong>

              <p>
                {error}
              </p>

              {locationPermissionIssue && (
                <div className="permission-action-row">
                  <button
                    type="button"
                    className="permission-settings-btn"
                    onClick={openPermissionSettings}
                  >
                    ⚙️ Open Settings to Activate Permission
                  </button>
                  {typeof window !== "undefined" &&
                    window.LaundryMateAndroid?.openLocationSettings && (
                      <button
                        type="button"
                        className="permission-settings-btn secondary"
                        onClick={openDeviceLocationSettings}
                      >
                        📍 Turn On Device Location
                      </button>
                    )}
                </div>
              )}

            </div>

          </div>
        )}

        {/* ==================================================
            SUCCESS MESSAGE
        ================================================== */}

        {message && (
          <div className="form-alert success-alert">

            <span className="alert-icon">
              ✓
            </span>

            <div>

              <strong>
                Success
              </strong>

              <p>
                {message}
              </p>

            </div>

          </div>
        )}

        {/* ==================================================
            BOOKING FORM
        ================================================== */}

        <form
          className="booking-layout"
          onSubmit={handleSubmit}
        >

          {/* ==================================================
              LEFT CONTENT
          ================================================== */}

          <main className="booking-content">

            {/* ==================================================
                STEP 1 - SERVICES
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  1
                </div>

                <div>

                  <h2>
                    Select Laundry Services
                  </h2>

                  <p>
                    Choose the services you need.
                  </p>

                </div>

              </div>

              <div className="service-grid">

                {isLoadingServices ? (
                  <p>Loading available services...</p>
                ) : serviceOptions.length === 0 ? (
                  <p>No services are currently available.</p>
                ) : serviceOptions.map(
                  (service) => {

                    const isSelected =
                      services.includes(
                        service.name
                      );

                    return (
                      <button
                        type="button"
                        key={service.name}
                        className={`service-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          toggleService(
                            service.name
                          )
                        }
                      >

                        <div className="service-icon">
                          {service.icon}
                        </div>

                        <div className="service-information">

                          <h3>
                            {service.name}
                          </h3>

                          <p>
                            {service.description}
                          </p>

                          <strong>
                            {formatCurrency(
                              service.price
                            )}
                          </strong>

                        </div>

                        <div className="service-check">
                          {isSelected
                            ? "✓"
                            : ""}
                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </section>

            {/* ==================================================
                STEP 2 - PICKUP
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  2
                </div>

                <div>

                  <h2>
                    Pickup Option
                  </h2>

                  <p>
                    Select how you want your laundry handled.
                  </p>

                </div>

              </div>

              <div className="pickup-grid">

                {PICKUP_OPTIONS.map(
                  (option) => {

                    const isSelected =
                      pickup ===
                      option.name;

                    return (
                      <button
                        type="button"
                        key={option.name}
                        className={`pickup-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          handlePickupChange(
                            option.name
                          )
                        }
                      >

                        <div className="pickup-icon">
                          {option.icon}
                        </div>

                        <div className="pickup-information">

                          <h3>
                            {option.name}
                          </h3>

                          <p>
                            {option.description}
                          </p>

                          <strong>
                            {option.fee === 0
                              ? "Free"
                              : `${formatCurrency(
                                  option.fee
                                )} fee`}
                          </strong>

                        </div>

                        <div className="radio-check">
                          {isSelected
                            ? "✓"
                            : ""}
                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </section>

            {/* ==================================================
                STEP 3 - SCHEDULE
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  3
                </div>

                <div>

                  <h2>
                    Pickup Schedule
                  </h2>

                  <p>
                    {pickupWindow === "Next day"
                      ? "Next-day pickup only — choose a time (8:00 AM – 4:00 PM)."
                      : "Same-day pickup only — choose a time (8:00 AM – 4:00 PM)."}
                  </p>

                </div>

              </div>

              <div className="form-grid two-columns">

                <div className="form-group">

                  <label htmlFor="schedule">
                    Pickup Date
                  </label>

                  <input
                    id="schedule"
                    type="date"
                    value={schedule || allowedPickupDate}
                    min={allowedPickupDate}
                    max={allowedPickupDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setSchedule(
                        nextDate === allowedPickupDate
                          ? nextDate
                          : allowedPickupDate
                      );
                    }}
                  />
                  <p className="field-hint">
                    {pickupWindow === "Next day"
                      ? "Only tomorrow is available for pickup."
                      : "Only today is available for pickup."}
                  </p>

                </div>

                <div className="form-group">

                  <label htmlFor="time">
                    Pickup Time
                  </label>

                  <input
                    id="time"
                    type="time"
                    min={PICKUP_START_TIME}
                    max={PICKUP_END_TIME}
                    value={time}
                    aria-invalid={isTimeUnavailable}
                    className={
                      isTimeUnavailable
                        ? "time-unavailable"
                        : undefined
                    }
                    onChange={(event) =>
                      setTime(
                        event.target.value
                      )
                    }
                  />

                  {isTimeUnavailable && (
                    <p
                      className="time-unavailable-text"
                      role="alert"
                    >
                      Not available. Pickup is only
                      from 8:00 AM to 4:00 PM.
                    </p>
                  )}

                </div>

              </div>

              {schedule && (
                <div
                  className={
                    "capacity-banner" +
                    (capacityStatus?.isFull ? " capacity-full" : "")
                  }
                  role="status"
                >
                  {capacityLoading || !capacityStatus ? (
                    <p>Checking daily booking capacity...</p>
                  ) : capacityStatus.closed || capacityStatus.max <= 0 ? (
                    <p>
                      Bookings are closed right now (max bookings is 0). Please
                      try again later.
                    </p>
                  ) : capacityStatus.isFull ? (
                    <p>
                      Bookings are full for this date ({capacityStatus.used}/
                      {capacityStatus.max}). Please try again later.
                    </p>
                  ) : (
                    <p>
                      Capacity for this date: {capacityStatus.used}/
                      {capacityStatus.max} used · {capacityStatus.remaining}{" "}
                      remaining
                    </p>
                  )}
                </div>
              )}

            </section>

            {/* ==================================================
                STEP 4 - LOCATION
            ================================================== */}

            <section className="booking-card">

              <div className="card-heading">

                <div className="step-number">
                  4
                </div>

                <div>

                  <h2>
                    Pickup Location
                  </h2>

                  <p>
                    Provide the location for your laundry pickup.
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="location-button"
                onClick={
                  detectCurrentLocation
                }
                disabled={
                  isLocating
                }
              >

                <span>
                  📍
                </span>

                {isLocating
                  ? "Getting your location..."
                  : "Use My Current Location"}

              </button>

              {locationPermissionIssue && (
                <div className="permission-action-row step-permission-row">
                  <button
                    type="button"
                    className="permission-settings-btn"
                    onClick={openPermissionSettings}
                  >
                    ⚙️ Open Settings to Activate Permission
                  </button>
                  {typeof window !== "undefined" &&
                    window.LaundryMateAndroid?.openLocationSettings && (
                      <button
                        type="button"
                        className="permission-settings-btn secondary"
                        onClick={openDeviceLocationSettings}
                      >
                        📍 Turn On Device Location
                      </button>
                    )}
                </div>
              )}

              {/* MAP */}

              {showMap && (
                <div className="map-wrapper">

                  <MapContainer
                    center={[
                      latitude,
                      longitude,
                    ]}
                    zoom={17}
                    scrollWheelZoom={true}
                    className="location-map"
                  >

                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapCenterController
                      latitude={latitude}
                      longitude={longitude}
                    />

                    <LocationMarker
                      latitude={latitude}
                      longitude={longitude}
                      onLocationChange={
                        handleLocationChange
                      }
                    />

                  </MapContainer>

                  <div className="map-help">
                    Click the map or drag
                    the marker to set your
                    pickup location.
                  </div>

                </div>
              )}

              {/* LOCATION FIELDS */}

              <div className="form-grid">

                <div className="form-group">

                  <label htmlFor="address">
                    Address
                  </label>

                  <input
                    id="address"
                    type="text"
                    value={address}
                    placeholder="House number, street"
                    onChange={(event) =>
                      setAddress(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="barangay">
                    Barangay
                  </label>

                  <input
                    id="barangay"
                    type="text"
                    value={barangay}
                    placeholder="Enter barangay"
                    onChange={(event) =>
                      setBarangay(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="city">
                    City / Municipality
                  </label>

                  <input
                    id="city"
                    type="text"
                    value={city}
                    placeholder="Enter city or municipality"
                    onChange={(event) =>
                      setCity(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group">

                  <label htmlFor="province">
                    Province
                  </label>

                  <input
                    id="province"
                    type="text"
                    value={province}
                    placeholder="Enter province"
                    onChange={(event) =>
                      setProvince(
                        event.target.value
                      )
                    }
                  />

                </div>

                <div className="form-group full-width">

                  <label htmlFor="landmark">

                    Landmark

                    <span className="optional">
                      Optional
                    </span>

                  </label>

                  <input
                    id="landmark"
                    type="text"
                    value={landmark}
                    placeholder="Example: Near the public market"
                    onChange={(event) =>
                      setLandmark(
                        event.target.value
                      )
                    }
                  />

                </div>

              </div>

              {gpsAccuracy && (
                <div className="gps-info">
                  📍 GPS accuracy: approximately{" "}
                  {Math.round(
                    gpsAccuracy
                  )}{" "}
                  meters
                </div>
              )}

            </section>

          </main>

          {/* ==================================================
              RIGHT SIDE - BOOKING SUMMARY
          ================================================== */}

          <aside className="booking-summary">

            <div className="summary-content">

              {/* ==================================================
                  SELECTED SERVICES
              ================================================== */}

              <div className="summary-block">

                <div className="summary-section-title">

                  <span className="section-icon">
                    🧺
                  </span>

                  <div>

                    <h3>
                      Selected Services
                    </h3>

                    <p>
                      {services.length === 0
                        ? "No service selected"
                        : `${services.length} service${
                            services.length > 1
                              ? "s"
                              : ""
                          } selected`}
                    </p>

                  </div>

                </div>

                {services.length === 0 ? (

                  <div className="summary-empty">

                    <span className="empty-icon">
                      🧺
                    </span>

                    <strong>
                      No service selected
                    </strong>

                    <p>
                      Select a laundry service to continue.
                    </p>

                  </div>

                ) : (

                  <div className="summary-service-list">

                    {services.map(
                      (serviceName) => {

                        const service =
                          serviceOptions.find(
                            (item) =>
                              item.name ===
                              serviceName
                          );

                        return (
                          <div
                            className="summary-service-item"
                            key={serviceName}
                          >

                            <div className="summary-service-info">

                              <div className="summary-service-icon">
                                {service?.icon ||
                                  "🧺"}
                              </div>

                              <div className="summary-service-text">

                                <strong>
                                  {serviceName}
                                </strong>

                                <span>
                                  Laundry service
                                </span>

                              </div>

                            </div>

                            <strong className="summary-service-price">
                              {formatCurrency(
                                service?.price ||
                                  0
                              )}
                            </strong>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              {/* ==================================================
                  BOOKING DETAILS
              ================================================== */}

              <div className="summary-block">

                <div className="summary-section-title">

                  <span className="section-icon">
                    📋
                  </span>

                  <div>

                    <h3>
                      Booking Details
                    </h3>

                    <p>
                      Your pickup information
                    </p>

                  </div>

                </div>

                <div className="summary-details">

                  {/* Pickup Type */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        🚚
                      </span>

                      <span>
                        Pickup Type
                      </span>

                    </div>

                    <strong>
                      {pickup ||
                        "Not selected"}
                    </strong>

                  </div>

                  {/* Date */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        📅
                      </span>

                      <span>
                        Pickup Date
                      </span>

                    </div>

                    <strong>
                      {formatDate(
                        schedule
                      )}
                    </strong>

                  </div>

                  {/* Time */}

                  <div className="summary-detail-row">

                    <div className="detail-label">

                      <span className="detail-icon">
                        🕐
                      </span>

                      <span>
                        Pickup Time
                      </span>

                    </div>

                    <strong>
                      {time ||
                        "Not selected"}
                    </strong>

                  </div>

                  {/* Location */}

                  <div className="summary-detail-row detail-row-location">

                    <div className="detail-label">

                      <span className="detail-icon">
                        📍
                      </span>

                      <span>
                        Pickup Location
                      </span>

                    </div>

                    <strong>
                      {locationText}
                    </strong>

                  </div>

                  {/* Landmark */}

                  {landmark.trim() && (
                    <div className="summary-detail-row">

                      <div className="detail-label">

                        <span className="detail-icon">
                          🏷️
                        </span>

                        <span>
                          Landmark
                        </span>

                      </div>

                      <strong>
                        {landmark}
                      </strong>

                    </div>
                  )}

                </div>

              </div>

              {/* ==================================================
                  PAYMENT SUMMARY
              ================================================== */}

              <div className="summary-pricing">

                <div className="pricing-title">
                  Payment Summary
                </div>

                <div className="price-row">

                  <span>
                    Services
                  </span>

                  <strong>
                    {formatCurrency(
                      laundryTotal
                    )}
                  </strong>

                </div>

                <div className="price-row">

                  <span>
                    {pickup ===
                    "Pickup & Delivery"
                      ? "Pickup & Delivery Fee"
                      : "Pickup Fee"}
                  </span>

                  <strong>
                    {deliveryFee === 0
                      ? "Free"
                      : formatCurrency(
                          deliveryFee
                        )}
                  </strong>

                </div>

                <div className="price-divider"></div>

                <div className="total-row">

                  <div>

                    <span>
                      Total Amount
                    </span>

                    <small>
                      Estimated total
                    </small>

                  </div>

                  <strong>
                    {formatCurrency(
                      estimatedTotal
                    )}
                  </strong>

                </div>

              </div>

              {/* ==================================================
                  MESSAGE
              ================================================== */}

              <div className="summary-message">

                <div className="message-icon">
                  ✓
                </div>

                <div>

                  <strong>
                    Almost ready!
                  </strong>

                  <p>
                    Review your booking information
                    before continuing to payment.
                  </p>

                </div>

              </div>

              {/* ==================================================
                  SUBMIT BUTTON
              ================================================== */}

              <button
                type="submit"
                className="summary-submit"
                disabled={
                  isSubmitting ||
                  services.length === 0 ||
                  capacityStatus?.isFull
                }
              >

                <span>
                  {isSubmitting
                    ? "Continuing to payment..."
                    : "Continue to Payment"}
                </span>

                {!isSubmitting && (
                  <span className="submit-arrow">
                    →
                  </span>
                )}

              </button>

            </div>

          </aside>

        </form>

      </div>

    </div>
  );
}