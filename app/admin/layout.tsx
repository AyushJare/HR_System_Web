import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    select: {
      fullName: true,
      email: true,
      role: true,
      userType: {
        select: {
          permissions: true,
        },
      },
    },
  });

  if (!employee) {
    redirect("/login");
  }

  const permissions = (employee.userType?.permissions ?? null) as
    | Record<string, unknown>
    | null;

  return (
    <AdminShell
      user={{
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
      }}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  );
}