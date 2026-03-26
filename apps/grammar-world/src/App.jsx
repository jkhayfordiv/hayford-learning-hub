import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import GrammarHub from './pages/GrammarHub';
import DiagnosticView from './pages/DiagnosticView';
import RegionView from './pages/RegionView';
import NodeDetailView from './pages/NodeDetailView';

export default function App() {
  return (
    <BrowserRouter>
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
              <RegionView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/node/:nodeId"
          element={
            <ProtectedRoute>
              <NodeDetailView />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
