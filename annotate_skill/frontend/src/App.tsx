import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import React from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import ErrorPage from "./pages/ErrorPage/ErrorPage";
import TestCaseAnnotation from "./pages/TestCases/ViewTestCases/TestCaseAnnotation";
import TestCaseTrace from "./pages/TestCases/ViewTestCases/TestCaseInteractions";
import ViewTestCase from "./pages/TestCases/ViewTestCases/ViewTestCase";
import ViewTestCases from "./pages/TestCases/ViewTestCases/ViewTestCases";
import { routes } from "./routes";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to={routes.VIEW_TEST_CASES} replace />,
      },
      {
        path: routes.VIEW_TEST_CASES,
        element: <ViewTestCases />,
        children: [
          {
            path: routes.VIEW_TEST_CASE,
            element: <ViewTestCase />,
            children: [
              {
                path: routes.VIEW_TEST_CASE_TRACE,
                element: <TestCaseTrace />,
                children: [
                  {
                    path: routes.VIEW_TEST_CASE_TRACE_INTERACTION_STEP,
                  },
                ],
              },
              {
                path: routes.VIEW_TEST_CASE_PAIRWISE_TRACE,
                element: <TestCaseTrace />,
                children: [
                  {
                    path: routes.VIEW_TEST_CASE_PAIRWISE_TRACE_INTERACTION_STEP,
                  },
                ],
              },
              {
                path: routes.VIEW_TEST_CASE_AI_ANNOTATION,
                element: <TestCaseAnnotation />,
              },
              {
                path: routes.VIEW_TEST_CASE_HUMAN_ANNOTATION,
                element: <TestCaseAnnotation />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
