import { useMemo, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { ApprovalPolicy, InteractionMode, ThinkingLevel, WorkItemSummary } from "@qingzhou/protocol";
import { ConversationTimeline } from "../timeline/ConversationTimeline";
import { PromptComposer, type ComposerImage } from "../composer/PromptComposer";
import { useAgentStore } from "../../stores/agent-store";
import { socketClient } from "../../transport/socket-client";

type Props = {
  item: WorkItemSummary;
  onClose: () => void;
  onOpenFull: () => void;
};

function DrawerConversation({ taskId }: { taskId: string }) {
  const messages = useAgentStore((state) => state.messagesByTask[taskId] ?? state.messages);
  const tools = useAgentStore((state) => state.toolsByTask[taskId] ?? state.tools);
  return <ConversationTimeline messages={messages} tools={tools} />;
}

export function WorkConversationDrawer({ item, onClose, onOpenFull }: Props) {
  const tasks = useAgentStore((state) => state.tasks);
  const messages = useAgentStore((state) =>
    item.taskId ? (state.messagesByTask[item.taskId] ?? state.messages) : state.messages,
  );
  const models = useAgentStore((state) => state.models);
  const thinkingLevels = useAgentStore((state) => state.thinkingLevels);
  const files = useAgentStore((state) =>
    item.taskId ? (state.fileEntriesByTask[item.taskId] ?? state.fileEntries) : state.fileEntries,
  );
  const commands = useAgentStore((state) =>
    item.taskId ? (state.commandsByTask[item.taskId] ?? state.commands) : state.commands,
  );
  const connection = useAgentStore((state) => state.connection);
  const pendingInteractions = useAgentStore((state) => state.pendingInteractions);
  const runtime = useAgentStore((state) =>
    item.taskId ? (state.runtimeByTask[item.taskId] ?? state.runtime) : state.runtime,
  );
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const task = useMemo(() => tasks.find((entry) => entry.id === item.taskId), [item.taskId, tasks]);
  const status = task?.status ?? "stopped";
  const hasTurns = messages.some((message) => message.role === "user");
  const blockingInteraction = pendingInteractions.some((entry) => entry.taskId === task?.id);

  async function uploadImages(filesToUpload: FileList | File[]) {
    const next: ComposerImage[] = [];
    for (const file of [...filesToUpload]) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/uploads", { method: "POST", credentials: "same-origin", body });
      if (!response.ok) {
        setUploadError(response.status === 413 ? "图片太大，换一张再试。" : "图片上传失败，请再试一次。");
        continue;
      }
      const json = (await response.json()) as { id: string };
      next.push({ id: json.id, previewUrl: URL.createObjectURL(file), name: file.name || "图片" });
    }
    if (next.length === 0) return;
    setUploadError(null);
    setImages((current) => [...current, ...next]);
  }

  function send(type: "prompt.send" | "prompt.steer" | "prompt.followUp") {
    if (!task) return;
    const text = draft;
    const attached = images;
    setDraft("");
    setImages([]);
    void socketClient.send(type, { message: text, imageIds: attached.map((image) => image.id) }, task.id).catch(() => {
      setDraft(text);
      setImages(attached);
    });
  }

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
          <DrawerConversation taskId={task.id} />
        </div>
        {uploadError ? (
          <p className="px-4 pb-1 text-[12px] text-danger" role="alert">
            {uploadError}
          </p>
        ) : null}
        <PromptComposer
          status={status}
          disabled={connection !== "open" || blockingInteraction}
          models={models}
          thinkingLevels={thinkingLevels}
          modelId={task.model ? `${task.model.provider}/${task.model.id}` : null}
          thinkingLevel={task.thinkingLevel ?? "off"}
          mode={task.mode ?? "agent"}
          approvalPolicy={task.approvalPolicy ?? "auto"}
          files={files}
          commands={commands}
          hasTurns={hasTurns}
          value={draft}
          onChange={setDraft}
          onSend={() => send("prompt.send")}
          onSteer={() => send("prompt.steer")}
          onFollowUp={() => send("prompt.followUp")}
          onAbort={() => void socketClient.send("agent.abort", {}, task.id)}
          onModel={(provider, modelId) => void socketClient.send("model.set", { provider, modelId }, task.id)}
          onThinking={(level: ThinkingLevel) => void socketClient.send("thinking.set", { level }, task.id)}
          onPolicy={(mode: InteractionMode, approvalPolicy: ApprovalPolicy) =>
            void socketClient.send("task.policy.set", { mode, approvalPolicy }, task.id)
          }
          onImages={(picked) => void uploadImages(picked)}
          onRemoveImage={(id) =>
            setImages((current) => {
              const gone = current.find((image) => image.id === id);
              if (gone) URL.revokeObjectURL(gone.previewUrl);
              return current.filter((image) => image.id !== id);
            })
          }
          onNeedFiles={() => void socketClient.send("files.tree", {}, task.id)}
          images={images}
          fastModeEnabled={runtime.fastModeEnabled}
          fastModeActive={runtime.fastModeActive}
          queuedSteering={runtime.steering}
          queuedFollowUp={runtime.followUp}
          onFastMode={
            typeof runtime.fastModeEnabled === "boolean"
              ? (enabled) => void socketClient.send("runtime.set", { fastMode: enabled }, task.id)
              : undefined
          }
        />
      </aside>
    </div>
  );
}
