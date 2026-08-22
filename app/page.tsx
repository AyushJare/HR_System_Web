"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to admin employees page
    router.push("/admin/employees");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-2xl font-bold mb-4">Loading...</div>
        <p className="text-slate-900">Redirecting to employees...</p>
      </div>
    </div>
  );
}