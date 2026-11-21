import Footer from '@/components/Footer';

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="shell legal">
      <header className="top"><a href="/" aria-label="FateCal home"><img className="logo" src="/logo.svg" alt="FateCal" width={130} height={32} /></a></header>
      <main className="main">
        <h1>{title}</h1>
        <p className="muted small">Last updated {updated}</p>
        {children}
      </main>
      <Footer />
    </div>
  );
}
