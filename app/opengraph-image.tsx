import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'cozy job tracker - calm tracking for a noisy job search';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fff2e2 0%, #fffaf3 50%, #fff2e2 100%)',
        position: 'relative',
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          left: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          right: '-100px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'rgba(217, 119, 6, 0.12)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '200px',
          right: '100px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(251, 191, 36, 0.1)',
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          zIndex: 1,
        }}
      >
        {/* Logo/Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            boxShadow: '0 20px 40px rgba(217, 119, 6, 0.25)',
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#3a271d',
              letterSpacing: '-0.03em',
            }}
          >
            cozy job tracker
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 500,
              color: '#8a6a58',
              letterSpacing: '-0.01em',
            }}
          >
            calm tracking for a noisy job search
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
    }
  );
}
