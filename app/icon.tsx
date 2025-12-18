import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff2e2',
        borderRadius: '50%',
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soil/pot base */}
        <ellipse cx="16" cy="24" rx="7" ry="3" fill="#d97706" />

        {/* Stem */}
        <path
          d="M16 24 Q16 18 16 14"
          stroke="#65a30d"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left leaf */}
        <path d="M16 16 Q12 14 10 10 Q14 11 16 16" fill="#84cc16" />

        {/* Right leaf */}
        <path d="M16 14 Q20 11 22 7 Q18 10 16 14" fill="#65a30d" />
      </svg>
    </div>,
    {
      ...size,
    }
  );
}
