import React from "react";

// URL regex pattern - matches http/https URLs
const URL_REGEX = /(https?:\/\/[^\s<>\[\]()]+[^\s<>\[\]().,;:'"!?])/g;

/**
 * Convert text with URLs into React elements with clickable links
 */
export function linkifyText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const url = match[1];
    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="message-link"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Linkify content while preserving line breaks (for use with pre tags)
 */
export function linkifyPreContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {linkifyText(line)}
      {i < lines.length - 1 && "\n"}
    </React.Fragment>
  ));
}
