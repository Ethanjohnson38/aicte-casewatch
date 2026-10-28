import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/misc";
import ComplaintForm from "./ComplaintForm";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [institutions, categories] = await Promise.all([
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Official Complaints"
        title="File a formal complaint"
        description="This creates an official case with a unique tracking code. An officer will review and act on it. Provide accurate, specific details."
      />
      <ComplaintForm institutions={institutions} categories={categories} />
    </div>
  );
}
