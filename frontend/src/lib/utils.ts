import { InteractionStep, InteractionStepType } from "@/types/interactions";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const parseTrace = (file: Record<string, unknown>[]) => {
  const spans: InteractionStep[] = [];
  const spanNameToSpanTypeMap = new Map<string, InteractionStepType>();
  file.forEach((span) => {
    // random select a span type
    const name = span["name"] as string;

    const spanType =
      spanNameToSpanTypeMap.get(name) ??
      Object.values(InteractionStepType.enum)[
        Math.floor(Math.random() * Object.values(InteractionStepType.enum).length)
      ];
    spanNameToSpanTypeMap.set(name, spanType);
    spans.push(InteractionStep.parse({ ...span, span_type: spanType }));
  });

  return spans;
};

export const round = (value: number, decimalPlaces: number) => {
  return (Math.round((value + Number.EPSILON) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)).toFixed(
    decimalPlaces
  );
};

// export const parseInteractionGroup = () => {
//   const steps = parseTrace(NormalizedTraces3);
//   return [
//     InteractionGroup.parse({
//       joined_on: "test",
//       id: "test",
//       interactions: [
//         {
//           id: "interaction",
//           steps,
//         },
//       ],
//     }),
//   ];

//   // const interactionGroups: Record<string, unknown>[] = InteractionGroupFile as Record<string, unknown>[];
//   // const interactionGroupsParsed: InteractionGroup[] = interactionGroups.map((interactionGroup) =>
//   //   InteractionGroup.parse(interactionGroup)
//   // );
//   // return interactionGroupsParsed;
// };

export const isObject = (obj: unknown) => obj === Object(obj);

export const stringifyDataType = (data: unknown | undefined | null) => {
  if (data === undefined || data === null) {
    return null;
  }

  let content = null;
  try {
    if (isObject(data) && data !== null) {
      content = JSON.stringify(data, null, 4);
    } else {
      content = data.toString();
    }
  } catch {
    content = data.toString();
  }

  return content;
};
