import { ApiResponse } from "apisauce";
import { z } from "zod";

export interface ErrorData {
  detail?: unknown;
}

export class HttpError extends Error {
  public statusCode: number | undefined;
  data: ErrorData | undefined;
  constructor(message: string, statusCode?: number, data?: ErrorData) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}
// no-dd-sa
export class LoadingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const errorMap = {
  CLIENT_ERROR: "Error with sending request",
  SERVER_ERROR: "Error with processing request",
  TIMEOUT_ERROR: "Request has timed out",
  CONNECTION_ERROR: "Server not available",
  NETWORK_ERROR: "Network not available",
  CANCEL_ERROR: "Request has been cancelled",
  UNKNOWN_ERROR: "Unknown error",
  NONE: "No error",
};

export enum StatusCodes {
  HTTP_401_UNAUTHORIZED = 401,
  HTTP_403_FORBIDDEN = 403,
  HTTP_400_BAD_REQUEST = 400,
  HTTP_404_NOT_FOUND = 404,
}

export function parseResponse<T extends z.ZodTypeAny>(
  response: ApiResponse<unknown, unknown>,
  schema: T | null
): typeof schema extends null ? unknown : z.infer<T> | never {
  if (response.ok) {
    if (schema) {
      try {
        return schema.parse(response.data) as z.infer<T>;
      } catch (e) {
        // no-dd-sa
        console.error(e);
      }
    }
    return response.data as typeof schema extends null ? unknown : z.infer<T> | never;
  }

  const data: ErrorData = response.data ?? {};
  let message = errorMap[response.problem];
  if ("detail" in data) {
    const detail = data["detail"];
    if (detail instanceof Object) {
      message = JSON.stringify(detail);
    } else message = detail as string;
  }

  throw new HttpError(message, response.status, data);
}
