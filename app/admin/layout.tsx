import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    select: { fullName: true, email: true, role: true },
  });

  if (!employee) {
    redirect("/login");
  }

  return <AdminShell user={employee}>{children}</AdminShell>;
}
