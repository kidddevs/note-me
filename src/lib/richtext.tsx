import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TurndownService from "turndown";

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (turndown) return turndown;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  td.addRule("taskListItem", {
    filter: (node) => {
      return (
        node.nodeName === "LI" &&
        !!node.querySelector &&
        !!node.querySelector("input[type='checkbox']")
      );
    },
    replacement: (content, node) => {
      const li = node as HTMLLIElement;
      const cb = li.querySelector("input[type='checkbox']") as HTMLInputElement | null;
      const checked = cb?.checked ? "x" : " ";
      const text = content.trim();
      return `- [${checked}] ${text}\n`;
    },
  });
  td.addRule("checkbox", {
    filter: "input",
    replacement: () => "",
  });
  turndown = td;
  return td;
}

export function markdownToHtml(md: string): string {
  if (!md.trim()) return "";
  return renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>);
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return getTurndown().turndown(doc.body);
}

export function isRichSupported(): boolean {
  return typeof document !== "undefined" && !!document.queryCommandSupported;
}
