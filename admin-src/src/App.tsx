import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AdminLogin } from '@/pages/AdminLogin';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { RequireAdmin } from '@/pages/RequireAdmin';
import SeoPagesList from '@/pages/SeoPagesList';
import SeoPageEditor from '@/pages/SeoPageEditor';
import BlogList from '@/pages/BlogList';
import BlogEditor from '@/pages/BlogEditor';
import ImageRegistry from '@/pages/ImageRegistry';
import ReviewsList from '@/pages/ReviewsList';
import ReviewEditor from '@/pages/ReviewEditor';
import CottagesList from '@/pages/CottagesList';
import CottageEditor from '@/pages/CottageEditor';
import SiteElements from '@/pages/SiteElements';

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/seo-pages"
          element={
            <RequireAdmin>
              <SeoPagesList />
            </RequireAdmin>
          }
        />
        <Route
          path="/seo-pages/:id"
          element={
            <RequireAdmin>
              <SeoPageEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/blog-posts"
          element={
            <RequireAdmin>
              <BlogList />
            </RequireAdmin>
          }
        />
        <Route
          path="/blog-posts/:id"
          element={
            <RequireAdmin>
              <BlogEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/images"
          element={
            <RequireAdmin>
              <ImageRegistry />
            </RequireAdmin>
          }
        />
        <Route
          path="/reviews"
          element={
            <RequireAdmin>
              <ReviewsList />
            </RequireAdmin>
          }
        />
        <Route
          path="/reviews/new"
          element={
            <RequireAdmin>
              <ReviewEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/reviews/:id"
          element={
            <RequireAdmin>
              <ReviewEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/cottages"
          element={
            <RequireAdmin>
              <CottagesList />
            </RequireAdmin>
          }
        />
        <Route
          path="/cottages/new"
          element={
            <RequireAdmin>
              <CottageEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/cottages/:id"
          element={
            <RequireAdmin>
              <CottageEditor />
            </RequireAdmin>
          }
        />
        <Route
          path="/site-elements"
          element={
            <RequireAdmin>
              <SiteElements />
            </RequireAdmin>
          }
        />
      </Routes>
    </>
  );
}
