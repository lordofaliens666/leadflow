import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Flow, Step, StepType } from "@leadflow/schema";
import { FlowRenderer } from "@leadflow/renderer";
import { initialFlow } from "./sampleFlow";
import { StepInspector } from "./StepInspector";

const STEP_LIBRARY: { type: StepType; label: string }[] = [
  { type: "choice", label: "Выбор ответа" },
  { type: "text_input", label: "Текст" },
  { type: "phone_input", label: "Телефон" },
  { type: "file_upload", label: "Файл/фото" },
  { type: "external_action", label: "Внешний шаг" },
  { type: "info", label: "Инфо-экран" },
  { type: "final", label: "Финальный экран" },
];

function stepToNode(step: Step, selected: boolean): Node {
  return {
    id: step.id,
    type: "step",
    position: step.canvasPosition,
    selected,
    data: { step },
  };
}

function flowToEdges(flow: Flow): Edge[] {
  const edges: Edge[] = [];
  for (const step of flow.steps) {
    for (const t of step.transitions) {
      edges.push({
        id: t.id,
        source: step.id,
        sourceHandle: t.condition,
        target: t.targetStepId,
        label: t.condition === "*" ? undefined : t.condition,
      });
    }
  }
  return edges;
}

function StepNode({ data, selected }: { data: { step: Step }; selected: boolean }) {
  const step = data.step;
  const handles =
    step.type === "choice"
      ? (step.config.options ?? []).map((o) => o.id)
      : step.type === "final"
      ? []
      : ["*"];

  return (
    <div className={"lf-node" + (selected ? " lf-node-selected" : "")}>
      <Handle type="target" position={Position.Top} />
      <p className="lf-node-title">{step.config.title || "(без названия)"}</p>
      <p className="lf-node-type">{step.type}</p>
      {handles.map((h, i) => (
        <Handle
          key={h}
          id={h}
          type="source"
          position={Position.Bottom}
          style={{ left: `${((i + 1) * 100) / (handles.length + 1)}%` }}
        />
      ))}
    </div>
  );
}

const nodeTypes = { step: StepNode };

export default function App() {
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow.startStepId);

  const nodes = useMemo(
    () => flow.steps.map((s) => stepToNode(s, s.id === selectedStepId)),
    [flow, selectedStepId]
  );
  const edges = useMemo(() => flowToEdges(flow), [flow]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlow((prev) => {
      const nodesNow = applyNodeChanges(changes, prev.steps.map((s) => stepToNode(s, s.id === selectedStepId)));
      const steps = prev.steps.map((s) => {
        const n = nodesNow.find((n) => n.id === s.id);
        return n ? { ...s, canvasPosition: n.position } : s;
      });
      return { ...prev, steps };
    });
  }, [selectedStepId]);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    setFlow((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== conn.source) return s;
        const condition = conn.sourceHandle ?? "*";
        const withoutOld = s.transitions.filter((t) => t.condition !== condition);
        return {
          ...s,
          transitions: [
            ...withoutOld,
            { id: `${s.id}-${condition}-${conn.target}`, condition, targetStepId: conn.target! },
          ],
        };
      }),
    }));
  }, []);

  function addStep(type: StepType) {
    const id = `step_${Date.now()}`;
    const defaults: Record<StepType, Step["config"]> = {
      choice: { title: "Новый вопрос", options: [{ id: "yes", label: "Да" }, { id: "no", label: "Нет" }] },
      text_input: { title: "Введите значение", placeholder: "Ответ" },
      phone_input: { title: "Введите телефон", placeholder: "+998 90 123 45 67" },
      file_upload: { title: "Загрузите файл" },
      external_action: { title: "Внешний шаг", externalAction: { label: "Открыть", instructionsHtml: "<p>Инструкция…</p>" } },
      info: { title: "Информация" },
      final: { title: "Готово" },
    };
    const newStep: Step = {
      id,
      type,
      config: defaults[type],
      transitions: [],
      canvasPosition: { x: 80 + Math.random() * 300, y: 80 + flow.steps.length * 40 },
    };
    setFlow((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
    setSelectedStepId(id);
  }

  function updateStep(next: Step) {
    setFlow((prev) => ({ ...prev, steps: prev.steps.map((s) => (s.id === next.id ? next : s)) }));
  }

  const selectedStep = flow.steps.find((s) => s.id === selectedStepId) ?? null;

  return (
    <div className="lf-app">
      <header className="lf-topbar">
        <span className="lf-flow-name">{flow.name}</span>
        <span className="lf-badge">черновик</span>
        <button className="lf-publish" onClick={() => alert("Публикация подключится к API на следующем шаге")}>
          Опубликовать
        </button>
      </header>

      <div className="lf-body">
        <aside className="lf-library">
          <p className="lf-panel-title">Библиотека шагов</p>
          {STEP_LIBRARY.map((item) => (
            <button key={item.type} className="lf-library-item" onClick={() => addStep(item.type)}>
              + {item.label}
            </button>
          ))}
        </aside>

        <div className="lf-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedStepId(n.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="lf-inspector">
          <p className="lf-panel-title">Свойства шага</p>
          {selectedStep ? (
            <StepInspector step={selectedStep} onChange={updateStep} />
          ) : (
            <p className="lf-empty-hint">Выберите узел на canvas</p>
          )}
        </aside>

        <aside className="lf-preview">
          <p className="lf-panel-title">Live preview</p>
          <div className="lf-phone">
            <FlowRenderer flow={flow} mode="preview" />
          </div>
        </aside>
      </div>
    </div>
  );
}
