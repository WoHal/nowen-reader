"use client";

import { useState } from "react";
import { Library, Book, BookOpen, Layers, Check } from "lucide-react";
import type { Library as LibraryType } from "@/api/libraries";

interface LibraryTabsBarProps {
  libraries: LibraryType[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const typeIcons: Record<string, typeof Library> = {
  comic: Book,
  novel: BookOpen,
  mixed: Layers,
};

function LibraryChip({
  label,
  count,
  icon: Icon,
  active,
  multiSelected,
  onClick,
}: {
  label: string;
  count: number;
  icon: typeof Library;
  active: boolean;
  multiSelected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
        active
          ? "bg-accent text-white shadow-sm shadow-accent/25"
          : multiSelected
            ? "bg-accent/15 text-accent border border-accent/30"
            : "bg-card text-muted border border-border/60 hover:text-foreground hover:bg-card-hover"
      }`}
      style={{ minHeight: 36 }}
    >
      {multiSelected && !active && (
        <Check className="h-3.5 w-3.5 shrink-0" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[120px]">{label}</span>
      <span className={`text-xs tabular-nums ${active ? "text-white/80" : "text-muted/70"}`}>
        {count}
      </span>
    </button>
  );
}

export function LibraryTabsBar({ libraries, selectedIds, onChange }: LibraryTabsBarProps) {
  const [multiMode, setMultiMode] = useState(false);
  const totalCount = libraries.reduce((sum, l) => sum + (l.comicCount ?? 0), 0);
  const isAll = selectedIds.length === 0;

  const handleAllClick = () => {
    onChange([]);
    if (!multiMode) setMultiMode(false);
  };

  const handleChipClick = (id: string) => {
    if (multiMode) {
      // toggle in multi-select
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange(next);
    } else {
      // single select
      onChange([id]);
    }
  };

  if (libraries.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted/70">
          <Library className="h-3.5 w-3.5" />
          我的书库
        </div>
        {libraries.length > 1 && (
          <button
            onClick={() => {
              setMultiMode(!multiMode);
              if (multiMode && selectedIds.length > 1) {
                // exiting multi-mode with multiple selected: keep first only
                onChange([selectedIds[0]]);
              }
            }}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              multiMode
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {multiMode ? "完成" : "多选"}
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <LibraryChip
          label="全部"
          count={totalCount}
          icon={Layers}
          active={isAll}
          onClick={handleAllClick}
        />
        {libraries.map((lib) => {
          const Icon = typeIcons[lib.type] ?? Library;
          const selected = selectedIds.includes(lib.id);
          const active = !multiMode && selectedIds.length === 1 && selected;
          return (
            <LibraryChip
              key={lib.id}
              label={lib.name}
              count={lib.comicCount ?? 0}
              icon={Icon}
              active={active}
              multiSelected={multiMode && selected}
              onClick={() => handleChipClick(lib.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
