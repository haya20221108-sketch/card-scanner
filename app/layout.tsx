import './globals.css';
import { TabBar } from './components/TabBar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-50">
        <div className="min-h-screen">
          {children}
        </div>
        <TabBar />
      </body>
    </html>
  );
}