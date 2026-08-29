"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function WeeklyOffTab() {
  const [selectedDays, setSelectedDays] =
    useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(
          "/api/attendance-settings",
          {
            credentials: "include",
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error ||
            "Failed to load attendance settings"
          );
        }

        // Never allow undefined/object/etc. into selectedDays.
        const weeklyOffDays = Array.isArray(
          data?.weeklyOffDays
        )
          ? data.weeklyOffDays
            .filter(
              (day: unknown): day is number =>
                typeof day === "number" &&
                Number.isInteger(day) &&
                day >= 0 &&
                day <= 6
            )
          : [];

        setSelectedDays(weeklyOffDays);
      } catch (error) {
        console.error(
          "Failed to load attendance settings:",
          error
        );

        setSelectedDays([]);

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load attendance settings"
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      const safePrev = Array.isArray(prev)
        ? prev
        : [];

      return safePrev.includes(day)
        ? safePrev.filter((d) => d !== day)
        : [...safePrev, day];
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const res = await fetch(
        "/api/attendance-settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            weeklyOffDays: selectedDays,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to save"
        );
      }

      toast.success("Weekly off days updated");
    } catch (error) {
      console.error(
        "Failed to save weekly off days:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Select the days of the week that are
        automatically treated as off. These days will
        never count as absent, even if no attendance is
        marked.
      </p>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-7 gap-3 mb-6">
          {dayNames.map((name, index) => {
            const selected =
              Array.isArray(selectedDays) &&
              selectedDays.includes(index);

            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleDay(index)}
                className={
                  selected
                    ? "rounded-md border-2 border-slate-900 bg-slate-50 text-slate-950 text-sm font-semibold py-3 text-center transition-all duration-200"
                    : "rounded-md border-2 border-slate-200 bg-white text-slate-600 text-sm font-medium py-3 text-center hover:border-slate-300 transition-all duration-200"
                }
              >
                {name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : "Save Weekly Off Days"}
        </button>
      </div>
    </div>
  );
}