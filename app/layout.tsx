import './globals.css';
import { TabBar } from './components/TabBar';
import { AuthProvider } from '../AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-50">
        <AuthProvider>
          <div className="min-h-screen">
            {children}
          </div>
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}