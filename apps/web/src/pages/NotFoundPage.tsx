import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main id="main-content" className="flex min-h-dvh flex-col bg-canvas px-6 py-16 text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">404</p>
      <h1 className="mt-4 max-w-[12ch] text-4xl leading-none text-balance">没有这个页面</h1>
      <p className="mt-4 max-w-[40ch] text-sm leading-6 text-mute">
        这个地址不属于墨问。返回当前对话。
      </p>
      <Link to="/" className="pressable btn btn-primary mt-8 w-fit">
        返回对话
      </Link>
    </main>
  );
}
