import { useState } from "react";
import type { Flow, Step } from "@leadflow/schema";
import { getStep, resolveNextStepId } from "@leadflow/schema";

export type RendererEvent =
  | { type: "step_view"; stepId: string }
  | { type: "step_answer"; stepId: string; value: string }
  | { type: "flow_complete" };

export interface FlowRendererProps {
  flow: Flow;
  mode?: "live" | "preview";
  // Event bus (шаг 2/3 архитектуры): сюда прилетает каждое значимое действие,
  // а обёртка-доставка (hosted page / embed widget / api client) уже решает,
  // куда его дублировать — на бэк и/или в Pixel/Firebase.
  onEvent?: (event: RendererEvent) => void;
}

export function FlowRenderer({ flow, mode = "live", onEvent }: FlowRendererProps) {
  const [currentStepId, setCurrentStepId] = useState(flow.startStepId);
  const [showExternal, setShowExternal] = useState(false);

  const step = getStep(flow, currentStepId);
  if (!step) {
    return <div className="lf-empty">Флоу пуст — добавьте первый шаг.</div>;
  }

  function advance(value: string) {
    onEvent?.({ type: "step_answer", stepId: step!.id, value });
    const nextId = resolveNextStepId(step!, value);
    setShowExternal(false);
    if (nextId) {
      setCurrentStepId(nextId);
      onEvent?.({ type: "step_view", stepId: nextId });
    } else {
      onEvent?.({ type: "flow_complete" });
    }
  }

  return (
    <div className="lf-renderer">
      {mode === "preview" && <div className="lf-preview-badge">preview</div>}
      <StepView step={step} onAnswer={advance} showExternal={showExternal} setShowExternal={setShowExternal} />
    </div>
  );
}

function StepView({
  step,
  onAnswer,
  showExternal,
  setShowExternal,
}: {
  step: Step;
  onAnswer: (value: string) => void;
  showExternal: boolean;
  setShowExternal: (v: boolean) => void;
}) {
  const { config } = step;

  if (step.type === "final") {
    return (
      <div className="lf-step lf-final">
        <p className="lf-title">{config.title}</p>
        {config.subtitle && <p className="lf-sub">{config.subtitle}</p>}
      </div>
    );
  }

  if (step.type === "info") {
    return (
      <div className="lf-step">
        <p className="lf-title">{config.title}</p>
        {config.subtitle && <p className="lf-sub">{config.subtitle}</p>}
        <button onClick={() => onAnswer("*")}>Далее</button>
      </div>
    );
  }

  if (step.type === "choice") {
    return (
      <div className="lf-step">
        <p className="lf-title">{config.title}</p>
        {config.subtitle && <p className="lf-sub">{config.subtitle}</p>}
        <div className="lf-options">
          {(config.options ?? []).map((opt) => (
            <button key={opt.id} onClick={() => onAnswer(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step.type === "text_input" || step.type === "phone_input") {
    return <TextStep step={step} onAnswer={onAnswer} />;
  }

  if (step.type === "file_upload") {
    return (
      <div className="lf-step">
        <p className="lf-title">{config.title}</p>
        {config.subtitle && <p className="lf-sub">{config.subtitle}</p>}
        <input type="file" onChange={() => onAnswer("uploaded")} />
      </div>
    );
  }

  if (step.type === "external_action") {
    return (
      <div className="lf-step">
        <p className="lf-title">{config.title}</p>
        {config.subtitle && <p className="lf-sub">{config.subtitle}</p>}
        {!showExternal ? (
          <button onClick={() => setShowExternal(true)}>
            {config.externalAction?.label ?? "Открыть"}
          </button>
        ) : (
          <div className="lf-external">
            <div
              className="lf-external-body"
              dangerouslySetInnerHTML={{ __html: config.externalAction?.instructionsHtml ?? "" }}
            />
            <button onClick={() => onAnswer("done")}>Готово, вернуться</button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function TextStep({ step, onAnswer }: { step: Step; onAnswer: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="lf-step">
      <p className="lf-title">{step.config.title}</p>
      {step.config.subtitle && <p className="lf-sub">{step.config.subtitle}</p>}
      <input
        type={step.type === "phone_input" ? "tel" : "text"}
        placeholder={step.config.placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button disabled={!value} onClick={() => onAnswer(value)}>
        Далее
      </button>
    </div>
  );
}
