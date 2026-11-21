import { ImageResponse } from 'next/og';

export const alt = 'FateCal: pick a good time for what matters';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjUwIDEyNTAiIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj48dGl0bGU+RmF0ZUNhbDwvdGl0bGU+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJpbSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMzAiIHkxPSIwIiB4Mj0iMTExOCIgeTI9IjAiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzVGNEZGNiIvPjxzdG9wIG9mZnNldD0iLjU1IiBzdG9wLWNvbG9yPSIjQjA2MkNDIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjI3QTlDIi8+PC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJpcyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI0MTUiIHkxPSIwIiB4Mj0iODM2IiB5Mj0iMCI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjN0U1NUYwIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjM3QzlFIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEyNTAiIGhlaWdodD0iMTI1MCIgcng9IjI4MCIgZmlsbD0iI0ZGRkZGRiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDYyNSA2MzMpIHNjYWxlKC43OCkgdHJhbnNsYXRlKC02MjQgLTYzMykiPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNpbSkiIHN0cm9rZS13aWR0aD0iNTgiPjxyZWN0IHg9IjE1OSIgeT0iMjY0IiB3aWR0aD0iOTMwIiBoZWlnaHQ9Ijg0NCIgcng9IjEzNiIvPjxwYXRoIGQ9Ik0xNTkgNDc3SDEwODkiLz48L2c+CjxnIGZpbGw9InVybCgjaW0pIj48cmVjdCB4PSIzMzciIHk9IjEzMCIgd2lkdGg9Ijg2IiBoZWlnaHQ9IjIzMiIgcng9IjQzIi8+PHJlY3QgeD0iODI5IiB5PSIxMzAiIHdpZHRoPSI4NiIgaGVpZ2h0PSIyMzIiIHJ4PSI0MyIvPjwvZz4KPHBhdGggZmlsbD0idXJsKCNpcykiIGQ9Ik02MjYgNTc4QzY0MCA3MDAgNzAwIDc3NSA4MzYgNzk3QzcwMCA4MTggNjQwIDg4MCA2MjYgMTAwMEM2MTIgODgwIDU1MiA4MTggNDE1IDc5N0M1NTIgNzc1IDYxMiA3MDAgNjI2IDU3OFoiLz48L2c+PC9zdmc+';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #F6F4FD 0%, #ECE9FF 60%, #FFE3D3 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img src={ICON} width={120} height={120} alt="" />
          <div style={{ fontSize: 96, fontWeight: 700, color: '#1D1A33' }}>FateCal</div>
        </div>
        <div style={{ fontSize: 52, color: '#6D5DF5', marginTop: 40, maxWidth: 1000 }}>Better timing. Better plans.</div>
        <div style={{ fontSize: 32, color: '#5B5876', marginTop: 16, maxWidth: 1000 }}>Powered by BaZi.</div>
      </div>
    ),
    size,
  );
}
