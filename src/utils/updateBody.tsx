import type { ReactNode } from "react";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "code",
  "pre",
  "blockquote",
]);

const BLOCKED_TAGS = new Set([
  "script",
  "style",
  "img",
  "svg",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "source",
]);

function renderNode(node: ChildNode, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (BLOCKED_TAGS.has(tagName)) {
    return null;
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderNode(child, `${key}.${index}`)
  );

  if (!ALLOWED_TAGS.has(tagName)) {
    return <>{children}</>;
  }

  switch (tagName) {
    case "br":
      return <br key={key} />;
    case "p":
      return <p key={key}>{children}</p>;
    case "ul":
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {children}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {children}
        </ol>
      );
    case "li":
      return <li key={key}>{children}</li>;
    case "strong":
    case "b":
      return <strong key={key}>{children}</strong>;
    case "em":
    case "i":
      return <em key={key}>{children}</em>;
    case "u":
      return <u key={key}>{children}</u>;
    case "code":
      return (
        <code key={key} className="rounded bg-[#edf2f8] px-1 py-0.5 text-[0.95em]">
          {children}
        </code>
      );
    case "pre":
      return (
        <pre key={key} className="overflow-x-auto rounded bg-[#edf2f8] p-3 text-xs leading-5">
          {children}
        </pre>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-2 border-[#c5cfdb] pl-3 italic">
          {children}
        </blockquote>
      );
    default:
      return <>{children}</>;
  }
}

export function renderUpdateBody(body: string | null | undefined): ReactNode[] {
  if (!body?.trim()) {
    return [];
  }

  const document = new DOMParser().parseFromString(body, "text/html");
  return Array.from(document.body.childNodes)
    .map((node, index) => renderNode(node, String(index)))
    .filter((node): node is ReactNode => node !== null);
}