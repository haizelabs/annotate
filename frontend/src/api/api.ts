import { create } from "apisauce";


function getBaseURL(): string {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (import.meta.env.VITE_BACKEND_PORT) {
    return `http://localhost:${import.meta.env.VITE_BACKEND_PORT}/`;
  }
  return "http://localhost:8000/";
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
