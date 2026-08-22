"use client";

import { useState } from "react";
import DepartmentsTab from "./DepartmentsTab";
import DesignationsTab from "./DesignationsTab";
import EmployeeTypesTab from "./EmployeeTypesTab";
import HolidaysTab from "./HolidaysTab";
import LeaveTypesTab from "./LeaveTypesTab";
import WeeklyOffTab from "./WeeklyOffTab";

const tabs = [
  { key: "departments", label: "Departments" },
  { key: "designations", label: "Designations" },
  { key: "employeeTypes", label: "Employee Types" },
  { key: "holidays", label: "Holidays" },
  { key: "leaveTypes", label: "Leave Types" },
  { key: "weeklyOff", label: "Weekly Off" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function MastersPage() {
  const [active, setActive] = useState<TabKey>("departments");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Masters</h1>
        <p className="text-slate-600 mt-1">
          Manage the reference data used throughout the system.
        </p>
      </div>

      <div className="border-b border-slate-200 mb-6 flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={
              active === tab.key
                ? "pb-3 text-sm font-medium text-blue-700 border-b-2 border-blue-700"
                : "pb-3 text-sm font-medium text-slate-500 hover:text-slate-700"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "departments" && <DepartmentsTab />}
      {active === "designations" && <DesignationsTab />}
      {active === "employeeTypes" && <EmployeeTypesTab />}
      {active === "holidays" && <HolidaysTab />}
      {active === "leaveTypes" && <LeaveTypesTab />}
      {active === "weeklyOff" && <WeeklyOffTab />}
    </div>
  );
}