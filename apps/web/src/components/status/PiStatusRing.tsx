import type { TaskStatus } from "@mypi/protocol";

type Props = {
  status: TaskStatus;
  size?: number;
};

const ARCS = [0, 120, 240];

export function PiStatusRing({ status, size = 28 }: Props) {
  const stroke = status === "error" ? "var(--color-danger)" : "var(--color-accent)";
  const spin = status === "running" || status === "booting" || status === "aborting";
  const breathe = status === "waiting_approval";
  const thin = status === "idle" || status === "stopped" || status === "queued";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={breathe ? "pi-ring-breathe" : undefined}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-line)" strokeWidth="1" />
      <g className={spin ? "pi-ring-spin" : undefined}>
        {ARCS.map((rotate, index) => {
          const hidden = status === "error" && index === 2;
          return (
            <circle
              key={rotate}
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke={stroke}
              strokeWidth={thin ? 1.15 : 1.7}
              strokeLinecap="round"
              strokeDasharray={hidden ? "0 56.55" : "11 45.55"}
              transform={`rotate(${rotate - 90} 12 12)`}
            />
          );
        })}
      </g>
    </svg>
  );
}
