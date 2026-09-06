import { useMemo, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { ApprovalPolicy, InteractionMode, ThinkingLevel, WorkItemSummary } from "@mowen/protocol";
import { ConversationTimeline } from "../timeline/ConversationTimeline";
import { PromptComposer, type ComposerImage } from "../composer/PromptComposer";
import { useAgentStore } from "../../stores/agent-store";
import { socketClient } from "../../transport/socket-client";

type Props = {
  item: WorkItemSummary;
  onClose: () => void;
  onOpenFull: () => void;
};

export function WorkConversationDrawer({ item, onClose, onOpenFull }: Props) {
  const tasks = useAgentStore((state) => state.tasks);
  const messages = useAgentStore((state) => state.messages);
  const tools = useAgentStore((state) => state.tools);
  const models = useAgentStore((state) => state.models);
  const thinkingLevels = useAgentStore((state) => state.thinkingLevels);
  const files = useAgentStore((state) => state.fileEntries);
  const commands = useAgentStore((state) => state.commands);
  const connection = useAgentStore((state) => state.connection);
  const approval = useAgentStore((state) => state.approval);
  const pendingInteractions = useAgentStore((state) => state.pendingInteractions);
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<ComposerImage[]>([]);
  const task = useMemo(() => tasks.find((entry) => entry.id === item.taskId), [item.taskId, tasks]);
  const status = task?.status ?? "stopped";

  if (!item.taskId || !task) {
    return (
      <div className="work-panel-layer" role="presentation">
        <button type="button" className="work-panel-scrim" aria-label="关闭对话" onClick={onClose} />
        <aside className="work-panel work-conversation-panel" role="dialog" aria-modal="true" aria-label="任务对话">
          <header className="work-panel-head">
            <h2>{item.title}</h2>
            <button type="button" className="pressable icon-btn" aria-label="关闭" onClick={onClose}>
              <X size={16} />
            </button>
          </header>
          <p className="p-5 text-[13px] text-mute">还没有对话。</p>
        </aside>
      </div>
    );
  }

  return (
    <div className="work-panel-layer" role="presentation">
      <button type="button" className="work-panel-scrim" aria-label="关闭对话" onClick={onClose} />
      <aside className="work-panel work-conversation-panel" role="dialog" aria-modal="true" aria-labelledby="work-conversation-title">
        <header className="work-panel-head">
          <div>
            <p className="work-panel-kicker">任务对话</p>
            <h2 id="work-conversation-title">{item.title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="pressable btn btn-ghost h-7" onClick={onOpenFull}>
              对话模式
              <ArrowUpRight size={13} />
            </button>
            <button type="button" className="pressable icon-btn" aria-label="关闭" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationTimeline messages={messages} tools={tools} />
        </div>
        <PromptComposer
          status={status}
          disabled={connection !== "open" || Boolean(approval) || pendingInteractions.some((entry) => entry.taskId === task.id)}
          models={models}
          thinkingLevels={thinkingLevels}
          modelId={task.model ? `${task.model.provider}/${task.model.id}` : null}
          thinkingLevel={task.thinkingLevel ?? "off"}
          mode={task.mode ?? "agent"}
          approvalPolicy={task.approvalPolicy ?? "auto"}
          files={files}
          commands={commands}
          hasTurns={messages.some((message) => message.role === "user")}
          value={draft}
          onChange={setDraft}
          onSend={() => {
            const text = draft;
            setDraft("");
            void socketClient.send("prompt.send", { message: text }, task.id);
          }}
          onSteer={() => {
            const text = draft;
            setDraft("");
            void socketClient.send("prompt.steer", { message: text }, task.id);
          }}
          onFollowUp={() => {
            const text = draft;
            setDraft("");
            void socketClient.send("prompt.followUp", { message: text }, task.id);
          }}
          onAbort={() => void socketClient.send("agent.abort", {}, task.id)}
          onModel={(provider, modelId) => void socketClient.send("model.set", { provider, modelId }, task.id)}
          onThinking={(level: ThinkingLevel) => void socketClient.send("thinking.set", { level }, task.id)}
          onPolicy={(mode: InteractionMode, approvalPolicy: ApprovalPolicy) =>
            void socketClient.send("task.policy.set", { mode, approvalPolicy }, task.id)
          }
          onImages={() => undefined}
          onRemoveImage={(id) => setImages((current) => current.filter((image) => image.id !== id))}
          onNeedFiles={() => void socketClient.send("files.tree", {}, task.id)}
          images={images}
        />
      </aside>
    </div>
  );
}
