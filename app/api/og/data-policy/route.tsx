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
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
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
            data policy
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 500,
              color: '#8a6a58',
              letterSpacing: '-0.01em',
            }}
          >
            how cozy job tracker handles your data
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
