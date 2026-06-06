export interface Individual {
  id: string; // normalized, e.g. 'I1'
  givenName: string;
  surname: string;
  nameFull: string;
  sex: "M" | "F" | "U";
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  burialDate: string | null;
  burialPlace: string | null;
  occupation: string | null;
  familiesAsSpouse: string[];
  familiesAsChild: string[];
}

export interface Family {
  id: string;
  husbandId: string | null;
  wifeId: string | null;
  childIds: string[];
  marriageDate: string | null;
  marriagePlace: string | null;
}

export interface TreeData {
  individuals: Record<string, Individual>;
  families: Record<string, Family>;
}

export interface TreeSummary {
  individualCount: number;
  familyCount: number;
  earliestYear: number | null;
  latestYear: number | null;
  topSurnames: { surname: string; count: number }[]; // top 5
  suggestedQuestions: string[]; // exactly 3
}

export interface Edge {
  to: string;
  label: "spouse" | "parent" | "child";
}

export interface PathStep {
  individualId: string;
  relationToNext: "spouse" | "parent" | "child" | null;
}

export type ContextPayload = Record<string, unknown>;
