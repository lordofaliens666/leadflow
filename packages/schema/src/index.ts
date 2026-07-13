// Открытый список типов шага. Новый тип механики почти всегда
// добавляется здесь одной строкой + рендер-компонентом,
// без изменения модели данных или бэкенда.
export type StepType =
  | "choice"
  | "text_input"
  | "phone_input"
  | "file_upload"
  | "external_action"
  | "info"
  | "final";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface StepConfig {
  title: string;
  subtitle?: string;
  // choice
  options?: ChoiceOption[];
  // text_input / phone_input
  placeholder?: string;
  // external_action — аналог overlay из исходного примера
  externalAction?: {
    label: string;
    instructionsHtml: string;
  };
}

export interface Transition {
  id: string;
  // id опции choice, "yes"/"no", "*" для дефолтного перехода и т.п.
  condition: string;
  targetStepId: string;
}

export interface Step {
  id: string;
  type: StepType;
  config: StepConfig;
  transitions: Transition[];
  // позиция узла на canvas конструктора — не участвует в рантайм-логике,
  // но нужна, чтобы граф не пересобирался заново при каждом открытии
  canvasPosition: { x: number; y: number };
}

export interface Flow {
  id: string;
  name: string;
  startStepId: string;
  steps: Step[];
}

// ---- Runtime: то, что происходит при прохождении лендинга пользователем ----

export interface SessionAnswer {
  stepId: string;
  value: string;
  answeredAt: string;
}

export interface Session {
  id: string;
  flowId: string;
  status: "in_progress" | "completed" | "abandoned";
  isTest: boolean;
  answers: SessionAnswer[];
  utmParams?: Record<string, string>;
  startedAt: string;
}

export function getStep(flow: Flow, stepId: string): Step | undefined {
  return flow.steps.find((s) => s.id === stepId);
}

// Определяет следующий шаг по ответу — реализует ветвление (шаг 1 нашей модели).
// Порядок: точное совпадение условия -> дефолтный переход "*" -> конец флоу.
export function resolveNextStepId(step: Step, answerValue: string): string | null {
  const exact = step.transitions.find((t) => t.condition === answerValue);
  if (exact) return exact.targetStepId;
  const fallback = step.transitions.find((t) => t.condition === "*");
  if (fallback) return fallback.targetStepId;
  return null;
}
