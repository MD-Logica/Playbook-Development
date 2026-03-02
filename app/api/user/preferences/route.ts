import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await prisma.user.findUnique({
      where: { clerkId: session.userId },
      select: { defaultLandingPage: true },
    });

    if (!user) {
      return NextResponse.json({ defaultLandingPage: null });
    }

    if (user.defaultLandingPage?.startsWith("pipeline:")) {
      const pipelineId = user.defaultLandingPage.split(":")[1];
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: pipelineId, isActive: true },
      });
      if (!pipeline) {
        await prisma.user.update({
          where: { clerkId: session.userId },
          data: { defaultLandingPage: null },
        });
        return NextResponse.json({ defaultLandingPage: null });
      }
    }

    return NextResponse.json({ defaultLandingPage: user.defaultLandingPage });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { defaultLandingPage } = body;

    if (defaultLandingPage !== null && defaultLandingPage !== undefined) {
      const valid = ["dashboard", "patients", "appointments"].includes(defaultLandingPage) ||
        defaultLandingPage.startsWith("pipeline:");

      if (!valid) {
        return NextResponse.json({ error: "Invalid landing page value" }, { status: 400 });
      }

      if (defaultLandingPage.startsWith("pipeline:")) {
        const pipelineId = defaultLandingPage.split(":")[1];
        const pipeline = await prisma.pipeline.findFirst({
          where: { id: pipelineId, isActive: true },
        });
        if (!pipeline) {
          return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
        }
      }
    }

    await prisma.user.update({
      where: { clerkId: session.userId },
      data: { defaultLandingPage: defaultLandingPage || null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
