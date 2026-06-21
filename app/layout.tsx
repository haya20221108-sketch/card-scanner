import './globals.css';
import { TabBar } from './components/TabBar';
import { ScannerFab } from './components/ScannerFab';
import { AuthProvider } from '../AuthContext';
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Nexus Intelligence',
  description: 'AI Card Scanner and Collection Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nexus',
  },
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased bg-slate-50">
        <AuthProvider>
          <div className="min-h-screen">
            {children}
          </div>
          <ScannerFab />
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
