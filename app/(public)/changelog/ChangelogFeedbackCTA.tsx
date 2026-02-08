'use client';

import { FeedbackButton } from '@/app/components/FeedbackButton';

export function ChangelogFeedbackCTA() {
  return (
    <div className="changelog-cta">
      <div className="changelog-cta-emoji">💡</div>
      <h3 className="changelog-cta-title">What should I build next?</h3>
      <p className="changelog-cta-desc">
        This project is shaped by your feedback. Tell me what would make your job search easier.
      </p>
      <div className="changelog-cta-action">
        <FeedbackButton />
      </div>
    </div>
  );
}
