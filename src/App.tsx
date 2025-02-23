import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthProvider from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import BudgetsPage from './pages/BudgetsPage';
import BudgetFormPage from './pages/BudgetFormPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/budgets/new" element={<BudgetFormPage />} />
            <Route path="/budgets/:id" element={<BudgetFormPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;