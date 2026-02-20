import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
        </div>

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
            what&apos;s new
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 500,
              color: '#8a6a58',
              letterSpacing: '-0.01em',
            }}
          >
            the latest updates and improvements
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}
