import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/misc";
import PostForm from "./PostForm";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [institutions, categories] = await Promise.all([
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="AICTE Voice"
        title="Create a community post"
        description={`Posting as "${user.pseudonym}". This is a community discussion, not an official complaint.`}
      />
      <PostForm institutions={institutions} categories={categories} />
    </div>
  );
}
