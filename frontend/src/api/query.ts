import { UseQueryOptions } from "@tanstack/react-query";
import { HttpError } from "./utils";

export type BaseQueryOptions<TData> = Omit<UseQueryOptions<TData, HttpError>, "queryKey" | "queryFn">;
