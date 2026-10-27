import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAnalytics } from '@/hooks/useAnalytics';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { BookingPage } from '@/pages/booking/BookingPage';
import SeoPage from './pages/seo/SeoPage';
import BlogIndex from './pages/blog/BlogIndex';
import BlogPost from './pages/blog/BlogPost';
import { NotFoundPage } from '@/pages/NotFoundPage';
import './App.css';

function AnalyticsTracker() {
  useAnalytics();
  return null;
}

function App() {
  return (
    <>
      <AnalyticsTracker />
      <Toaster position="top-center" richColors />
      <Routes>
        {/* Временно вместо лендинга — заглушка «технические работы».
            После завершения работ вернуть <HomePage /> из '@/pages/HomePage'. */}
        <Route path="/" element={<MaintenancePage />} />
        <Route path="/booking/:cabinId" element={<BookingPage />} />
        <Route path="/seo/:slug" element={<SeoPage />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
