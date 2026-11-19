import { ImageResponse } from 'next/og';

export const alt = 'FateCal: pick a good time for what matters';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJGYXRlQ2FsIGFwcCBpY29uIj48dGl0bGU+RmF0ZUNhbCBhcHAgaWNvbjwvdGl0bGU+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNSIgZmlsbD0iIzI0NDYzNyIvPgo8ZyBzdHJva2U9IiNGOEY2RUYiIHN0cm9rZS13aWR0aD0iNC41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIGZpbGw9Im5vbmUiPgo8cmVjdCB4PSIyMy41IiB5PSIyOCIgd2lkdGg9IjUzIiBoZWlnaHQ9IjQ5IiByeD0iOCIvPgo8cGF0aCBkPSJNMjQgNDJoNTJNMzYgMjN2MTFtMjgtMTF2MTEiLz48L2c+CjxnIGZpbGw9IiM5MUFCOTgiPjxyZWN0IHg9IjMzIiB5PSI1MCIgd2lkdGg9IjkiIGhlaWdodD0iOCIgcng9IjIiLz48cmVjdCB4PSIzMyIgeT0iNjMiIHdpZHRoPSI5IiBoZWlnaHQ9IjciIHJ4PSIyIi8+PHJlY3QgeD0iNjEiIHk9IjYzIiB3aWR0aD0iNyIgaGVpZ2h0PSI3IiByeD0iMiIvPjwvZz4KPHBhdGggZmlsbD0iI0YyODM2RCIgZD0iTTU3IDQ1LjhjMi4yIDUuNSAzLjcgNyA5LjIgOS4yLTUuNSAyLjItNyAzLjctOS4yIDkuMi0yLjItNS41LTMuNy03LTkuMi05LjIgNS41LTIuMiA3LTMuNyA5LjItOS4yWiIvPjwvc3ZnPg==';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#F8F6EF', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img src={ICON} width={120} height={120} alt="" />
          <div style={{ fontSize: 96, fontWeight: 700, color: '#162D25' }}>FateCal</div>
        </div>
        <div style={{ fontSize: 52, color: '#244637', marginTop: 40, maxWidth: 1000 }}>Pick a good time for what matters.</div>
        <div style={{ fontSize: 32, color: '#43504A', marginTop: 16, maxWidth: 1000 }}>Your BaZi chart, read against your real schedule.</div>
      </div>
    ),
    size,
  );
}
