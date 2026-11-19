import { ImageResponse } from 'next/og';

export const alt = 'FateCal: your BaZi advisor that reads your schedule';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#F6F1E7', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', fontFamily: 'Georgia, serif' }}>
        <div style={{ fontSize: 96, fontWeight: 700, color: '#1F1B16' }}>FateCal</div>
        <div style={{ fontSize: 44, color: '#4A433B', marginTop: 24, maxWidth: 900 }}>Your BaZi advisor that reads your schedule and tells you when to do what.</div>
        <div style={{ display: 'flex', marginTop: 48, gap: 16 }}>
          <div style={{ background: '#DCEADF', color: '#24563F', fontSize: 32, padding: '10px 22px', borderRadius: 12 }}>Good</div>
          <div style={{ background: '#ECE6DA', color: '#5A5248', fontSize: 32, padding: '10px 22px', borderRadius: 12 }}>Neutral</div>
          <div style={{ background: '#F3DCD5', color: '#8E2A17', fontSize: 32, padding: '10px 22px', borderRadius: 12 }}>Bad</div>
        </div>
      </div>
    ),
    size,
  );
}
