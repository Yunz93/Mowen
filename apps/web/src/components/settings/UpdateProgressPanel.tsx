import {
  formatByteSize,
  getUpdateProgressBarPercent,
  type UpdateDownloadProgress,
  type UpdateInstallPhase,
} from "../../lib/update-progress";

type ActiveUpdatePhase = Exclude<UpdateInstallPhase, "idle">;

function phaseStatus(phase: ActiveUpdatePhase, version?: string): string {
  switch (phase) {
    case "preparing":
      return version ? `正在准备安装 ${version}…` : "正在准备安装…";
    case "installing":
      return "正在安装更新…";
    default:
      return "正在下载安装包…";
  }
}

export function UpdateProgressPanel({
  progress,
  version,
}: {
  progress: UpdateDownloadProgress;
  version?: string;
}) {
  if (progress.phase === "idle") return null;

  const percent = getUpdateProgressBarPercent(progress);
  const status = phaseStatus(progress.phase, version);
  const bytesLabel =
    progress.downloadSize && progress.downloadSize > 0
      ? `${formatByteSize(progress.downloadedBytes)} / ${formatByteSize(progress.downloadSize)}`
      : progress.downloadedBytes > 0
        ? `已下载 ${formatByteSize(progress.downloadedBytes)}`
        : null;

  return (
    <div
      className="update-progress"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="更新进度"
    >
      <div className="flex items-center justify-between gap-3 text-[12px] text-ink">
        <p className="font-medium">{status}</p>
        {percent !== null ? <p className="shrink-0 tabular-nums">下载进度 {percent}%</p> : null}
      </div>
      <div
        className="update-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent !== null ? `下载进度 ${percent}%` : status}
      >
        {percent !== null ? (
          <div className="update-progress-bar" style={{ width: `${percent}%` }} />
        ) : (
          <div className="update-progress-bar update-progress-indeterminate" />
        )}
      </div>
      {bytesLabel ? <p className="tabular-nums text-[11px] text-mute">{bytesLabel}</p> : null}
    </div>
  );
}
