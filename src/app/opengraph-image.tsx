import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Arbor — Developer Portal & Codebase Intelligence'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#090a0f',
          backgroundImage:
            'radial-gradient(circle at 25px 25px, #1a202c 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1a202c 2%, transparent 0%)',
          backgroundSize: '100px 100px',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Ambient Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        {/* Top Header / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 10 }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18" />
              <path d="M12 9l6-4" />
              <path d="M12 14l-6-4" />
              <path d="M12 17l6-3" />
            </svg>
          </div>
          <span style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-1px' }}>
            Arbor
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
            }}
          >
            v1.0 AST Engine
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 10, maxWidth: '900px' }}>
          <h1
            style={{
              fontSize: '54px',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
              margin: 0,
              background: 'linear-gradient(to right, #ffffff, #94a3b8)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Arbor: Automated Codebase Intelligence in 30 Seconds.
          </h1>
          <p
            style={{
              fontSize: '24px',
              lineHeight: 1.4,
              color: '#94a3b8',
              margin: 0,
            }}
          >
            Deterministic AST architectural audits, dependency graphs, and health scores directly from your GitHub repositories.
          </p>
        </div>

        {/* Bottom Feature Badges & Score Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: '1px solid #1e293b',
            paddingTop: '32px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 500 }}>
                Deterministic AST
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06b6d4' }} />
              <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 500 }}>
                Visual Dependency Graph
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
              <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 500 }}>
                Zero Code Stored
              </span>
            </div>
          </div>

          {/* Sample Score Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 20px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
            }}
          >
            <span style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Audit Score
            </span>
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#34d399' }}>
              88 / 100
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
