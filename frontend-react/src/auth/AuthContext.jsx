import { createContext, useContext, useState } from 'react';
import { storedUser, storeUser } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser);
  const signIn = (u) => {
    storeUser(u);
    setUser(u);
  };
  const signOut = () => {
    storeUser(null);
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const ROLE_LABEL = {
  STUDENT: 'Student',
  EXAM_CELL: 'Exam cell',
  EXAMINER: 'Examiner',
  COE: 'Controller of Examinations',
};

export const isStudent = (u) => u?.role === 'STUDENT';

/** Process View is for the exam cell clerk only. The backend enforces the same rule. */
export const canViewProcess = (u) => u?.role === 'EXAM_CELL';
