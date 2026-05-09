import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './views/pages/HomePage';
import { LoginPage } from './views/pages/LoginPage';
import { LobbyPage } from './views/pages/LobbyPage';
import { GamePage } from './views/pages/GamePage';
import { ResultsPage } from './views/pages/ResultsPage';
import { AdminPage } from './views/pages/AdminPage';
import { ProtectedRoute } from './views/components/ui/ProtectedRoute';

const App = (): React.ReactElement => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/lobby"
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/:roomId"
          element={
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:roomId"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
