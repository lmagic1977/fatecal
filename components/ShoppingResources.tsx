type Lang = 'en' | 'zh' | 'es';

// Fixed, non-personal search terms. Never put chart or calendar data in merchant URLs.
const resources = [
  { query: 'undated weekly planner', en: 'An undated weekly planner', zh: '无日期周计划本',
    why: 'Turn a suggested time into a concrete plan. Look for enough space for appointments and a short priority list; undated pages let you skip weeks without wasting paper.',
    whyZh: '把选好的时间变成具体安排。优先考虑能写下预约和重点事项的版面；无日期设计方便按自己的节奏使用。' },
  { query: 'Four Pillars of Destiny beginner book', en: 'Books on the Four Pillars', zh: '四柱八字入门书',
    why: 'For understanding the tradition behind the readings. Check the sample pages, translation and author background, and prefer books that explain their assumptions over promises of certain outcomes.',
    whyZh: '用于了解解读背后的传统文化。先看样章、译文和作者背景，优先选择解释推导与局限的书，谨慎看待保证结果的说法。' },
  { query: 'travel document organizer', en: 'A travel document organizer', zh: '旅行证件收纳包',
    why: 'Keep the practical side of a trip in order. Check passport dimensions, secure closures and space for your documents; choose only what you need for the trip you have planned.',
    whyZh: '为已经计划好的行程整理证件。留意护照尺寸、闭合方式与分隔空间，只选这次旅程确实需要的配置。' },
];

export default function ShoppingResources({ lang = 'en' }: { lang?: Lang }) {
  const zh = lang === 'zh';
  return (
    <section className="card stack shopping" aria-label={zh ? '规划与阅读工具' : 'Planning and reading tools'}>
      <div>
        <h2>{zh ? '让计划落地' : 'Put your plans into practice'}</h2>
        <p className="small muted">{zh ? '可选的阅读与整理工具。购买物品不会改变命盘或运势。' : 'Optional tools for learning and organizing. Buying an item does not change your chart or luck.'}</p>
      </div>
      <p className="small affiliate-disclosure">
        {zh ? '联盟链接：通过下方链接购买，我们可能获得佣金，你的价格不因此增加。' : 'Affiliate links: we may earn a commission if you buy through the links below, at no extra cost to you.'}
        <br /><span lang="en">As an Amazon Associate I earn from qualifying purchases.</span>
      </p>
      {resources.map((item) => (
        <article className="shopping-item" key={item.query}>
          <h3>{zh ? item.zh : item.en}</h3>
          <p className="small muted">{zh ? item.whyZh : item.why}</p>
          <a className="link shopping-link" href={`https://www.amazon.com/s?k=${encodeURIComponent(item.query)}&tag=fatecal-20`} target="_blank" rel="sponsored nofollow noopener noreferrer">
            {zh ? '在 Amazon 查看选项（联盟链接） ↗' : 'Explore on Amazon (affiliate link) ↗'}
          </a>
        </article>
      ))}
      <p className="small muted">{zh ? '以上为商品搜索入口，并非单品测评。请在 Amazon 核对商品详情、价格和配送信息。' : 'These are product searches, not reviews of individual products. Check details, prices and delivery on Amazon.'} <a href="/resources">{zh ? '了解选购原则与联盟披露' : 'Our selection approach and disclosure'}</a></p>
    </section>
  );
}
