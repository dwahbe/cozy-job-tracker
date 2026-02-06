'use client';

import { FeedbackButton } from '../components/FeedbackButton';

export function ChangelogFeedbackCTA() {
  return (
    <div className="changelog-cta">
      <div className="changelog-cta-emoji">💡</div>
      <h3 className="changelog-cta-title">what should i build next?</h3>
      <p className="changelog-cta-desc">
        this project is shaped by your feedback. tell me what would make your job search easier.
      </p>
      <div className="changelog-cta-action">
        <FeedbackButton />
      </div>
    </div>
  );
}
