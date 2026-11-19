import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import ShoppingResources from '@/components/ShoppingResources';

export const metadata: Metadata = { title: 'Planning tools & affiliate disclosure · FateCal', alternates: { canonical: '/resources' } };

export default function Resources() {
  return (
    <LegalPage title="Planning tools & reading" updated="November 19, 2026">
      <p>FateCal helps you reflect on dates and plans. These optional resources support the practical work of learning, writing things down and preparing for a trip. Start with what you already own.</p>
      <h2>How to use this guide</h2>
      <p>Choose a tool for an actual need, then compare its format, materials and usability. These categories are general suggestions, not personalized chart prescriptions. They do not promise better luck or a particular outcome, and we have not tested every product in the search results.</p>
      <ShoppingResources />
      <h2>Affiliate disclosure / 联盟链接披露</h2>
      <p>As an Amazon Associate I earn from qualifying purchases.</p>
      <p>FateCal is operated by Alpaca Global Inc. The Amazon links above include our affiliate ID. If you follow one and make a qualifying purchase, we may receive a commission at no extra cost to you. Amazon handles the sale, shipping, returns and product information.</p>
      <p lang="zh">FateCal 由 Alpaca Global Inc. 运营。上方 Amazon 链接包含我们的联盟标识。你通过链接完成符合条件的购买时，我们可能获得佣金，你的价格不因此增加。商品销售、配送、退货及详情由 Amazon 和对应商家提供。购买不会改变命盘或运势。</p>
      <h2>Privacy</h2>
      <p>Our Amazon links use fixed category keywords and a fixed affiliate ID. They do not include your name, birth details, chart, questions or calendar events. When you visit Amazon, its own privacy and tracking policies apply. See our <a href="/privacy">privacy policy</a> for more.</p>
    </LegalPage>
  );
}
