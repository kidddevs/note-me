import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import { createMarkdownConverter } from "./richtext";

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { line: number; column?: number }; end: { line: number; column?: number } };
  data?: { hProperties?: Record<string, string> };
}

/** Render source line breaks and blank rows explicitly, without enabling raw HTML. */
export function remarkNoteSpacing() {
  return (tree: MarkdownNode, file: { value: unknown }) => {
    const lines = String(file.value).replace(/\r\n/g, "\n").split("\n");
    const lineBreak = (indent = ""): MarkdownNode => ({ type: "break", data: { hProperties: { "data-note-break": "true", ...(indent ? { "data-note-indent": indent } : {}) } } });
    const gap = (): MarkdownNode => ({ type: "paragraph", data: { hProperties: { "data-note-blank": "true" } }, children: [lineBreak()] });
    const visit = (node: MarkdownNode, parent?: MarkdownNode, inProse = false) => {
      if (!node.children || node.type === "code") return;
      const prose = inProse || node.type === "paragraph" && parent?.type === "root";
      const children: MarkdownNode[] = [];
      if (node.type === "paragraph" && parent?.type === "root" && node.position) {
        const prefix = lines[node.position.start.line - 1].slice(0, (node.position.start.column ?? 1) - 1);
        if (/^[ \t]+$/.test(prefix)) children.push({ type: "text", value: prefix });
      }
      const flow = ["root", "blockquote", "listItem"].includes(node.type);
      let previous = node.type === "root" ? 0 : node.position?.start.line ?? 1;
      for (const child of node.children) {
        if (flow && child.position) {
          for (let line = previous + 1; line < child.position.start.line; line += 1) {
            if (!lines[line - 1]?.replace(/^\s*>\s?/, "").trim()) children.push(gap());
          }
        }
        visit(child, node, prose);
        if (child.type === "text" && child.value?.includes("\n")) {
          child.value.split("\n").forEach((value, index) => {
            const indent = index && prose && child.position ? lines[child.position.start.line + index - 1]?.match(/^[ \t]+/)?.[0] ?? "" : "";
            if (index) children.push(lineBreak(indent));
            if (value) children.push({ type: "text", value });
          });
        } else {
          if (child.type === "break") {
            const indent = prose && child.position ? lines[child.position.end.line - 1]?.match(/^[ \t]+/)?.[0] : undefined;
            child.data = { ...child.data, hProperties: { ...child.data?.hProperties, "data-note-break": "true", ...(indent ? { "data-note-indent": indent } : {}) } };
          }
          children.push(child);
        }
        previous = child.position?.end.line ?? previous;
      }
      if (node.type === "paragraph" && parent?.type === "root" && node.position) {
        const trailing = lines[node.position.end.line - 1]?.match(/[ \t]+$/)?.[0];
        const last = children[children.length - 1];
        if (trailing && !(last?.type === "text" && last.value?.endsWith(trailing))) children.push({ type: "text", value: trailing });
      }
      if (node.type === "root") {
        for (let line = previous + 1; line <= lines.length; line += 1) if (!lines[line - 1]?.trim()) children.push(gap());
      }
      node.children = children;
    };
    visit(tree);
  };
}

export function NoteMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkNoteSpacing]} rehypePlugins={[rehypeNoteBreaks]}>{content}</ReactMarkdown>;
}

function rehypeNoteBreaks() {
  type HtmlNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HtmlNode[] };
  return (tree: HtmlNode) => {
    const visit = (node: HtmlNode) => {
      node.children?.forEach((child, index, children) => {
        // mdast's BR handler adds a formatting LF. pre-wrap would display it twice.
        const previous = children[index - 1];
        if (child.type === "text" && previous?.tagName === "br") {
          const indent = previous.properties?.dataNoteIndent ?? previous.properties?.["data-note-indent"];
          child.value = (typeof indent === "string" ? indent : "") + (child.value?.replace(/^\n/, "") ?? "");
        }
        visit(child);
      });
    };
    visit(tree);
  };
}

export function noteMarkdownToHtml(content: string) {
  return content ? renderToStaticMarkup(<NoteMarkdown content={content} />) : "";
}

/** Keep visual line boundaries out of Turndown's whitespace collapsing pass. */
export function noteHtmlToMarkdown(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  let marker = "\uE000\uE001";
  while (html.includes(marker) || body.textContent?.includes(marker)) marker += "\uE001";
  const line = marker + "L", end = marker + "E", space = marker + "S", tab = marker + "T", nbsp = marker + "N";
  const decode = (value: string) => value.split(space).join(" ").split(tab).join("\t").split(nbsp).join("\u00a0").split(line).join("\n").split(end).join("\n");
  const encode = (value: string) => value.replace(/ /g, space).replace(/\t/g, tab).replace(/\u00a0/g, nbsp).replace(/\r?\n/g, line);
  // A browser's final unmarked BR holds the caret; authored/rendered breaks remain.
  for (const container of [body, ...body.querySelectorAll("p,div,li")]) {
    let last = container.lastChild;
    while (last instanceof Element && !/^(P|DIV|LI|UL|OL|BLOCKQUOTE|PRE|CODE|BR)$/.test(last.tagName)) last = last.lastChild;
    if (last instanceof Element && last.tagName === "BR" && (!last.hasAttribute("data-note-break") || container.hasAttribute("data-note-blank"))) last.remove();
    else if (last?.nodeType === 3) (last as Text).data = (last as Text).data.replace(/\n$/, "");
  }
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest("pre,code")) continue;
    if (node.previousSibling instanceof Element && node.previousSibling.matches('br[data-note-break="true"]')) node.data = node.data.replace(/^\n/, "");
    // Static Markdown HTML includes formatting newlines between block elements.
    if (/^[\r\n\t ]*\n[\r\n\t ]*$/.test(node.data) && node.parentElement?.matches("body,div,ul,ol,blockquote,table,thead,tbody,tr")) node.remove();
    else node.data = encode(node.data);
  }
  const converter = createMarkdownConverter({ preformattedCode: true, blankReplacement: (_content, node) => /^(P|DIV)$/.test(node.nodeName) ? end : "" });
  const escape = converter.escape.bind(converter);
  converter.escape = (value) => encode(escape(decode(value)));
  const wrap = (value: string, delimiter: string) => {
    const tokens = [space, tab, nbsp, line];
    let leading = "", trailing = "";
    while (tokens.some((token) => value.startsWith(token))) {
      const token = tokens.find((item) => value.startsWith(item))!;
      leading += token; value = value.slice(token.length);
    }
    while (tokens.some((token) => value.endsWith(token))) {
      const token = tokens.find((item) => value.endsWith(item))!;
      trailing = token + trailing; value = value.slice(0, -token.length);
    }
    return leading + (value ? delimiter + value + delimiter : "") + trailing;
  };
  converter.addRule("noteStrong", { filter: ["strong", "b"], replacement: (content) => wrap(content, "**") });
  converter.addRule("noteEmphasis", { filter: ["em", "i"], replacement: (content) => wrap(content, "*") });
  converter.addRule("noteStrike", { filter: (node) => ["S", "DEL", "STRIKE"].includes(node.nodeName), replacement: (content) => wrap(content, "~~") });
  converter.addRule("noteUnderline", { filter: "u", replacement: (content) => wrap(content, "++") });
  converter.addRule("noteBreak", { filter: "br", replacement: () => line });
  converter.addRule("noteLines", {
    filter: ["p", "div"],
    replacement: (content, node) => {
      const element = node as HTMLElement;
      if (element.hasAttribute("data-note-blank") && !element.textContent) return end;
      if (element.closest("li,td,th")) return `\n\n${content}\n\n`;
      const previous = element.previousSibling;
      const inlineBefore = previous && !(previous instanceof Element && /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|BR|HR)$/.test(previous.tagName));
      return (inlineBefore ? line : "") + content + (content.endsWith(end) ? "" : end);
    },
  });
  converter.addRule("noteQuote", {
    filter: "blockquote",
    replacement: (content) => `\n\n${decode(content).replace(/\n$/, "").split("\n").map((value) => `> ${value}`).join("\n")}\n\n`,
  });
  converter.addRule("noteTask", {
    filter: (node) => node.nodeName === "LI" && Boolean(node.querySelector("input[type=checkbox]")),
    replacement: (content, node) => {
      const checked = (node as HTMLElement).querySelector<HTMLInputElement>("input[type=checkbox]")?.checked;
      const value = content.replace(/^\n+|\n+$/g, "");
      return `- [${checked ? "x" : " "}] ${value.startsWith(space) ? value.slice(space.length) : value}\n`;
    },
  });
  let result = "";
  for (const child of Array.from(body.childNodes)) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(child.cloneNode(true));
    const converted = converter.turndown(wrapper);
    if (!converted) continue;
    const block = child instanceof Element && /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|PRE|TABLE|HR)$/.test(child.tagName);
    if (block && result && !result.endsWith(end) && !result.endsWith(line)) result += line;
    result += converted;
    if (block && !result.endsWith(end)) result += end;
  }
  if (result.endsWith(end)) result = result.slice(0, -end.length);
  return decode(result);
}
