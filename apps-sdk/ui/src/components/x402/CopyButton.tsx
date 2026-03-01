import { useState, useCallback } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied!', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [text]);

  return (
    <button className={`x4-copy-btn ${copied ? 'x4-copy-btn--done' : ''} ${className}`} onClick={handleCopy}>
      {copied ? copiedLabel : label}
    </button>
  );
}

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  return { copied, copy };
}
