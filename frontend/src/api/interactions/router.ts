import { api } from "@/api/api";
import { parseResponse } from "@/api/utils";
import { joinPaths } from "@/routes";
import { Interaction } from "@/types/interactions";

const prefix = "/interaction";

export const getInteractionForStep = async ({ stepId }: { stepId: string }) => {
  const path = joinPaths(prefix, stepId);
  const response = await api.get(path);
  return parseResponse(response, Interaction);
};
