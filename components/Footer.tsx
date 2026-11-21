import { CONTACT_EMAIL, FACEBOOK_URL, SHOPPING_ON } from '@/lib/site';

export default function Footer({ lang = 'en' }: { lang?: 'en' | 'zh' | 'es' }) {
  const zh = lang === 'zh';
  const L = (en: string, z: string, es: string) => (zh ? z : lang === 'es' ? es : en);
  return (
    <footer className="footer">
      {SHOPPING_ON && <a href="/resources">{L('Tools & affiliate disclosure', '工具与联盟披露', 'Herramientas y afiliados')}</a>}
      <a href={`${lang === 'en' ? '' : `/${lang}`}/guides/what-is-bazi`}>{L('What is BaZi?', '什么是八字', '¿Qué es el BaZi?')}</a>
      <a href={`${lang === 'en' ? '' : `/${lang}`}/guides/chinese-zodiac`}>{L('Chinese zodiac by year', '生肖查询', 'Horóscopo chino por año')}</a>
      <a href={`${lang === 'en' ? '' : `/${lang}`}/guides/year-of-the-fire-goat-2027`}>{L('2027 Fire Goat year', '2027 火羊年', '2027 Cabra de Fuego')}</a>
      <a href={`${lang === 'en' ? '' : `/${lang}`}/good-days`}>{L('Good days by month', '每月黄道吉日', 'Días propicios')}</a>
      <a href="/privacy">{L('Privacy', '隐私政策', 'Privacidad')}</a>
      <a href="/terms">{L('Terms', '服务条款', 'Términos')}</a>
      <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer me">Facebook</a>
      <a href={`mailto:${CONTACT_EMAIL}`}>{L('Contact', '联系我们', 'Contacto')}</a>
      <span>© {new Date().getFullYear()} FateCal</span>
    </footer>
  );
}
