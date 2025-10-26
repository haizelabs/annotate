import { BaseQueryOptions } from "@/api/query";
import { Interaction } from "@/types/interactions";
import { useQuery } from "@tanstack/react-query";
import { getInteractionForStep } from "./router";

export const queryKeys = {
  interactions: ["interactions"] as const,
  interaction_for_step: (stepId: string) => [...queryKeys.interactions, "step", stepId] as const,
};

interface GetInteractionForStepArgs {
  stepId: string;
  options?: BaseQueryOptions<Interaction>;
}

export const useGetInteractionForStep = ({ stepId, options }: GetInteractionForStepArgs) => {
  return useQuery({
    queryKey: queryKeys.interaction_for_step(stepId),
    queryFn: () => getInteractionForStep({ stepId }),
    ...options,
  });
};
