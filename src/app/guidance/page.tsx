import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/misc";
import GuidanceWizard from "./GuidanceWizard";

export const dynamic = "force-dynamic";

export default async function GuidancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Official Complaints"
        title="Get grievance guidance"
        description="A step-by-step helper to prepare your complaint before you file it. It suggests a category, next steps and useful documents, then helps you write a clear draft. You review and approve everything — nothing is submitted automatically."
      />
      <GuidanceWizard categories={categories.map((c) => c.name)} />
    </div>
  );
}
