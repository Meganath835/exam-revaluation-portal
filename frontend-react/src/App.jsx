import { Navigate, Route, Routes } from 'react-router-dom';
import { canViewProcess, isStudent, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import NewRequest from './pages/NewRequest';
import Payment from './pages/Payment';
import ProcessView from './pages/ProcessView';
import RequestDetail from './pages/RequestDetail';
import RequestList from './pages/RequestList';
import TaskInbox from './pages/TaskInbox';

function RequireUser({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/** Sends anyone without the exam cell role back home, even when they type the URL directly. */
function RequireProcessViewer({ children }) {
  const { user } = useAuth();
  return canViewProcess(user) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireUser><Layout /></RequireUser>}>
        <Route path="/" element={<Navigate to={isStudent(user) ? '/requests' : '/tasks'} replace />} />
        <Route path="/requests" element={<RequestList />} />
        <Route path="/requests/new" element={isStudent(user) ? <NewRequest /> : <Navigate to="/requests" replace />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/requests/:id/pay" element={<Payment />} />
        <Route path="/tasks" element={<TaskInbox />} />
        <Route path="/process" element={<RequireProcessViewer><ProcessView /></RequireProcessViewer>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
