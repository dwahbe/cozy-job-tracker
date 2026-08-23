'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface FeedbackButtonProps {
  className?: string;
  children?: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FeedbackButton({ className, children }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  // Honeypot: real people never see or fill this field; bots that do are quietly dropped.
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Whether the modal has been open, so the close branch below only runs on a real close — not
  // on mount, where it would pull focus to this button (there's one in the footer of every page).
  const wasOpenRef = useRef(false);
  const titleId = useId();

  // Focus the textarea when the modal opens; give focus back to the trigger when it closes.
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      textareaRef.current?.focus();
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
  }, [isOpen]);

  // Escape closes; Tab cycles inside the modal while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const elements = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (honeypot) {
      // Looks like a bot — pretend it worked and send nothing.
      setStatus('sent');
      setMessage('');
      return;
    }

    setStatus('sending');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: '7cc6869b-32c5-4d03-a654-bcd6b5479e54',
          subject: 'Cozy Job Tracker Feedback',
          message: message,
          from_name: 'Cozy Job Tracker User',
          botcheck: honeypot,
        }),
      });

      if (res.ok) {
        setStatus('sent');
        setMessage('');
        setTimeout(() => {
          setIsOpen(false);
          setStatus('idle');
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ||
          'text-sm sm:text-base font-medium underline underline-offset-2 decoration-dashed hover:decoration-solid cursor-pointer'
        }
        aria-label="Send feedback"
        aria-haspopup="dialog"
      >
        {children || (className ? 'Send feedback' : '💬 Send feedback')}
      </button>

      {isOpen &&
        createPortal(
          // data-feedback-modal lets the header/mobile menus ignore clicks that land in here.
          <div className="feedback-overlay" data-feedback-modal>
            <div
              ref={modalRef}
              className="feedback-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="feedback-header">
                <h3 id={titleId}>Send feedback</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="feedback-close"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {status === 'sent' ? (
                <div className="feedback-success" role="status">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p>Thanks for your feedback!</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <label htmlFor={`${titleId}-message`} className="sr-only">
                    Your feedback
                  </label>
                  <textarea
                    id={`${titleId}-message`}
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Bugs, feature requests, love notes..."
                    className="feedback-textarea"
                    rows={4}
                    disabled={status === 'sending'}
                  />
                  <input
                    type="text"
                    name="botcheck"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />
                  {status === 'error' && (
                    <p className="feedback-error" role="alert">
                      something went wrong, try again?
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!message.trim() || status === 'sending'}
                    className="btn btn-primary w-full"
                  >
                    {status === 'sending' ? 'sending...' : 'send'}
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
