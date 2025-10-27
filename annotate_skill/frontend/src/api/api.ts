import { create } from "apisauce";
import * as z from "zod";

export const ENV_VARS = z.object({
  VITE_BACKEND_URL: z.string().default("http://localhost"),
  VITE_BACKEND_PORT: z.number().default(8000),
});

function getBaseURL(): string {
  const envVars = ENV_VARS.parse(import.meta.env);
  return `${envVars.VITE_BACKEND_URL}:${envVars.VITE_BACKEND_PORT}/`;
}

export const BASE_URL = getBaseURL();

const createAPI = () => {
  const api = create({
    baseURL: BASE_URL,
    headers: { Accept: "application/json" },
  });

  return api;
};

export const api = createAPI();
