import { useEffect, useState } from 'react';
import { slugify } from '@/lib/seo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Заголовок страницы — из него slug автогенерируется, пока стоит флаг «Авто». */
  sourceTitle?: string;
}

/**
 * Поле ввода URL-slug с чекбоксом «Авто из title».
 * Когда флаг включён и задан sourceTitle, slug пересчитывается автоматически.
 * Любая правка руками выключает авто-режим, чтобы не перетирать то, что ввёл админ.
 */
export function SlugInput({ value, onChange, sourceTitle }: Props) {
  const [auto, setAuto] = useState(!value);

  useEffect(() => {
    if (auto && sourceTitle) onChange(slugify(sourceTitle));
  }, [sourceTitle, auto, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="slug-auto"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className="size-4 rounded border-neutral-700 bg-transparent"
        />
        <Label htmlFor="slug-auto" className="text-sm text-neutral-300 cursor-pointer">
          Авто из title
        </Label>
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          setAuto(false);
          onChange(slugify(e.target.value));
        }}
        placeholder="my-page-slug"
      />
      <p className="text-xs text-neutral-500">
        Только латиница, цифры и дефисы. Кириллица транслитерируется автоматически.
      </p>
    </div>
  );
}
