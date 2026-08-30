"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDeviceId,
  getIpAddress,
  isMockLocation,
  requestGeolocation,
} from "@/lib/geolocation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [locationData, setLocationData] = useState<any>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Request location on component mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        setLoadingLocation(true);

        const geo = await requestGeolocation();
        const ip = await getIpAddress();
        const deviceId = getDeviceId();
        const isMock = isMockLocation(geo.accuracy);

        setLocationData({
          latitude: geo.latitude,
          longitude: geo.longitude,
          gpsAccuracy: geo.accuracy,
          deviceId,
          ipAddress: ip,
          isMockLocation: isMock,
        });
      } catch (error: any) {
        setLocationError(error.message || "Failed to get location");
      } finally {
        setLoadingLocation(false);
      }
    };

    getLocation();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          email,
          password,
          ...(locationData ?? {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresApproval) {
          setError(
            `${data.message} Please wait — an admin has been notified.`
          );
          return;
        }

        throw new Error(data.error || "Login failed");
      }

      router.push("/admin/employees");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/images/vmc-logo.png"
            alt="Vadodara Municipal Corporation"
            className="h-20 w-auto object-contain mb-4"
          />

          <h1 className="text-2xl font-semibold text-slate-800 text-center">
            VMC
          </h1>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Sign in to your account
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="********"
            />
          </div>

          {/* Location Status */}
          {loadingLocation && (
            <p className="text-sm text-yellow-600">
              📍 Getting your location...
            </p>
          )}

          {locationError && (
            <p className="text-sm text-red-600">
              ⚠️ {locationError}. If your user type is location-restricted, login will be denied.
            </p>
          )}

          {locationData && !locationError && (
            <p className="text-sm text-green-600">
              ✅ Location detected (
              {locationData.gpsAccuracy.toFixed(1)}m accuracy)
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2 rounded-md transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}