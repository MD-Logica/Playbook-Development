import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const headersList = await headers();
  const referer = headersList.get("referer") || "";
  const isInitialLogin = referer.includes("/sign-in") || referer === "";

  if (isInitialLogin) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: user.id },
        select: { defaultLandingPage: true },
      });

      if (dbUser?.defaultLandingPage) {
        const pref = dbUser.defaultLandingPage;

        if (pref === "patients") {
          redirect("/patients");
        } else if (pref === "appointments") {
          redirect("/appointments");
        } else if (pref.startsWith("pipeline:")) {
          const pipelineId = pref.split(":")[1];
          const pipeline = await prisma.pipeline.findFirst({
            where: { id: pipelineId, isActive: true },
          });
          if (pipeline) {
            redirect(`/pipeline?pid=${pipelineId}`);
          } else {
            await prisma.user.update({
              where: { clerkId: user.id },
              data: { defaultLandingPage: null },
            });
          }
        }
      }
    } catch (error: any) {
      if (error?.digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
  }

  return <DashboardClient firstName={user.firstName || "there"} />;
}
