import { prisma } from "@langfuse/shared/src/db";
import {
  GetObservationV1Query,
  GetObservationV1Response,
  transformDbToApiObservation,
} from "@/src/features/public-api/types/observations";
import { withMiddlewares } from "@/src/features/public-api/server/withMiddlewares";
import { createAuthedProjectAPIRoute } from "@/src/features/public-api/server/createAuthedProjectAPIRoute";
import { LangfuseNotFoundError } from "@langfuse/shared";
import {
  enrichObservationWithModelData,
  getObservationById,
  getObservationByIdFromEventsTable,
  logger,
} from "@langfuse/shared/src/server";
import { env } from "@/src/env.mjs";

const EVENTS_TABLE_QUERY_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
};

export default withMiddlewares({
  GET: createAuthedProjectAPIRoute({
    name: "Get Observation",
    querySchema: GetObservationV1Query,
    responseSchema: GetObservationV1Response,
    fn: async ({ query, auth }) => {
      // Use events table if query parameter is explicitly set, otherwise use environment variable
      const useEventsTable =
        query.useEventsTable !== undefined && query.useEventsTable !== null
          ? query.useEventsTable === true
          : env.LANGFUSE_ENABLE_EVENTS_TABLE_OBSERVATIONS === "true";

      let clickhouseObservation = null;

      if (useEventsTable) {
        try {
          clickhouseObservation = await withTimeout(
            getObservationByIdFromEventsTable({
              id: query.observationId,
              projectId: auth.scope.projectId,
              fetchWithInputOutput: true,
            }),
            EVENTS_TABLE_QUERY_TIMEOUT_MS,
          );
        } catch (error) {
          if (query.useEventsTable === true) {
            throw error;
          }

          logger.warn(
            "Events-table single observation query failed, falling back to legacy observations table",
            {
              projectId: auth.scope.projectId,
              observationId: query.observationId,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }

      if (!clickhouseObservation) {
        clickhouseObservation = await getObservationById({
          id: query.observationId,
          projectId: auth.scope.projectId,
          fetchWithInputOutput: true,
          preferredClickhouseService: "ReadOnly",
        });
      }

      if (!clickhouseObservation) {
        throw new LangfuseNotFoundError(
          "Observation not found within authorized project",
        );
      }

      const model = clickhouseObservation.internalModelId
        ? await prisma.model.findFirst({
            where: {
              AND: [
                {
                  id: clickhouseObservation.internalModelId,
                },
                {
                  OR: [
                    {
                      projectId: auth.scope.projectId,
                    },
                    {
                      projectId: null,
                    },
                  ],
                },
              ],
            },
            include: {
              Price: true,
            },
            orderBy: {
              projectId: {
                sort: "desc",
                nulls: "last",
              },
            },
          })
        : undefined;

      const observation = {
        ...clickhouseObservation,
        ...enrichObservationWithModelData(model),
      };

      if (!observation) {
        throw new LangfuseNotFoundError(
          "Observation not found within authorized project",
        );
      }
      return transformDbToApiObservation(observation);
    },
  }),
});
