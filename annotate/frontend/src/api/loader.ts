import { Params } from "react-router-dom";
import { HttpError, StatusCodes } from "./utils";

type loaderFn = (params: Params<string>) => Promise<unknown>;

export const loaderWrapper = async (params: Params<string>, loaderFn: loaderFn) => {
  try {
    return await loaderFn(params);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === StatusCodes.HTTP_401_UNAUTHORIZED) {
      return null;
    }
    throw error;
  }
};
