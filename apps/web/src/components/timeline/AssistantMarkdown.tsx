import { Component, isValidElement, memo, type MouseEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import hljs from "highlight.js";
import { escapeHtml, shouldOpenMarkdownLink, stabilizeMarkdown } from "../../lib/assistant-markdown";

class MarkdownErrorBoundary extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <div className="markdown whitespace-pre-wrap">{this.props.text}</div>;
    }
    return this.props.children;
  }
}

function highlightCode(content: string, language?: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(content, { language }).value;
    }
    if (content.length > 8_000) return escapeHtml(content);
    return hljs.highlightAuto(content).value;
  } catch {
    return escapeHtml(content);
  }
}

function onMarkdownLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string | undefined): void {
  event.preventDefault();
  if (!shouldOpenMarkdownLink(href) || !href) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

function AssistantMarkdownView({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={(url) => (shouldOpenMarkdownLink(url) ? url : "")}
        components={{
          pre({ children }) {
            let language = "";
            let code = "";
            if (isValidElement(children)) {
              const props = children.props as { className?: string; children?: unknown };
              language = /language-([\w-]+)/.exec(props.className ?? "")?.[1] ?? "";
              code = String(props.children ?? "").replace(/\n$/, "");
            }
            const html = highlightCode(code, language);
            return (
              <pre className="markdown-pre">
                {language ? <div className="markdown-pre-lang">{language}</div> : null}
                <code dangerouslySetInnerHTML={{ __html: html }} />
              </pre>
            );
          },
          code({ children }) {
            return <code className="markdown-inline">{children}</code>;
          },
          a({ href, children }) {
            if (!shouldOpenMarkdownLink(href)) {
              return <span>{children}</span>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => onMarkdownLinkClick(event, href)}
              >
                {children}
              </a>
            );
          },
          input({ checked }) {
            return <input type="checkbox" checked={checked ?? false} disabled readOnly />;
          },
        }}
      >
        {stabilizeMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}

export const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  if (!text) return null;
  if (streaming) {
    return <div className="markdown whitespace-pre-wrap">{text}</div>;
  }
  return (
    <MarkdownErrorBoundary text={text}>
      <AssistantMarkdownView text={text} />
    </MarkdownErrorBoundary>
  );
});
