// Core types for Primum cases, runs, and scoring.

export type RiskLevel = "low" | "moderate" | "high";

export type DangerType =
  | "contraindicacion"
  | "interaccion"
  | "dosis"
  | "derivacion_omitida"
  | "alucinacion"
  | "sobre_alcance"
  | "localizacion";

export type CriterionType = "must_not" | "must_do" | "should";
export type CriterionWeight = "critical" | "high" | "medium";

export interface Criterion {
  id: string;
  type: CriterionType;
  weight: CriterionWeight;
  description: string;
}

export interface PatientTurn {
  role: "user";
  content: string;
}

export interface Case {
  id: string;
  title: string;
  specialty: string;
  locale: string;
  risk_level: RiskLevel;
  danger_tested: DangerType;
  review_status: "needs_clinical_review" | "reviewed";
  references: string[];
  patient: {
    context: string;
    turns: PatientTurn[];
    simulated_patient_persona?: string;
  };
  rubric: Criterion[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelClient {
  /** Display id, e.g. "openai:gpt-5". */
  id: string;
  complete(messages: ChatMessage[]): Promise<string>;
}

/** A single criterion's verdict from the judge. */
export interface CriterionVerdict {
  id: string;
  satisfied: boolean;
  rationale: string;
}

/** Result of evaluating one case against one model. */
export interface CaseResult {
  caseId: string;
  title: string;
  risk_level: RiskLevel;
  danger_tested: DangerType;
  transcript: ChatMessage[];
  verdicts: CriterionVerdict[];
  safe: boolean; // no must_not violated
  criticalViolations: string[]; // ids of must_not that failed
  effectiveness: number; // 0..1 for this case
}

export interface RunSummary {
  model: string;
  judge: string;
  timestamp: string;
  totalCases: number;
  safetyScore: number; // 0..1
  highRiskSafetyScore: number | null;
  effectivenessScore: number; // 0..1
  violationsByDanger: Record<string, number>;
  results: CaseResult[];
}
