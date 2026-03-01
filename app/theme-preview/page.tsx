import type { Metadata } from 'next';
import { ThemeSwitcher } from './ThemeSwitcher';

export const metadata: Metadata = {
  title: 'theme preview — cozy job tracker',
  robots: 'noindex',
};

const statuses = ['saved', 'applied', 'interview', 'offer', 'rejected'] as const;

const dropdownColors = [
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;

const mockJobs = [
  { title: 'Senior Frontend Engineer', company: 'Vercel', status: 'interview', location: 'Remote', date: 'Feb 20' },
  { title: 'Full Stack Developer', company: 'Linear', status: 'applied', location: 'San Francisco, CA', date: 'Feb 18' },
  { title: 'Product Engineer', company: 'Notion', status: 'saved', location: 'New York, NY', date: 'Feb 15' },
  { title: 'Design Engineer', company: 'Figma', status: 'offer', location: 'Remote', date: 'Feb 12' },
  { title: 'Software Engineer', company: 'Stripe', status: 'rejected', location: 'Seattle, WA', date: 'Feb 10' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--muted-3)',
          marginBottom: '1rem',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 650,
        padding: '2px 10px',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
        backgroundColor: `var(--status-${status}-bg)`,
        color: `var(--status-${status}-text)`,
      }}
    >
      {status}
    </span>
  );
}

export default function ThemePreviewPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        background: `
          radial-gradient(800px 400px at 30% -5%, var(--gradient-1), transparent 70%),
          var(--background)
        `,
        zIndex: 100,
      }}
    >
      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem 8rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--foreground)',
              marginBottom: '0.5rem',
            }}
          >
            brand exploration
          </h1>
          <p style={{ color: 'var(--muted-2)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Toggle between themes to compare. Colors, fonts, radii, and shadows all update live.
          </p>
          <ThemeSwitcher />
        </div>

        {/* Color swatches */}
        <Section title="Core palette">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Background', var: '--background' },
              { label: 'Background 2', var: '--background-2' },
              { label: 'Surface', var: '--surface-solid' },
              { label: 'Foreground', var: '--foreground' },
              { label: 'Muted', var: '--muted' },
              { label: 'Muted 2', var: '--muted-2' },
              { label: 'Muted 3', var: '--muted-3' },
              { label: 'Accent', var: '--accent' },
              { label: 'Accent 2', var: '--accent-2' },
              { label: 'Border', var: '--border' },
              { label: 'Success', var: '--success' },
              { label: 'Danger', var: '--danger' },
            ].map((s) => (
              <div
                key={s.var}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-sm)',
                    background: `var(${s.var})`,
                    border: '1px solid var(--border)',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--muted-3)',
                    textAlign: 'center',
                    maxWidth: 56,
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                Default card
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted-2)', lineHeight: 1.5 }}>
                Cards use the surface background with a themed border and shadow. Great for grouping
                content.
              </p>
            </div>
            <div
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow)',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                Solid card
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted-2)', lineHeight: 1.5 }}>
                Solid variant with opaque white background for stronger contrast.
              </p>
            </div>
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--radius-full)',
                padding: '0.6rem 1rem',
                fontWeight: 650,
                letterSpacing: '-0.01em',
                color: 'white',
                background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
                boxShadow: '0 12px 22px var(--accent-tint-border)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Primary action
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--radius-full)',
                padding: '0.6rem 1rem',
                fontWeight: 650,
                letterSpacing: '-0.01em',
                color: 'var(--foreground)',
                background: 'rgba(255, 255, 255, 0.78)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Soft button
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderRadius: 'var(--radius-full)',
                padding: '0.6rem 1rem',
                fontWeight: 650,
                letterSpacing: '-0.01em',
                color: 'var(--muted-2)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Ghost button
            </button>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-full)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: 'white',
                background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Small primary
            </button>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
              maxWidth: '32rem',
            }}
          >
            <input
              readOnly
              placeholder="Type something..."
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.9rem',
                background: 'rgba(255, 255, 255, 0.88)',
                border: '1px solid var(--accent-tint-border)',
                color: 'var(--foreground)',
              }}
            />
            <select
              defaultValue=""
              style={{
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.9rem',
                background: 'rgba(255, 255, 255, 0.88)',
                border: '1px solid var(--accent-tint-border)',
                color: 'var(--foreground)',
              }}
            >
              <option value="" disabled>Select an option</option>
              <option>Option one</option>
              <option>Option two</option>
            </select>
          </div>
        </Section>

        {/* Status badges */}
        <Section title="Status badges">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {statuses.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </Section>

        {/* Dropdown colors */}
        <Section title="Dropdown palette">
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {dropdownColors.map((c) => (
              <span
                key={c}
                style={{
                  display: 'inline-flex',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: `var(--dropdown-${c}-bg)`,
                  color: `var(--dropdown-${c}-text)`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </Section>

        {/* Callouts */}
        <Section title="Callouts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '28rem' }}>
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 0.9rem',
                fontSize: '0.9rem',
                background: 'var(--accent-tint-medium)',
                border: '1px solid var(--accent-tint-border)',
                color: 'var(--foreground)',
              }}
            >
              Heads up — this is a warning callout for non-critical notices.
            </div>
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 0.9rem',
                fontSize: '0.9rem',
                background: 'var(--danger-soft)',
                border: '1px solid rgba(197, 48, 48, 0.25)',
                color: 'var(--danger)',
              }}
            >
              Something went wrong. This is an error callout.
            </div>
          </div>
        </Section>

        {/* Table preview — built with inline theme-responsive styles */}
        <Section title="Table preview">
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Title', 'Company', 'Location', 'Status', 'Added'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        letterSpacing: '0.01em',
                        color: 'var(--muted)',
                        background: 'var(--accent-tint-light)',
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockJobs.map((job) => (
                  <tr key={job.title}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--accent-tint-medium)', fontWeight: 550, color: 'var(--foreground)' }}>
                      {job.title}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--accent-tint-medium)', color: 'var(--muted)' }}>
                      {job.company}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--accent-tint-medium)', color: 'var(--muted-2)' }}>
                      {job.location}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--accent-tint-medium)' }}>
                      <StatusBadge status={job.status} />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--accent-tint-medium)', fontSize: '0.75rem', color: 'var(--muted-2)' }}>
                      {job.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography (Nunito)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--foreground)' }}>
              The quick brown fox
            </h1>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
              jumps over the lazy dog
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Nunito is a well balanced, highly readable sans-serif typeface with rounded terminals.
              It feels friendly and approachable without being childish — perfect for a cozy app
              that still means business. Available in weights from 200 to 900.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-2)', lineHeight: 1.6 }}>
              Body text at a smaller size. Job tracking should feel calm, not stressful.
              cozy job tracker helps you stay on top of your search without the spreadsheet chaos.
            </p>
            <p style={{ fontSize: '0.85rem', fontFamily: 'var(--font-geist-mono)', color: 'var(--muted-3)' }}>
              Monospace: Geist Mono (kept for code/technical content)
            </p>
          </div>
        </Section>

        {/* Radius preview */}
        <Section title="Border radius scale">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
            {[
              { label: 'sm', var: '--radius-sm' },
              { label: 'md', var: '--radius-md' },
              { label: 'lg', var: '--radius-lg' },
              { label: 'full', var: '--radius-full' },
            ].map((r) => (
              <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: r.label === 'full' ? 56 : 72,
                    height: r.label === 'full' ? 56 : 72,
                    borderRadius: `var(${r.var})`,
                    background: 'var(--accent-soft)',
                    border: '2px solid var(--accent)',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-3)', fontWeight: 600 }}>
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Shadow preview */}
        <Section title="Shadows">
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'default', shadow: 'var(--shadow)' },
              { label: 'hover', shadow: 'var(--shadow-hover)' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  width: 120,
                  height: 80,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-solid)',
                  boxShadow: s.shadow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  color: 'var(--muted-3)',
                  fontWeight: 600,
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </Section>

        {/* Topbar preview */}
        <Section title="Topbar preview">
          <div
            style={{
              background: 'var(--topbar-bg)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid var(--topbar-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
              cozy job tracker
            </span>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted-2)' }}>Board</span>
              <span style={{ color: 'var(--muted-2)' }}>Network</span>
              <span
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-soft)',
                }}
              >
                What&apos;s new
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
