"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LegalDocument } from "@/lib/legal/terms-content";

interface LegalScrollAcceptanceProps {
  document: LegalDocument;
  checkboxLabel: string;
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function LegalScrollAcceptance({
  document,
  checkboxLabel,
  name,
  checked,
  onCheckedChange,
}: LegalScrollAcceptanceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const atEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 12;
    if (atEnd) {
      setScrolledToEnd(true);
    }
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [updateScrollState, document.paragraphs]);

  useEffect(() => {
    if (!checked) {
      return;
    }

    if (!scrolledToEnd) {
      onCheckedChange(false);
    }
  }, [checked, onCheckedChange, scrolledToEnd]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{document.title}</p>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="max-h-44 overflow-y-auto rounded-md border bg-background p-3 text-sm leading-relaxed text-muted-foreground"
      >
        {document.paragraphs.map((paragraph, index) => (
          <p key={`${document.title}-${index}`} className={index > 0 ? "mt-2" : undefined}>
            {paragraph}
          </p>
        ))}
      </div>
      <label
        className={`flex cursor-pointer items-start gap-2 text-sm ${
          scrolledToEnd ? "text-foreground" : "cursor-not-allowed text-muted-foreground"
        }`}
      >
        <input
          type="checkbox"
          name={name}
          value="1"
          checked={checked}
          disabled={!scrolledToEnd}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 rounded border"
        />
        <span>{checkboxLabel}</span>
      </label>
      {!scrolledToEnd && (
        <p className="text-xs text-muted-foreground">Role o texto até o final para marcar.</p>
      )}
    </div>
  );
}
