import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

interface Budget {
  id: string;
  title: string;
  status: string;
  total_amount: number;
  created_at: string;
  client: {
    name: string;
    brand: string | null;
  };
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          client:client_id (
            name,
            brand
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Orçamento excluído com sucesso');
      loadBudgets();
    } catch (error) {
      toast.error('Erro ao excluir orçamento');
    }
  };

  const generatePDF = async (budget: Budget) => {
    try {
      // Fetch budget items
      const { data: items, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budget.id);

      if (error) throw error;

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('Orçamento', 105, 20, { align: 'center' });
      
      // Client Info
      doc.setFontSize(12);
      doc.text(`Cliente: ${budget.client.name}`, 20, 40);
      if (budget.client.brand) {
        doc.text(`Marca: ${budget.client.brand}`, 20, 50);
      }
      
      // Budget Info
      doc.text(`Título: ${budget.title}`, 20, 70);
      doc.text(`Status: ${budget.status}`, 20, 80);
      
      // Items Table
      let y = 100;
      doc.text('Itens do Orçamento:', 20, y);
      y += 10;
      
      if (items) {
        items.forEach((item) => {
          doc.text(`${item.description}`, 20, y);
          doc.text(`R$ ${item.total_price.toFixed(2)}`, 160, y, { align: 'right' });
          y += 10;
          
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        });
      }
      
      // Total
      doc.setFontSize(14);
      doc.text(`Total: R$ ${budget.total_amount.toFixed(2)}`, 160, y + 10, { align: 'right' });
      
      // Save PDF
      doc.save(`orcamento-${budget.id}.pdf`);
      toast.success('PDF gerado com sucesso');
    } catch (error) {
      toast.error('Erro ao gerar PDF');
    }
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

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
        <Link
          to="/budgets/new"
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Orçamento
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Título
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {budget.client.name}
                    </div>
                    {budget.client.brand && (
                      <div className="text-sm text-gray-500">
                        {budget.client.brand}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{budget.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                      {formatStatus(budget.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      R$ {budget.total_amount.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/budgets/${budget.id}`}
                      className="text-indigo-600 hover:text-indigo-900 inline-block mr-4"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <Link
                      to={`/budgets/${budget.id}`}
                      className="text-indigo-600 hover:text-indigo-900 inline-block mr-4"
                    >
                      <Pencil className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => generatePDF(budget)}
                      className="text-indigo-600 hover:text-indigo-900 inline-block mr-4"
                    >
                      <FileDown className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-red-600 hover:text-red-900 inline-block"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}