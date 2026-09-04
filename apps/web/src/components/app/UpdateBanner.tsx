import { useEffect, useRef, useState } from "react";
import { ArrowUpCircle } from "lucide-react";
import { useUpdateStore } from "../../stores/update-store";

export function UpdateBanner() {
  const latest = useUpdateStore((state) => state.latest);
  const updateAvailable = useUpdateStore((state) => state.updateAvailable);
  const canUpdate = useUpdateStore((state) => state.canUpdate);
  const installing = useUpdateStore((state) => state.installing);
  const notice = useUpdateStore((state) => state.notice);
  const install = useUpdateStore((state) => state.install);
  const dismiss = useUpdateStore((state) => state.dismiss);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!updateAvailable || !canUpdate || !latest) return null;

  return (
    <div ref={rootRef} className="relative app-no-drag">
      <button
        type="button"
        className="pressable icon-btn text-accent"
        aria-label={`墨问 ${latest} 可用`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ArrowUpCircle size={15} />
        <span className="update-dot" />
      </button>
      {open ? (
        <div className="update-popover" role="status">
          <p>{installing || notice ? notice || "正在更新…" : `墨问 ${latest} 可用`}</p>
          {installing || notice ? null : (
            <div className="mt-2 flex justify-end gap-1.5">
              <button type="button" className="pressable btn btn-ghost h-7" onClick={dismiss}>
                稍后
              </button>
              <button type="button" className="pressable btn btn-primary h-7" onClick={() => void install()}>
                更新并重启
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
