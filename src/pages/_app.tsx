import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  );
} 