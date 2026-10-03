import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Минималистичный WYSIWYG-редактор на Tiptap для админки:
 * B / I / H2 / H3 / списки / цитата / ссылка / картинка по URL.
 * Картинку/ссылку пока просим через prompt — для админки этого хватает,
 * загрузку файлов добавим позже через отдельный роутер.
 */
export function TiptapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-sm transition-colors ${
      active
        ? 'bg-emerald-600 text-white'
        : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
    }`;

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL ссылки', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL изображения');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="rounded-md border border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex flex-wrap gap-1 border-b border-neutral-800 p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))}
          aria-label="Жирный"
        >
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))}
          aria-label="Курсив"
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive('heading', { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive('bulletList'))}
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive('orderedList'))}
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive('blockquote'))}
          aria-label="Цитата"
        >
          ❝
        </button>
        <button
          type="button"
          onClick={addLink}
          className={btn(editor.isActive('link'))}
          aria-label="Ссылка"
        >
          🔗
        </button>
        <button type="button" onClick={addImage} className={btn(false)} aria-label="Картинка">
          🖼
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none p-3 min-h-[300px] focus:outline-none"
      />
    </div>
  );
}
