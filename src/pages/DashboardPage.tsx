import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalBudgets: number;
  totalClients: number;
  totalAmount: number;
  recentBudgets: {
    id: string;
    title: string;
    status: string;
    total_amount: number;
    created_at: string;
    client: {
      name: string;
      brand: string | null;
    };
  }[];
  statusCounts: {
    draft: number;
    sent: number;
    approved: number;
    rejected: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBudgets: 0,
    totalClients: 0,
    totalAmount: 0,
    recentBudgets: [],
    statusCounts: {
      draft: 0,
      sent: 0,
      approved: 0,
      rejected: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Get total budgets and amount
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          id,
          title,
          status,
          total_amount,
          created_at,
          client:client_id (
            name,
            brand
          )
        `)
        .order('created_at', { ascending: false });

      if (budgetsError) throw budgetsError;

      // Get total clients
      const { count: clientsCount, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      if (clientsError) throw clientsError;

      // Calculate statistics
      const totalAmount = budgets?.reduce((sum, budget) => sum + budget.total_amount, 0) || 0;
      const statusCounts = {
        draft: 0,
        sent: 0,
        approved: 0,
        rejected: 0
      };

      budgets?.forEach(budget => {
        if (budget.status in statusCounts) {
          statusCounts[budget.status as keyof typeof statusCounts]++;
        }
      });

      setStats({
        totalBudgets: budgets?.length || 0,
        totalClients: clientsCount || 0,
        totalAmount,
        recentBudgets: budgets?.slice(0, 5) || [],
        statusCounts
      });
    } catch (error) {
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      draft: 'Rascunho',
      sent: 'Enviado',
      approved: 'Aprovado',
      rejected: 'Rejeitado'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total de Orçamentos</p>
              <p className="text-lg font-semibold text-gray-900">{stats.totalBudgets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total de Clientes</p>
              <p className="text-lg font-semibold text-gray-900">{stats.totalClients}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Valor Total</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(stats.totalAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Aprovados</p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.statusCounts.approved}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Status dos Orçamentos</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-sm text-gray-500 w-24">Rascunho:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-gray-500 rounded-full"
                  style={{
                    width: `${(stats.statusCounts.draft / stats.totalBudgets) * 100}%`
                  }}
                />
              </div>
              <span className="ml-4 text-sm font-medium text-gray-900">
                {stats.statusCounts.draft}
              </span>
            </div>

            <div className="flex items-center">
              <Clock className="h-5 w-5 text-blue-500 mr-2" />
              <span className="text-sm text-gray-500 w-24">Enviado:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-blue-500 rounded-full"
                  style={{
                    width: `${(stats.statusCounts.sent / stats.totalBudgets) * 100}%`
                  }}
                />
              </div>
              <span className="ml-4 text-sm font-medium text-gray-900">
                {stats.statusCounts.sent}
              </span>
            </div>

            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-sm text-gray-500 w-24">Aprovado:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-green-500 rounded-full"
                  style={{
                    width: `${(stats.statusCounts.approved / stats.totalBudgets) * 100}%`
                  }}
                />
              </div>
              <span className="ml-4 text-sm font-medium text-gray-900">
                {stats.statusCounts.approved}
              </span>
            </div>

            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm text-gray-500 w-24">Rejeitado:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full">
                <div
                  className="h-2 bg-red-500 rounded-full"
                  style={{
                    width: `${(stats.statusCounts.rejected / stats.totalBudgets) * 100}%`
                  }}
                />
              </div>
              <span className="ml-4 text-sm font-medium text-gray-900">
                {stats.statusCounts.rejected}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Orçamentos Recentes</h2>
            <Link
              to="/budgets"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-4">
            {stats.recentBudgets.map((budget) => (
              <Link
                key={budget.id}
                to={`/budgets/${budget.id}`}
                className="block p-4 rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{budget.title}</p>
                    <p className="text-sm text-gray-500">
                      {budget.client.name}
                      {budget.client.brand && ` (${budget.client.brand})`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        budget.status
                      )}`}
                    >
                      {formatStatus(budget.status)}
                    </span>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {formatCurrency(budget.total_amount)}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Criado em {formatDate(budget.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}