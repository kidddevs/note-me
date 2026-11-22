import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { noteHtmlToMarkdown, noteMarkdownToHtml } from "../lib/noteRichtext";

export interface RichEditorHandle {
  exec: (command: string, value?: string) => void;
  focus: () => void;
  el: HTMLDivElement | null;
}

interface Props {
  value: string;
  onChange: (md: string) => void;
  spellcheck?: boolean;
}

export const RichTextEditor = forwardRef<RichEditorHandle, Props>(({ value, onChange, spellcheck }, ref) => {
  const elRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastSource = useRef(value);
  const initialized = useRef(false);
  const lastHtml = useRef("");

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!initialized.current) {
      el.innerHTML = noteMarkdownToHtml(value);
      lastHtml.current = el.innerHTML;
      lastSource.current = value;
      initialized.current = true;
    } else if (value !== lastSource.current) {
      el.innerHTML = noteMarkdownToHtml(value);
      lastHtml.current = el.innerHTML;
      lastSource.current = value;
    }
  }, [value]);

  const sync = () => {
    const el = elRef.current;
    if (!el) return;
    if (el.innerHTML === lastHtml.current) return;
    const md = noteHtmlToMarkdown(el.innerHTML);
    lastHtml.current = el.innerHTML;
    lastSource.current = md;
    onChangeRef.current(md);
  };

  useImperativeHandle(ref, () => ({
    exec: (command, cmdValue) => {
      elRef.current?.focus();
      document.execCommand(command, false, cmdValue);
      sync();
    },
    focus: () => elRef.current?.focus(),
    get el() {
      return elRef.current;
    },
  }));

  return (
    <div
      ref={elRef}
      className="rich-editor markdown note-markdown"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Start writing…"
      spellCheck={!!spellcheck}
      role="textbox"
      aria-label="Rich text note"
      aria-multiline="true"
      onInput={sync}
      onBlur={sync}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey || event.nativeEvent.isComposing) return;
        const selection = window.getSelection();
        const element = selection?.anchorNode?.parentElement;
        if (element?.closest("li,blockquote,pre,h1,h2,h3,h4,h5,h6")) return;
        event.preventDefault();
        document.execCommand("insertLineBreak");
        sync();
      }}
      onPaste={(e) => {
        // keep formatted paste but ensure it lands in the editor
        e.stopPropagation();
      }}
    />
  );
});
