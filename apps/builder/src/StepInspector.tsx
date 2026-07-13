import type { Step } from "@leadflow/schema";

export function StepInspector({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  function set(patch: Partial<Step["config"]>) {
    onChange({ ...step, config: { ...step.config, ...patch } });
  }

  return (
    <div className="lf-inspector-form">
      <label>
        Заголовок
        <input value={step.config.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label>
        Подзаголовок
        <input value={step.config.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} />
      </label>

      {step.type === "choice" && (
        <div className="lf-options-editor">
          <p className="lf-field-label">Варианты ответа</p>
          {(step.config.options ?? []).map((opt, i) => (
            <div key={opt.id} className="lf-option-row">
              <input
                value={opt.label}
                onChange={(e) => {
                  const options = [...(step.config.options ?? [])];
                  options[i] = { ...opt, label: e.target.value };
                  set({ options });
                }}
              />
              <button
                onClick={() => {
                  const options = (step.config.options ?? []).filter((_, idx) => idx !== i);
                  set({ options });
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const options = [...(step.config.options ?? []), { id: `opt_${Date.now()}`, label: "Новый вариант" }];
              set({ options });
            }}
          >
            + вариант
          </button>
        </div>
      )}

      {(step.type === "text_input" || step.type === "phone_input") && (
        <label>
          Плейсхолдер
          <input value={step.config.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value })} />
        </label>
      )}

      {step.type === "external_action" && (
        <>
          <label>
            Текст кнопки
            <input
              value={step.config.externalAction?.label ?? ""}
              onChange={(e) =>
                set({ externalAction: { ...step.config.externalAction!, label: e.target.value } })
              }
            />
          </label>
          <label>
            Инструкция (HTML)
            <textarea
              rows={4}
              value={step.config.externalAction?.instructionsHtml ?? ""}
              onChange={(e) =>
                set({ externalAction: { ...step.config.externalAction!, instructionsHtml: e.target.value } })
              }
            />
          </label>
        </>
      )}
    </div>
  );
}
