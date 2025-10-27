import { StatusCodes } from "@/api/utils";
import { Button } from "@/components/ui/button";
import { routes } from "@/routes";
import React from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import bird from "/assets/bird-logo-transparent.svg";

const ErrorPage = () => {
  const navigate = useNavigate();
  const error = useRouteError();

  let errorMessage = "Error - Haize Labs";
  if (isRouteErrorResponse(error)) {
    const code = error.status;
    if (code === StatusCodes.HTTP_404_NOT_FOUND) {
      errorMessage = "404 - Page not found";
    }
  }

  return (
    <div className="w-full min-h-screen min-w-screen flex flex-col text-center items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <img src={bird} alt="bird" className=" h-16 w-16" />
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm">
          Please contact{" "}
          <a className="underline text-blue-500" href="mailto:contact@haizelabs.com">
            contact@haizelabs.com
          </a>{" "}
          if this issue persists
        </p>
        <Button variant="link" onClick={() => navigate(routes.VIEW_TEST_CASES)}>
          Return home
        </Button>
      </div>
    </div>
  );
};

export default ErrorPage;
