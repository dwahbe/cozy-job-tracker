'use client';

import { useState } from 'react';

export default function CopyLink() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = window.location.origin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <span className="relative">
      <button
        onClick={handleCopy}
        className="text-sm sm:text-base font-medium underline underline-offset-2 decoration-dashed hover:decoration-solid cursor-pointer"
      >
        📬 send this to your unemployed friend
      </button>
      <span
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 text-sm text-green-600 whitespace-nowrap transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0'}`}
      >
        Copied!
      </span>
    </span>
  );
}
