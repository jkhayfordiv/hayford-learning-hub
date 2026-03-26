import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DiagnosticGuard from './components/DiagnosticGuard';
import GrammarHub from './pages/GrammarHub';
import DiagnosticView from './pages/DiagnosticView';
import RegionView from './pages/RegionView';
import NodeDetailView from './pages/NodeDetailView';

export default function App() {
  return (
    <BrowserRouter basename="/grammar-world">
      <Routes>
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route
          path="/hub"
          element={
            <ProtectedRoute>
              <GrammarHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/diagnostic"
          element={
            <ProtectedRoute>
              <DiagnosticView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/region/:regionName"
          element={
            <ProtectedRoute>
              <DiagnosticGuard>
                <RegionView />
              </DiagnosticGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/node/:nodeId"
          element={
            <ProtectedRoute>
              <DiagnosticGuard>
                <NodeDetailView />
              </DiagnosticGuard>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
