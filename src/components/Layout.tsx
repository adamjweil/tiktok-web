import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navigation from './Navigation';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const publicRoutes = ['/auth/login', '/auth/register'];

export default function Layout({ children }: LayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !publicRoutes.includes(router.pathname)) {
      // Only redirect if we're not already on a public route
      router.replace('/auth/login');
    }
  }, [user, loading, router.pathname]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // For public routes, don't show the navigation
  if (!user && publicRoutes.includes(router.pathname)) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 pl-64">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
} 