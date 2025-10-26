import { useGetTestCase } from "@/api/testCases/queries";
import Categorical from "@/components/annotations/Categorical";
import Ranking from "@/components/annotations/Ranking";
import Score from "@/components/annotations/Score";
import { ErrorNote } from "@/components/Note";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteData } from "@/routes";
import {
  Annotation,
  CategoricalAnnotation,
  ContinuousAnnotation,
  RankingAnnotation,
  SpecType,
} from "@/types/annotation";
import { AlertCircle, Gavel } from "lucide-react";
import React from "react";
import { useLocation, useParams } from "react-router-dom";

const ViewCategoricalAnnotation = ({ annotation }: { annotation: CategoricalAnnotation }) => {
  return (
    <Categorical
      categories={annotation.categories}
      value={annotation.category}
      onValueChange={() => {}}
      readOnly={true}
    />
  );
};

const ViewContinuousAnnotation = ({ annotation }: { annotation: ContinuousAnnotation }) => {
  return (
    <Score
      min={annotation.score_range[0]}
      max={annotation.score_range[1]}
      value={annotation.score}
      setValue={() => {}}
      disabled={true}
      prefix="Annotation Score:"
    />
  );
};

const ViewRankingAnnotation = ({ annotation }: { annotation: RankingAnnotation }) => {
  return (
    <Ranking
      ordering={annotation.rankings.map((ranking) => ({ id: `${ranking.toString()}` }))}
      setOrdering={() => {}}
      disabled={true}
    />
  );
};

const AnnotationContainer = ({ header, children }: { header: string; children: React.ReactNode }) => {
  return (
    <div className="flex flex-col gap-2 border rounded-md p-4">
      <div className="flex items-center gap-1">
        <Gavel className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{header}</p>
      </div>
      {children}
    </div>
  );
};

const ViewAnnotation = ({
  annotation,
  header,
}: {
  annotation: Annotation | null;
  header: string;
}) => {
  if (!annotation) {
    return (
      <AnnotationContainer header={header}>
        <ErrorNote errorMessage="No annotation found" />
      </AnnotationContainer>
    );
  }

  if (annotation.skip) {
    return (
      <div className="flex flex-col gap-4">
        <AnnotationContainer header={header}>
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 font-medium">Annotation was skipped</p>
          </div>
        </AnnotationContainer>
        {annotation.comment && (
          <div className="flex flex-col gap-2 border rounded-md p-4">
            <p className="text-sm font-semibold text-muted-foreground">Comment:</p>
            <p className="text-sm">{annotation.comment}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {annotation.type === SpecType.enum.categorical && (
        <AnnotationContainer header={header}>
          <ViewCategoricalAnnotation annotation={annotation as CategoricalAnnotation} />
        </AnnotationContainer>
      )}
      {annotation.type === SpecType.enum.continuous && (
        <AnnotationContainer header={header}>
          <ViewContinuousAnnotation annotation={annotation as ContinuousAnnotation} />
        </AnnotationContainer>
      )}
      {annotation.type === SpecType.enum.ranking && (
        <AnnotationContainer header={header}>
          <ViewRankingAnnotation annotation={annotation as RankingAnnotation} />
        </AnnotationContainer>
      )}
      {annotation.comment && (
        <div className="flex flex-col gap-2 border rounded-md p-4">
          <p className="text-sm font-semibold text-muted-foreground">Comment:</p>
          <p className="text-sm">{annotation.comment}</p>
        </div>
      )}
    </div>
  );
};

const TestCaseAnnotation = () => {
  const params: RouteData = useParams();
  const location = useLocation();
  const { testCaseId } = params;
  const { data, isPending, error } = useGetTestCase({ testCaseId: testCaseId! });

  if (isPending) {
    return <Skeleton className="w-full h-8" />;
  }

  if (error) {
    return <ErrorNote errorMessage={`Error loading test case: ${error.message}`} />;
  }

  const currentTestCase = data;

  if (!currentTestCase) {
    return (
      <ErrorNote
        errorMessage={`No test case found with id: ${testCaseId}. Please check the test case id in your data source and try again.`}
      />
    );
  }

  // Determine which annotation to show based on route
  const pathname = location.pathname;
  const isAIAnnotation = pathname.includes("ai-annotation");
  const isHumanAnnotation = pathname.includes("human-annotation");

  // Show appropriate annotation based on route
  if (isAIAnnotation) {
    return <ViewAnnotation annotation={currentTestCase.ai_annotation} header="AI Annotation" />;
  }

  if (isHumanAnnotation) {
    return <ViewAnnotation annotation={currentTestCase.human_annotation} header="Human Annotation" />;
  }

  return null;
};

export default TestCaseAnnotation;
