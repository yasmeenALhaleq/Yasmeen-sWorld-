"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Icon } from "@/components/ui/Icon";

// Rich text editor for product descriptions. Only formatting that the server
// sanitizer also allows is offered (see sanitizeDescription in admin-products).

function ToolButton({ label, active, onClick, children, disabled }: {
  label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold transition disabled:opacity-40 ${
        active ? "bg-primary text-on-primary" : "hover:bg-primary/10"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      }),
    ],
    content: value,
    immediatelyRender: false, // avoids a server/client markup mismatch
    editorProps: { attributes: { class: "rich min-h-44 px-4 py-3 outline-none", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? "" : ed.getHTML()),
  });

  // Keep the editor in step if the parent replaces the value (e.g. form reset).
  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? "" : editor.getHTML())) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="input min-h-56" aria-busy="true" />;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove the link)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (/^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    else window.alert("The link must start with https://, http://, mailto: or tel:");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink/25 bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
      <div className="flex flex-wrap gap-0.5 border-b border-ink/15 bg-primary/5 p-1.5" role="toolbar" aria-label="Text formatting">
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolButton>
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><span className="italic">I</span></ToolButton>
        <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><span className="underline">U</span></ToolButton>
        <span className="mx-1 w-px self-stretch bg-ink/15" />
        <ToolButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
        <ToolButton label="Sub-heading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
        <span className="mx-1 w-px self-stretch bg-ink/15" />
        <ToolButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolButton>
        <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ ”</ToolButton>
        <ToolButton label="Link" active={editor.isActive("link")} onClick={setLink}>Link</ToolButton>
        <span className="mx-1 w-px self-stretch bg-ink/15" />
        <ToolButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Icon name="chevron-left" className="h-4 w-4" /></ToolButton>
        <ToolButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Icon name="chevron-right" className="h-4 w-4" /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
