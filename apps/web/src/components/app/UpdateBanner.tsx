import { useUpdateStore } from "../../stores/update-store";

export function UpdateBanner() {
  const latest = useUpdateStore((state) => state.latest);
  const updateAvailable = useUpdateStore((state) => state.updateAvailable);
  const canUpdate = useUpdateStore((state) => state.canUpdate);
  const installing = useUpdateStore((state) => state.installing);
  const notice = useUpdateStore((state) => state.notice);
  const install = useUpdateStore((state) => state.install);
  const dismiss = useUpdateStore((state) => state.dismiss);

  if (!updateAvailable || !canUpdate || !latest) return null;

  return (
    <div className="update-banner" role="status">
      <span>{installing || notice ? notice || "正在更新…" : `墨问 ${latest} 可用`}</span>
      {installing || notice ? null : (
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="pressable btn btn-ghost h-7" onClick={dismiss}>
            稍后
          </button>
          <button type="button" className="pressable btn btn-primary h-7" onClick={() => void install()}>
            更新并重启
          </button>
        </div>
      )}
    </div>
  );
}
