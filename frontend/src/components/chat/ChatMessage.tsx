/**
 * ChatMessage Component
 * Individual message bubble for the chat interface
 *
 * Features:
 * - Different styles for user vs assistant messages
 * - Markdown rendering for assistant messages
 * - Timestamp display
 * - Copy button for code blocks
 * - Error and loading states
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Copy, Check, User, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime, copyToClipboard } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onRetry?: () => void;
}

/**
 * Simple markdown renderer for chat messages
 * Handles basic formatting: bold, italic, code, code blocks, links, lists
 */
function renderMarkdown(content: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  let codeBlockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <CodeBlock
            key={`code-${codeBlockKey++}`}
            code={codeBlockContent.trim()}
            language={codeBlockLanguage}
          />
        );
        codeBlockContent = '';
        codeBlockLanguage = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    // Regular text processing
    elements.push(
      <span key={`line-${i}`}>
        {renderInlineMarkdown(line)}
        {i < lines.length - 1 && <br />}
      </span>
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent) {
    elements.push(
      <CodeBlock
        key={`code-${codeBlockKey}`}
        code={codeBlockContent.trim()}
        language={codeBlockLanguage}
      />
    );
  }

  return elements;
}

/**
 * Render inline markdown elements (bold, italic, code, links)
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  // Process inline patterns
  const patterns = [
    // Inline code
    { regex: /`([^`]+)`/, render: (match: string) => (
      <code key={`inline-code-${keyCounter++}`} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-mono">
        {match}
      </code>
    )},
    // Bold
    { regex: /\*\*([^*]+)\*\*/, render: (match: string) => (
      <strong key={`bold-${keyCounter++}`}>{match}</strong>
    )},
    // Italic
    { regex: /\*([^*]+)\*/, render: (match: string) => (
      <em key={`italic-${keyCounter++}`}>{match}</em>
    )},
    // Links
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, render: (text: string, url?: string) => (
      <a
        key={`link-${keyCounter++}`}
        href={url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 hover:text-primary-700 underline underline-offset-2"
      >
        {text}
      </a>
    )},
  ];

  while (remaining.length > 0) {
    let foundMatch = false;

    for (const { regex, render } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index !== undefined) {
        // Add text before match
        if (match.index > 0) {
          elements.push(remaining.slice(0, match.index));
        }

        // Add matched element
        if (regex.source.includes('\\]\\(')) {
          // Link pattern
          elements.push(render(match[1], match[2]));
        } else {
          elements.push(render(match[1]));
        }

        remaining = remaining.slice(match.index + match[0].length);
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      // Check for list items
      if (remaining.startsWith('- ') || remaining.match(/^\d+\. /)) {
        const listMatch = remaining.match(/^(-|\d+\.) (.*)$/);
        if (listMatch) {
          elements.push(
            <span key={`list-${keyCounter++}`} className="block pl-4">
              {listMatch[1] === '-' ? '\u2022' : listMatch[1]} {listMatch[2]}
            </span>
          );
          remaining = '';
          continue;
        }
      }

      elements.push(remaining);
      break;
    }
  }

  return elements;
}

/**
 * Code block component with copy functionality
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
        <span className="text-xs font-medium text-slate-500">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 bg-slate-50 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-slate-800">{code}</code>
      </pre>
    </div>
  );
}

/**
 * Typing indicator dots animation
 */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export function ChatMessage({ message, isStreaming, onRetry }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isError = message.status === 'error';
  const isSending = message.status === 'sending';

  // Memoize rendered content for assistant messages
  const renderedContent = useMemo(() => {
    if (isAssistant && message.content) {
      return renderMarkdown(message.content);
    }
    return message.content;
  }, [isAssistant, message.content]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3',
        isUser && 'flex-row-reverse',
        isError && 'opacity-75'
      )}
      role="listitem"
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          isUser && 'bg-primary-600 text-white',
          isAssistant && 'bg-primary-100 text-primary-600'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[75%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser && 'bg-primary-600 text-white rounded-br-md',
            isAssistant && 'bg-slate-100 text-slate-800 rounded-bl-md',
            isError && 'bg-error-50 border border-error-200',
            isSending && 'opacity-70'
          )}
        >
          {/* Error indicator */}
          {isError && (
            <div className="flex items-center gap-2 mb-2 text-error-600 text-xs font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to send</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 ml-2 text-error-600 hover:text-error-700 underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Message text */}
          <div>
            {isAssistant ? renderedContent : message.content}
            {isStreaming && <TypingIndicator />}
          </div>
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'mt-1 text-xs text-slate-400',
            isUser && 'text-right'
          )}
        >
          <span>
            {isSending ? 'Sending...' : formatRelativeTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
