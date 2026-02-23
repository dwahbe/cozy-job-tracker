'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const dummyJobs = [
  {
    title: 'Program Manager',
    company: 'Habitat for Humanity',
    status: 'Applied',
    location: 'Atlanta, GA',
    type: 'Full-time',
    notes: 'Asked Maria for a referral',
    due: '2026-03-10',
  },
  {
    title: 'Barista',
    company: 'Blue Bottle Coffee',
    status: 'Interview',
    location: 'Brooklyn, NY',
    type: 'Part-time',
    notes: 'Interview Tuesday at 10am',
    due: '2026-03-05',
  },
  {
    title: 'Marketing Coordinator',
    company: 'Patagonia',
    status: 'Saved',
    location: 'Ventura, CA',
    type: 'Full-time',
    notes: '',
    due: '',
  },
];

const statusClass: Record<string, string> = {
  Saved: 'status-saved',
  Applied: 'status-applied',
  Interview: 'status-interview',
  Offer: 'status-offer',
  Rejected: 'status-rejected',
};

function HandDrawnNumber({ n }: { n: number }) {
  const paths: Record<number, string[]> = {
    1: ['M 15 15 L 19 11 L 19 31', 'M 14 31 L 24 31'],
    2: ['M 13 14 C 13 10, 22 8, 24 14 C 26 20, 12 28, 12 31 L 26 31'],
    3: [
      'M 12 12 C 18 8, 28 10, 24 17 C 22 20, 18 20, 20 20 C 24 20, 28 24, 22 30 C 18 33, 12 30, 12 28',
    ],
  };
  return (
    <svg viewBox="0 0 38 40" className="hiw-step-number" aria-hidden="true">
      <ellipse
        cx="19"
        cy="20"
        rx="17"
        ry="18"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="4 2"
      />
      {paths[n].map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function HandDrawnArrow({
  direction,
  delay = 0.15,
}: {
  direction: 'down-right' | 'down-left';
  delay?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const path =
    direction === 'down-right'
      ? 'M 10 10 C 40 12, 130 8, 180 30 Q 200 42, 195 58'
      : 'M 200 10 C 170 12, 80 8, 30 30 Q 10 42, 15 58';

  const arrowHead =
    direction === 'down-right' ? 'M 188 50 L 194 64 L 202 52' : 'M 22 50 L 16 64 L 8 52';

  return (
    <svg ref={ref} viewBox="0 0 210 72" className="hiw-arrow-h" aria-hidden="true">
      <motion.path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay }}
      />
      <motion.path
        d={arrowHead}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: delay + 0.75 }}
      />
    </svg>
  );
}

function HandDrawnArrowVertical() {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <svg ref={ref} viewBox="0 0 60 80" className="hiw-arrow-v" aria-hidden="true">
      <motion.path
        d="M 30 5 C 26 20, 22 30, 28 45 C 34 55, 36 60, 30 70"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
      />
      <motion.path
        d="M 23 63 L 30 76 L 35 63"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: 0.8 }}
      />
    </svg>
  );
}

function StepCard({
  step,
  title,
  description,
  children,
  index,
  align,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  index: number;
  align: 'left' | 'right' | 'full';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <motion.div
      ref={ref}
      className={`hiw-step hiw-step-${align}`}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.05 }}
    >
      <div className="hiw-step-header">
        <HandDrawnNumber n={step} />
        <div>
          <h3 className="hiw-step-title">{title}</h3>
          <p className="hiw-step-desc">{description}</p>
        </div>
      </div>
      <div className="hiw-step-visual">{children}</div>
    </motion.div>
  );
}

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="browser-chrome">
      <div className="browser-chrome-bar">
        <div className="browser-chrome-dots">
          <span className="browser-dot browser-dot-red" />
          <span className="browser-dot browser-dot-yellow" />
          <span className="browser-dot browser-dot-green" />
        </div>
        <div className="browser-chrome-url">{url}</div>
      </div>
      <div className="browser-chrome-body">{children}</div>
    </div>
  );
}

function JobListingMockup() {
  return (
    <BrowserChrome url="linkedin.com/jobs">
      <div className="mock-listing">
        <div className="mock-listing-item">
          <div className="mock-listing-logo mock-listing-logo-alt2">H</div>
          <div className="mock-listing-info">
            <div className="mock-listing-title">Program Manager</div>
            <div className="mock-listing-company">Habitat for Humanity · Atlanta, GA</div>
          </div>
          <div className="mock-listing-cta">Apply</div>
        </div>
        <div className="mock-listing-item mock-listing-item-faded">
          <div className="mock-listing-logo">B</div>
          <div className="mock-listing-info">
            <div className="mock-listing-title">Barista</div>
            <div className="mock-listing-company">Blue Bottle Coffee · Brooklyn, NY</div>
          </div>
          <div className="mock-listing-cta">Apply</div>
        </div>
        <div className="mock-listing-item mock-listing-item-faded">
          <div className="mock-listing-logo mock-listing-logo-alt">P</div>
          <div className="mock-listing-info">
            <div className="mock-listing-title">Marketing Coordinator</div>
            <div className="mock-listing-company">Patagonia · Ventura, CA</div>
          </div>
          <div className="mock-listing-cta">Apply</div>
        </div>
      </div>
    </BrowserChrome>
  );
}

function ParseMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div ref={ref} className="parse-mockup">
      <div className="parse-input-row">
        <div className="parse-input">
          <span className="parse-input-icon">🔗</span>
          <span className="parse-input-url">https://habitat.org/careers/program-manager</span>
        </div>
        <div className="parse-btn">Add</div>
      </div>
      <motion.div
        className="parse-result"
        initial={{ opacity: 0, height: 0 }}
        animate={isInView ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.4 }}
      >
        <div className="parse-result-inner">
          <div className="parse-shimmer" />
          <div className="parse-fields">
            <div className="parse-field">
              <span className="parse-field-label">Title</span>
              <span className="parse-field-value">Program Manager</span>
            </div>
            <div className="parse-field">
              <span className="parse-field-label">Company</span>
              <span className="parse-field-value">Habitat for Humanity</span>
            </div>
            <div className="parse-field">
              <span className="parse-field-label">Location</span>
              <span className="parse-field-value">Atlanta, GA</span>
            </div>
            <div className="parse-field">
              <span className="parse-field-label">Type</span>
              <span className="parse-field-value">Full-time</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DummyTable() {
  return (
    <div className="dummy-table-wrap">
      <table className="dummy-table">
        <thead>
          <tr>
            <th className="dummy-th-title">Title / Link</th>
            <th>Company</th>
            <th>Location</th>
            <th>Type</th>
            <th>Due date</th>
            <th>Salary / notes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {dummyJobs.map((job) => (
            <tr key={job.title}>
              <td className="dummy-td-title">{job.title}</td>
              <td className="dummy-td-company">{job.company}</td>
              <td className="dummy-td-muted">{job.location}</td>
              <td className="dummy-td-muted">{job.type}</td>
              <td className="dummy-td-muted">{formatDate(job.due)}</td>
              <td className="dummy-td-notes">{job.notes || '—'}</td>
              <td>
                <span className={`dummy-card-status ${statusClass[job.status]}`}>{job.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="hiw">
      <h2 className="hiw-heading" style={{ fontSize: '1.35rem' }}>
        Here&apos;s how it works
      </h2>

      <div className="hiw-steps">
        <StepCard
          step={1}
          title="Find jobs you're interested in"
          description="Browse job boards like you normally would — LinkedIn, Indeed, company sites, wherever."
          index={0}
          align="left"
        >
          <JobListingMockup />
        </StepCard>

        <div className="hiw-arrow-row">
          <HandDrawnArrow direction="down-right" />
          <HandDrawnArrowVertical />
        </div>

        <StepCard
          step={2}
          title="Paste the URL, we parse it for you"
          description="Drop in a job posting link and cozy job tracker pulls out the title, company, location, and more."
          index={1}
          align="right"
        >
          <ParseMockup />
        </StepCard>

        <div className="hiw-arrow-row">
          <HandDrawnArrow direction="down-left" delay={1} />
          <HandDrawnArrowVertical />
        </div>

        <StepCard
          step={3}
          title="Added to your board!"
          description="Customize with statuses, notes, due dates, and your own columns. That's it — no fluff."
          index={2}
          align="full"
        >
          <DummyTable />
        </StepCard>
      </div>
    </section>
  );
}
