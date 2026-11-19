import LegalPage from '@/components/LegalPage';

export default function NotFound() {
  return (
    <LegalPage title="Page not found" updated="—">
      <p>This page does not exist. <a href="/">Go to FateCal</a> to see your reading.</p>
      <p>页面不存在。<a href="/">返回 FateCal 首页</a>。</p>
    </LegalPage>
  );
}
