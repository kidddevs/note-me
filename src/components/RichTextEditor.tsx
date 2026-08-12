import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { htmlToMarkdown, markdownToHtml } from "../lib/richtext";

export interface RichEditorHandle {
  exec: (command: string, value?: string) => void;
  focus: () => void;
  el: HTMLDivElement | null;
}

interface Props {
  value: string;
  onChange: (md: string) => void;
}

export const RichTextEditor = forwardRef<RichEditorHandle, Props>(({ value, onChange }, ref) => {
  const elRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastSource = useRef(value);
  const initialized = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!initialized.current) {
      el.innerHTML = markdownToHtml(value);
      lastSource.current = value;
      initialized.current = true;
    } else if (value !== lastSource.current) {
      el.innerHTML = markdownToHtml(value);
      lastSource.current = value;
    }
  }, [value]);

  const sync = () => {
    const el = elRef.current;
    if (!el) return;
    const md = htmlToMarkdown(el.innerHTML);
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
      className="rich-editor markdown"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Start writing…"
      spellCheck={false}
      onInput={sync}
      onBlur={sync}
      onPaste={(e) => {
        // keep formatted paste but ensure it lands in the editor
        e.stopPropagation();
      }}
    />
  );
});
