import { RouteData } from "@/routes";
import { githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import React from "react";
import { Outlet, useParams } from "react-router-dom";

const starterCommand = `
# If you don't have logs yet, use the example data:
cd /Users/haizelabsguest/haizelabs/osource-aa/annotate/tests/example_research_agent

# OR navigate to your own agent traces directory:
# cd /path/to/your/agent/data

# Set your API key (required for AI judge setup)
export OPENAI_API_KEY=...

# Start Claude Code
claude

# Trigger the skill
> hey claude use annotate
`;

const ViewTestCases = () => {
  const params: RouteData = useParams();
  const { testCaseId } = params;

  if (testCaseId) {
    return <Outlet />;
  }

  return (
    <div className="p-4 w-full min-h-screen max-h-screen flex items-center justify-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">No Test Case Selected</h1>
        <p className="text-muted-foreground">
          To get started, run the annotate skill workflow and select a test case to view:
        </p>
        <CodeMirror
          className="border rounded-md text-xs overflow-auto"
          value={starterCommand}
          editable={false}
          theme={githubLight}
          extensions={[EditorView.lineWrapping]}
          basicSetup={{
            lineNumbers: false,
            highlightActiveLineGutter: false,
            highlightActiveLine: false,
            foldGutter: false,
          }}
        />
      </div>
    </div>
  );
};

export default ViewTestCases;
