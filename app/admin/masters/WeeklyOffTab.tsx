"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function WeeklyOffTab() {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/attendance-settings")
      .then((r) => r.json())
      .then((data) => setSelectedDays(data.weeklyOffDays))
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyOffDays: selectedDays }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Weekly off days updated");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>;

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">
        Select the days of the week that are automatically treated as off. These days will never
        count as absent, even if no attendance is marked.
      </p>
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="grid grid-cols-7 gap-3 mb-6">
          {dayNames.map((name, index) => (
            <button
              key={index}
              onClick={() => toggleDay(index)}
              className={
                selectedDays.includes(index)
                  ? "rounded-md border-2 border-slate-900 bg-slate-50 text-slate-950 text-sm font-semibold py-3 text-center transition-all duration-200"
                  : "rounded-md border-2 border-slate-200 bg-white text-slate-600 text-sm font-medium py-3 text-center hover:border-slate-300 transition-all duration-200"
              }
            >
              {name}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Weekly Off Days"}
        </button>
      </div>
    </div>
  );
}