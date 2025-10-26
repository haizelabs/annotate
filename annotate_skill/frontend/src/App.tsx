import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import React from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import TestCaseAnnotation from "./pages/TestCases/ViewTestCases/TestCaseAnnotation";
import TestCaseTrace from "./pages/TestCases/ViewTestCases/TestCaseInteractions";
import ViewTestCase from "./pages/TestCases/ViewTestCases/ViewTestCase";
import { routes } from "./routes";

// const nodeTypes = {
//   [NodeType.enum.LLM_CALL]: AgentNode,
//   [NodeType.enum.FUNCTION_CALL]: AgentNode,
//   [NodeType.enum.TOOL_CALL]: AgentNode,
//   [NodeType.enum.ROOT]: AgentNode,
// };

// const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
// const getLayoutedElements = (nodes: SpanNode[], edges: Edge[]) => {
//   dagreGraph.setGraph({ rankdir: "TB" });

//   edges.forEach((edge: Edge) => dagreGraph.setEdge(edge.source, edge.target));
//   nodes.forEach((node: SpanNode) =>
//     dagreGraph.setNode(node.id, {
//       width: node.measured?.width ?? 500,
//       height: node.measured?.height ?? 100,
//     })
//   );

//   dagre.layout(dagreGraph);

//   return {
//     nodes: nodes.map((node: SpanNode) => {
//       const { x, y } = dagreGraph.node(node.id);

//       return { ...node, position: { x, y } };
//     }),
//     edges,
//   };
// };

// const interactionGroup = parseInteractionGroup();
// const spans = interactionGroup[0].interactions[0].steps;
// const { nodes: initialNodes, edges: initialEdges } = buildSpanGraph(spans);
// const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
const queryClient = new QueryClient();

const AppContainer = () => {
  return <Outlet />;
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    children: [
      {
        index: true,
        element: <Navigate to={routes.VIEW_TEST_CASES} replace />,
      },
      {
        path: routes.VIEW_TEST_CASES,
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
  // if (selectedInteraction) {
  //   return <TraceView interaction={selectedInteraction} setSelectedInteraction={setSelectedInteraction} />;
  // }
  // return (
  //   <ViewInteractionGroup setSelectedInteraction={setSelectedInteraction} interactionGroup={interactionGroup[0]} />
  // );

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
