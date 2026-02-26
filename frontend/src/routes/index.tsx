import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { AppShell } from "@/components/app-shell";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import BatchesPage from "@/pages/batches";
import BatchDetailPage from "@/pages/batch-detail";
import ExceptionsPage from "@/pages/exceptions";
import SerialCapturePage from "@/pages/serial-capture";
import DocumentsPage from "@/pages/documents";
import SettingsPage from "@/pages/settings";
import IntegrationsPage from "@/pages/integrations";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/batches"
          element={
            <ProtectedRoute>
              <BatchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/batches/:batchId"
          element={
            <ProtectedRoute>
              <BatchDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exceptions"
          element={
            <ProtectedRoute>
              <ExceptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/serial-capture"
          element={
            <ProtectedRoute>
              <SerialCapturePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/integrations"
          element={
            <ProtectedRoute>
              <IntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
