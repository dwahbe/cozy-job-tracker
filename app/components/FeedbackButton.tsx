'use client';

import { useState, useRef, useEffect } from 'react';

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
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
        onClick={() => setIsOpen(true)}
        className="text-sm sm:text-base font-medium underline underline-offset-2 decoration-dashed hover:decoration-solid cursor-pointer"
        aria-label="Send feedback"
      >
        💬 send feedback
      </button>

      {isOpen && (
        <div className="feedback-overlay">
          <div ref={modalRef} className="feedback-modal">
            <div className="feedback-header">
              <h3>send feedback</h3>
              <button onClick={() => setIsOpen(false)} className="feedback-close" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {status === 'sent' ? (
              <div className="feedback-success">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p>thanks for your feedback!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="ideas, bugs, love notes..."
                  className="feedback-textarea"
                  rows={4}
                  disabled={status === 'sending'}
                />
                {status === 'error' && (
                  <p className="feedback-error">something went wrong, try again?</p>
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
        </div>
      )}
    </>
  );
}
