"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDeviceId,
  getIpAddress,
  isMockLocation,
  requestGeolocation,
} from "@/lib/geolocation";

interface LocationData {
  latitude: number;
  longitude: number;
  gpsAccuracy: number;
  deviceId: string;
  ipAddress: string;
  isMockLocation: boolean;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [locationData, setLocationData] =
    useState<LocationData | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  // ============================================================
  // GET FRESH LOCATION
  // ============================================================

  const getFreshLocation = async (): Promise<LocationData> => {
    const geo = await requestGeolocation();

    const latitude = Number(geo.latitude);
    const longitude = Number(geo.longitude);
    const gpsAccuracy = Number(geo.accuracy);

    // ----------------------------------------------------------
    // IMPORTANT:
    // Do not accept invalid 0,0 coordinates.
    // 0,0 is not a real usable GPS location for this application.
    // ----------------------------------------------------------

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude === 0 ||
      longitude === 0
    ) {
      throw new Error(
        "Invalid GPS coordinates received from the browser."
      );
    }

    if (
      !Number.isFinite(gpsAccuracy) ||
      gpsAccuracy <= 0
    ) {
      throw new Error(
        "Invalid GPS accuracy received from the browser."
      );
    }

    const deviceId = getDeviceId();

    let ipAddress = "unknown";

    try {
      ipAddress = await getIpAddress();
    } catch (error) {
      console.warn(
        "Could not obtain IP address:",
        error
      );
    }

    const mockLocation =
      isMockLocation(gpsAccuracy);

    return {
      latitude,
      longitude,
      gpsAccuracy,
      deviceId,
      ipAddress,
      isMockLocation: mockLocation,
    };
  };

  // ============================================================
  // GET LOCATION WHEN LOGIN PAGE LOADS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const loadLocation = async () => {
      try {
        setLoadingLocation(true);
        setLocationError("");

        const location =
          await getFreshLocation();

        if (!cancelled) {
          setLocationData(location);
        }
      } catch (error) {
        console.warn(
          "Could not obtain location:",
          error
        );

        if (!cancelled) {
          setLocationData(null);

          setLocationError(
            error instanceof Error
              ? error.message
              : "Failed to get location"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingLocation(false);
        }
      }
    };

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setLoading(true);

    let currentLocationData:
      | LocationData
      | null = null;

    try {
      // --------------------------------------------------------
      // ALWAYS GET A FRESH LOCATION BEFORE LOGIN
      //
      // This applies to:
      // - Admin
      // - Restricted users
      // - Unrestricted users / Remote users
      // --------------------------------------------------------

      try {
        setLoadingLocation(true);
        setLocationError("");

        const freshLocation =
          await getFreshLocation();

        currentLocationData = freshLocation;

        setLocationData(freshLocation);
      } catch (locationError) {
        console.warn(
          "Could not obtain location before login:",
          locationError
        );

        currentLocationData = null;

        setLocationData(null);

        setLocationError(
          locationError instanceof Error
            ? locationError.message
            : "Failed to get location"
        );
      } finally {
        setLoadingLocation(false);
      }

      // --------------------------------------------------------
      // LOGIN REQUEST
      //
      // Location is sent for EVERY user type.
      // --------------------------------------------------------

      const res = await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password,

            ...(currentLocationData
              ? {
                latitude:
                  currentLocationData.latitude,

                longitude:
                  currentLocationData.longitude,

                gpsAccuracy:
                  currentLocationData.gpsAccuracy,

                deviceId:
                  currentLocationData.deviceId,

                isMockLocation:
                  currentLocationData.isMockLocation,
              }
              : {}),
          }),
        }
      );

      let data: any = null;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      // --------------------------------------------------------
      // LOGIN ERROR
      // --------------------------------------------------------

      if (!res.ok) {
        if (data?.requiresApproval) {
          setError(
            `${data.message} Please wait — an admin has been notified.`
          );

          return;
        }

        throw new Error(
          data?.error ||
          data?.message ||
          "Login failed"
        );
      }

      // --------------------------------------------------------
      // LOGIN SUCCESS
      // --------------------------------------------------------

      router.push("/admin/employees");
      router.refresh();
    } catch (err) {
      console.error(
        "Login error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="text-center mb-8">
          <img
            src="/images/vmc-logo.png"
            alt="VMC Logo"
            className="h-16 w-auto object-contain mx-auto mb-3"
          />

          <h1 className="text-3xl font-bold text-slate-950">
            VMC
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Sign in to your account
          </p>
        </div>

        {/* ================================================== */}
        {/* FORM */}
        {/* ================================================== */}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4"
        >

          {/* ================================================== */}
          {/* EMAIL */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@company.com"
              autoComplete="email"
            />
          </div>

          {/* ================================================== */}
          {/* PASSWORD */}
          {/* ================================================== */}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          {/* ================================================== */}
          {/* LOCATION STATUS */}
          {/* ================================================== */}

          {loadingLocation && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2">
              <p className="text-sm text-yellow-700">
                📍 Getting your location...
              </p>
            </div>
          )}

          {locationError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-600">
                ⚠️ {locationError}
              </p>

              <p className="text-xs text-red-500 mt-1">
                Location-restricted users may not be
                allowed to login without a valid GPS
                location.
              </p>
            </div>
          )}

          {locationData &&
            !locationError &&
            !loadingLocation && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2">
                <p className="text-sm text-green-600">
                  ✅ Location detected
                </p>

                <p className="text-xs text-green-600 mt-1">
                  Accuracy:{" "}
                  {locationData.gpsAccuracy.toFixed(
                    1
                  )}
                  m
                </p>

                <p className="text-xs text-green-600">
                  Coordinates:{" "}
                  {locationData.latitude.toFixed(
                    6
                  )}
                  ,{" "}
                  {locationData.longitude.toFixed(
                    6
                  )}
                </p>
              </div>
            )}

          {/* ================================================== */}
          {/* LOGIN ERROR */}
          {/* ================================================== */}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
          )}

          {/* ================================================== */}
          {/* SIGN IN BUTTON */}
          {/* ================================================== */}

          <button
            type="submit"
            disabled={
              loading ||
              loadingLocation
            }
            className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Signing in..."
              : loadingLocation
                ? "Getting location..."
                : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}