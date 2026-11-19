import { CONTACT_EMAIL } from '@/lib/site';

export default function Footer({ lang = 'en' }: { lang?: 'en' | 'zh' }) {
  const zh = lang === 'zh';
  return (
    <footer className="footer">
      <a href="/resources">{zh ? '工具与联盟披露' : 'Tools & affiliate disclosure'}</a>
      <a href="/privacy">{zh ? '隐私政策' : 'Privacy'}</a>
      <a href="/terms">{zh ? '服务条款' : 'Terms'}</a>
      <a href={`mailto:${CONTACT_EMAIL}`}>{zh ? '联系我们' : 'Contact'}</a>
      <span>© {new Date().getFullYear()} FateCal</span>
    </footer>
  );
}
