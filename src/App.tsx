/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CBTProvider, useCBT } from './context/CBTContext';
import { LoginView } from './components/LoginView';
import { AdminPortal } from './components/admin/AdminPortal';
import { StudentPortal } from './components/student/StudentPortal';
import { ToastContainer } from './components/ToastContainer';

const CBTMainRouter: React.FC = () => {
  const { currentUser } = useCBT();

  if (!currentUser) {
    return <LoginView />;
  }

  if (
    currentUser.role === 'admin' ||
    currentUser.role === 'guru' ||
    currentUser.role === 'proktor'
  ) {
    return <AdminPortal />;
  }

  return <StudentPortal />;
};

export default function App() {
  return (
    <CBTProvider>
      <CBTMainRouter />
      <ToastContainer />
    </CBTProvider>
  );
}
