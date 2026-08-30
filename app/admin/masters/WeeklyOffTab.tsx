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

const weekNumbers = [1, 2, 3, 4, 5];

type WeeklyOffData = Record<string, number[]>;

export default function WeeklyOffTab() {
  const [weeklyOffData, setWeeklyOffData] = useState<WeeklyOffData>({
    "0": [],
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/attendance-settings", {
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load attendance settings");
        }

        // Handle both old and new format for backwards compatibility
        if (typeof data?.weeklyOffDays === "object" && !Array.isArray(data.weeklyOffDays)) {
          setWeeklyOffData(data.weeklyOffDays);
        } else {
          // Old format - convert
          const oldDays = Array.isArray(data?.weeklyOffDays) ? data.weeklyOffDays : [];
          const newFormat: WeeklyOffData = {
            "0": [],
            "1": [],
            "2": [],
            "3": [],
            "4": [],
            "5": [],
            "6": [],
          };

          for (const day of oldDays) {
            newFormat[day.toString()] = [1, 2, 3, 4, 5]; // All weeks
          }

          setWeeklyOffData(newFormat);
        }
      } catch (error) {
        console.error("Failed to load attendance settings:", error);
        setWeeklyOffData({
          "0": [],
          "1": [],
          "2": [],
          "3": [],
          "4": [],
          "5": [],
          "6": [],
        });
        toast.error(
          error instanceof Error ? error.message : "Failed to load attendance settings"
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Toggle week on/off for a specific day
  const toggleWeek = (day: number, week: number) => {
    setWeeklyOffData((prev) => {
      const dayKey = day.toString();
      const currentWeeks = prev[dayKey] || [];

      const newWeeks = currentWeeks.includes(week)
        ? currentWeeks.filter((w) => w !== week)
        : [...currentWeeks, week].sort();

      return {
        ...prev,
        [dayKey]: newWeeks,
      };
    });
  };

  // Toggle all weeks for a day
  const toggleAllWeeksForDay = (day: number) => {
    setWeeklyOffData((prev) => {
      const dayKey = day.toString();
      const currentWeeks = prev[dayKey] || [];

      const newWeeks =
        currentWeeks.length === weekNumbers.length ? [] : [...weekNumbers];

      return {
        ...prev,
        [dayKey]: newWeeks,
      };
    });
  };

  // Toggle a week for all days
  const toggleAllDaysForWeek = (week: number) => {
    setWeeklyOffData((prev) => {
      const newData = { ...prev };
      const allDaysHaveWeek = dayNames.every(
        (_, dayIdx) =>
          (newData[dayIdx.toString()] || []).includes(week)
      );

      dayNames.forEach((_, dayIdx) => {
        const dayKey = dayIdx.toString();
        const weeks = newData[dayKey] || [];

        if (allDaysHaveWeek) {
          // Remove week from all days
          newData[dayKey] = weeks.filter((w) => w !== week);
        } else {
          // Add week to all days
          newData[dayKey] = Array.from(
            new Set([...weeks, week])
          ).sort();
        }
      });

      return newData;
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const res = await fetch("/api/attendance-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          weeklyOffDays: weeklyOffData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save");
      }

      toast.success("Weekly off days updated successfully!");
    } catch (error) {
      console.error("Failed to save weekly off days:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading...</div>;
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Select which weeks of each day are marked as off. These days will never count as
        absent, even if no attendance is marked.
      </p>

      <div className="bg-white rounded-lg border border-slate-200 p-6 overflow-x-auto">
        {/* Table Header */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-semibold text-slate-700 border-b">
                Day
              </th>
              {weekNumbers.map((week) => (
                <th
                  key={week}
                  className="text-center py-2 px-3 font-semibold text-slate-700 border-b cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleAllDaysForWeek(week)}
                  title="Click to toggle all days for this week"
                >
                  <div className="text-xs text-slate-500 mb-1">Week</div>
                  <div className="text-sm">{week}</div>
                </th>
              ))}
              <th className="text-center py-2 px-3 font-semibold text-slate-700 border-b">
                All
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {dayNames.map((dayName, dayIdx) => {
              const dayKey = dayIdx.toString();
              const selectedWeeks = weeklyOffData[dayKey] || [];
              const allWeeksSelected =
                selectedWeeks.length === weekNumbers.length;

              return (
                <tr key={dayIdx}>
                  <td className="py-3 px-3 font-medium text-slate-700 border-b">
                    {dayName}
                  </td>

                  {weekNumbers.map((week) => (
                    <td
                      key={week}
                      className="text-center py-3 px-3 border-b"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWeeks.includes(week)}
                        onChange={() => toggleWeek(dayIdx, week)}
                        className="w-5 h-5 cursor-pointer accent-slate-900"
                      />
                    </td>
                  ))}

                  <td className="text-center py-3 px-3 border-b">
                    <button
                      type="button"
                      onClick={() => toggleAllWeeksForDay(dayIdx)}
                      className={`text-xs font-semibold py-1 px-2 rounded transition-all ${allWeeksSelected
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                      {allWeeksSelected ? "✓ All" : "All"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-600 font-medium mb-2">Summary:</p>
        <div className="text-sm text-slate-700 space-y-1">
          {dayNames.map((dayName, dayIdx) => {
            const weeks = weeklyOffData[dayIdx.toString()] || [];
            if (weeks.length === 0) return null;

            const weekLabels = weeks
              .map((w) => {
                const labels = [
                  "1st",
                  "2nd",
                  "3rd",
                  "4th",
                  "5th",
                ];
                return labels[w - 1];
              })
              .join(", ");

            return (
              <div key={dayIdx}>
                <span className="font-medium">{dayName}:</span> {weekLabels}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Weekly Off Configuration"}
      </button>
    </div>
  );
}