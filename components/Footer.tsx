import { CONTACT_EMAIL, SHOPPING_ON } from '@/lib/site';

export default function Footer({ lang = 'en' }: { lang?: 'en' | 'zh' | 'es' }) {
  const zh = lang === 'zh';
  const L = (en: string, z: string, es: string) => (zh ? z : lang === 'es' ? es : en);
  return (
    <footer className="footer">
      {SHOPPING_ON && <a href="/resources">{L('Tools & affiliate disclosure', '工具与联盟披露', 'Herramientas y afiliados')}</a>}
      <a href={`${lang === 'en' ? '' : `/${lang}`}/good-days`}>{L('Good days by month', '每月黄道吉日', 'Días propicios')}</a>
      <a href="/privacy">{L('Privacy', '隐私政策', 'Privacidad')}</a>
      <a href="/terms">{L('Terms', '服务条款', 'Términos')}</a>
      <a href={`mailto:${CONTACT_EMAIL}`}>{L('Contact', '联系我们', 'Contacto')}</a>
      <span>© {new Date().getFullYear()} FateCal</span>
    </footer>
  );
}
