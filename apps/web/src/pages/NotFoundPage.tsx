import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main id="main-content" className="flex min-h-dvh flex-col bg-canvas px-6 py-16 text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">404</p>
      <h1 className="mt-4 max-w-[12ch] text-4xl leading-none text-balance">No such console view</h1>
      <p className="mt-4 max-w-[40ch] text-sm leading-6 text-mute">
        That route is not part of the agent workbench. Return to the current task.
      </p>
      <Link to="/" className="pressable mt-8 inline-flex h-10 w-fit items-center rounded-md bg-accent px-4 text-sm text-canvas">
        Back to workbench
      </Link>
    </main>
  );
}
