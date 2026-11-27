import { CONTACT_EMAIL, FACEBOOK_URL, SHOPPING_ON } from '@/lib/site';

export default function Footer({ lang = 'en' }: { lang?: 'en' | 'zh' | 'es' | 'pt' }) {
  const L = (en: string, z: string, es: string, pt: string) => (lang === 'zh' ? z : lang === 'es' ? es : lang === 'pt' ? pt : en);
  // guide and good-days pages exist in en / zh / es; Portuguese readers get the English ones for now
  const pre = lang === 'zh' || lang === 'es' ? `/${lang}` : '';
  return (
    <footer className="footer">
      {SHOPPING_ON && <a href="/resources">{L('Tools & affiliate disclosure', '工具与联盟披露', 'Herramientas y afiliados', 'Ferramentas e afiliados')}</a>}
      <a href={`${pre}/guides/what-is-bazi`}>{L('What is BaZi?', '什么是八字', '¿Qué es el BaZi?', 'O que é BaZi?')}</a>
      <a href={`${pre}/guides/chinese-zodiac`}>{L('Chinese zodiac by year', '生肖查询', 'Horóscopo chino por año', 'Horóscopo chinês por ano')}</a>
      <a href={`${pre}/guides/year-of-the-fire-goat-2027`}>{L('2027 Fire Goat year', '2027 火羊年', '2027 Cabra de Fuego', '2027 Cabra de Fogo')}</a>
      <a href={`${pre}/good-days`}>{L('Good days by month', '每月黄道吉日', 'Días propicios', 'Dias favoráveis')}</a>
      <a href="/privacy">{L('Privacy', '隐私政策', 'Privacidad', 'Privacidade')}</a>
      <a href="/terms">{L('Terms', '服务条款', 'Términos', 'Termos')}</a>
      <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer me">Facebook</a>
      <a href={`mailto:${CONTACT_EMAIL}`}>{L('Contact', '联系我们', 'Contacto', 'Contato')}</a>
      <span>© {new Date().getFullYear()} FateCal</span>
    </footer>
  );
}
