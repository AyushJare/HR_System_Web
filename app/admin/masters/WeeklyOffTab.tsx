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

type EmployeeType = {
  id: string;
  name: string;
  noticePeriod?: number;
};

type EmployeeTypeWeeklyOffData = Record<string, WeeklyOffData>;

const createEmptyWeeklyOffData = (): WeeklyOffData => ({
  "0": [],
  "1": [],
  "2": [],
  "3": [],
  "4": [],
  "5": [],
  "6": [],
});

export default function WeeklyOffTab() {
  const [weeklyOffData, setWeeklyOffData] = useState<WeeklyOffData>(
    createEmptyWeeklyOffData()
  );

  // Employee-type-specific weekly-off configurations.
  const [employeeTypeWeeklyOffData, setEmployeeTypeWeeklyOffData] =
    useState<EmployeeTypeWeeklyOffData>({});

  const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);

  // "default" keeps the existing configuration.
  // Selecting an employee type loads that employee type's configuration.
  const [selectedEmployeeTypeId, setSelectedEmployeeTypeId] =
    useState<string>("default");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsRes, employeeTypesRes] = await Promise.all([
          fetch("/api/attendance-settings", {
            credentials: "include",
          }),
          fetch("/api/employee-types", {
            credentials: "include",
          }),
        ]);

        const settingsData = await settingsRes.json();
        const employeeTypesData = await employeeTypesRes.json();

        if (!settingsRes.ok) {
          throw new Error(
            settingsData?.error || "Failed to load attendance settings"
          );
        }

        if (!employeeTypesRes.ok) {
          throw new Error(
            employeeTypesData?.error || "Failed to load employee types"
          );
        }

        // Employee Types API returns the employee types directly as an array.
        if (Array.isArray(employeeTypesData)) {
          setEmployeeTypes(
            employeeTypesData.map((item) => ({
              id: item.id?.toString() ?? "",
              name: item.name?.toString() ?? "",
              noticePeriod:
                typeof item.noticePeriod === "number"
                  ? item.noticePeriod
                  : undefined,
            }))
          );
        }

        const data = settingsData?.weeklyOffDays;

        // Handle both old and new format for backwards compatibility.
        if (typeof data === "object" && !Array.isArray(data)) {
          // New employee-type format:
          //
          // {
          //   default: {
          //     "0": [1, 2, ...],
          //     ...
          //   },
          //   employeeTypes: {
          //     "employee-type-id": {
          //       "5": [2, 4]
          //     }
          //   }
          // }
          if (
            data.default &&
            typeof data.default === "object" &&
            !Array.isArray(data.default)
          ) {
            setWeeklyOffData({
              ...createEmptyWeeklyOffData(),
              ...data.default,
            });

            if (
              data.employeeTypes &&
              typeof data.employeeTypes === "object" &&
              !Array.isArray(data.employeeTypes)
            ) {
              setEmployeeTypeWeeklyOffData(data.employeeTypes);
            } else {
              setEmployeeTypeWeeklyOffData({});
            }
          } else {
            // Existing format:
            //
            // {
            //   "0": [],
            //   "1": [],
            //   ...
            // }
            //
            // Keep it as the default configuration.
            setWeeklyOffData({
              ...createEmptyWeeklyOffData(),
              ...data,
            });

            setEmployeeTypeWeeklyOffData({});
          }
        } else {
          // Old format - convert.
          const oldDays = Array.isArray(data) ? data : [];

          const newFormat = createEmptyWeeklyOffData();

          for (const day of oldDays) {
            newFormat[day.toString()] = [1, 2, 3, 4, 5];
          }

          setWeeklyOffData(newFormat);
          setEmployeeTypeWeeklyOffData({});
        }
      } catch (error) {
        console.error("Failed to load attendance settings:", error);

        setWeeklyOffData(createEmptyWeeklyOffData());
        setEmployeeTypeWeeklyOffData({});

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

  // Get the currently selected weekly-off configuration.
  const getCurrentWeeklyOffData = (): WeeklyOffData => {
    if (selectedEmployeeTypeId === "default") {
      return weeklyOffData;
    }

    return (
      employeeTypeWeeklyOffData[selectedEmployeeTypeId] ||
      createEmptyWeeklyOffData()
    );
  };

  // Update the currently selected weekly-off configuration.
  const updateCurrentWeeklyOffData = (
    updater: (previous: WeeklyOffData) => WeeklyOffData
  ) => {
    if (selectedEmployeeTypeId === "default") {
      setWeeklyOffData((prev) => updater(prev));
      return;
    }

    setEmployeeTypeWeeklyOffData((prev) => {
      const current =
        prev[selectedEmployeeTypeId] || createEmptyWeeklyOffData();

      return {
        ...prev,
        [selectedEmployeeTypeId]: updater(current),
      };
    });
  };

  // Toggle week on/off for a specific day
  const toggleWeek = (day: number, week: number) => {
    updateCurrentWeeklyOffData((prev) => {
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
    updateCurrentWeeklyOffData((prev) => {
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
    updateCurrentWeeklyOffData((prev) => {
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
      // New format keeps the old/default configuration and adds
      // employee-type-specific configurations.
      const updatedWeeklyOffDays = {
        default: weeklyOffData,
        employeeTypes: employeeTypeWeeklyOffData,
      };

      const res = await fetch("/api/attendance-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          weeklyOffDays: updatedWeeklyOffDays,
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

  const currentWeeklyOffData = getCurrentWeeklyOffData();

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Select which weeks of each day are marked as off. These days will never
        count as absent, even if no attendance is marked.
      </p>

      {/* Employee Type Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <label
          htmlFor="weekly-off-employee-type"
          className="block text-sm font-semibold text-slate-700 mb-2"
        >
          Employee Type
        </label>

        <select
          id="weekly-off-employee-type"
          value={selectedEmployeeTypeId}
          onChange={(event) => {
            setSelectedEmployeeTypeId(event.target.value);
          }}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        >
          <option value="default">Default / All Employee Types</option>

          {employeeTypes.map((employeeType) => (
            <option key={employeeType.id} value={employeeType.id}>
              {employeeType.name}
            </option>
          ))}
        </select>

        <p className="text-xs text-slate-500 mt-2">
          Configure the default weekly offs first, then select an employee
          type to give that employee type its own weekly-off rules.
        </p>
      </div>

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
              const selectedWeeks = currentWeeklyOffData[dayKey] || [];

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
        <p className="text-sm text-slate-600 font-medium mb-2">
          Summary:
        </p>

        <div className="text-sm text-slate-700 space-y-1">
          {dayNames.map((dayName, dayIdx) => {
            const weeks =
              currentWeeklyOffData[dayIdx.toString()] || [];

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
                <span className="font-medium">{dayName}:</span>{" "}
                {weekLabels}
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