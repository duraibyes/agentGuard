import { env } from "@/src/env.mjs";
import {
  createUserEmailPassword,
  updateUserPassword,
} from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@langfuse/shared/src/db";

export default async function localBootstrapHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  if (env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION !== "DEV") {
    res.status(403).json({ message: "Local bootstrap is only enabled in DEV." });
    return;
  }

  if (!env.LANGFUSE_INIT_USER_EMAIL || !env.LANGFUSE_INIT_USER_PASSWORD) {
    res.status(422).json({
      message: "LANGFUSE_INIT_USER_EMAIL and LANGFUSE_INIT_USER_PASSWORD are required.",
    });
    return;
  }

  if (!env.LANGFUSE_INIT_ORG_ID) {
    res.status(422).json({
      message: "LANGFUSE_INIT_ORG_ID is required for local bootstrap.",
    });
    return;
  }

  try {
    const org = await prisma.organization.upsert({
      where: { id: env.LANGFUSE_INIT_ORG_ID },
      update: {},
      create: {
        id: env.LANGFUSE_INIT_ORG_ID,
        name: env.LANGFUSE_INIT_ORG_NAME ?? "Provisioned Org",
      },
    });

    if (env.LANGFUSE_INIT_PROJECT_ID) {
      await prisma.project.upsert({
        where: { id: env.LANGFUSE_INIT_PROJECT_ID },
        update: {},
        create: {
          id: env.LANGFUSE_INIT_PROJECT_ID,
          name: env.LANGFUSE_INIT_PROJECT_NAME ?? "Provisioned Project",
          orgId: org.id,
        },
      });
    }

    const email = env.LANGFUSE_INIT_USER_EMAIL.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const userId =
      existingUser?.id ??
      (await createUserEmailPassword(
        email,
        env.LANGFUSE_INIT_USER_PASSWORD,
        env.LANGFUSE_INIT_USER_NAME ?? "Provisioned User",
      ));

    await updateUserPassword(userId, env.LANGFUSE_INIT_USER_PASSWORD);

    const orgMembership = await prisma.organizationMembership.upsert({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId,
        },
      },
      update: { role: "OWNER" },
      create: {
        orgId: org.id,
        userId,
        role: "OWNER",
      },
    });

    if (env.LANGFUSE_INIT_PROJECT_ID) {
      await prisma.projectMembership.upsert({
        where: {
          projectId_userId: {
            projectId: env.LANGFUSE_INIT_PROJECT_ID,
            userId,
          },
        },
        update: { role: "OWNER" },
        create: {
          userId,
          orgMembershipId: orgMembership.id,
          projectId: env.LANGFUSE_INIT_PROJECT_ID,
          role: "OWNER",
        },
      });
    }

    res.status(200).json({ message: "Local bootstrap user is ready." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Local bootstrap failed.";
    const isDbConnectionIssue =
      message.includes("Can't reach database server") ||
      message.includes("connect EACCES") ||
      message.includes("ECONNREFUSED");

    if (isDbConnectionIssue) {
      res.status(503).json({
        message:
          "Local bootstrap failed: database is unreachable. Verify DATABASE_URL/network access.",
      });
      return;
    }

    res.status(500).json({
      message,
    });
  }
}
