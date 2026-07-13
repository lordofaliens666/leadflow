import type { Flow } from "@leadflow/schema";

export const initialFlow: Flow = {
  id: "flow_demo",
  name: "Проверка перед входом",
  startStepId: "step1",
  steps: [
    {
      id: "step1",
      type: "choice",
      config: { title: "OneID: доступ дан?", subtitle: "ПИНФЛ и паспорт" },
      transitions: [
        { id: "t1", condition: "yes", targetStepId: "step2" },
        { id: "t2", condition: "no", targetStepId: "step1_ext" },
      ],
      canvasPosition: { x: 250, y: 20 },
    },
    {
      id: "step1_ext",
      type: "external_action",
      config: {
        title: "Откройте доступ к данным",
        externalAction: {
          label: "Открыть OneID",
          instructionsHtml: "<p>Войдите в OneID и оставьте доступ только к ПИНФЛ и паспорту.</p>",
        },
      },
      transitions: [{ id: "t3", condition: "done", targetStepId: "step2" }],
      canvasPosition: { x: 40, y: 180 },
    },
    {
      id: "step2",
      type: "choice",
      config: { title: "Номер оформлен на вас?", subtitle: "Проверка владельца" },
      transitions: [
        { id: "t4", condition: "yes", targetStepId: "final" },
        { id: "t5", condition: "no", targetStepId: "step2_ext" },
      ],
      canvasPosition: { x: 300, y: 200 },
    },
    {
      id: "step2_ext",
      type: "external_action",
      config: {
        title: "Проверьте владельца номера",
        externalAction: {
          label: "Проверить номер",
          instructionsHtml: "<p>Наберите USSD-код оператора или откройте его приложение.</p>",
        },
      },
      transitions: [{ id: "t6", condition: "done", targetStepId: "final" }],
      canvasPosition: { x: 500, y: 300 },
    },
    {
      id: "final",
      type: "final",
      config: { title: "Готово!", subtitle: "Открываем приложение банка" },
      transitions: [],
      canvasPosition: { x: 300, y: 420 },
    },
  ],
};

export const emptyStep = null;
