import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, X, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  name: string;
  brand: string | null;
}

interface BudgetItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  margin: number;
  total_price: number;
  type: 'material' | 'extra';
  image_url?: string | null;
}

export default function BudgetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    status: 'draft',
    total_amount: 0
  });
  const [items, setItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    loadClients();
    if (id) {
      loadBudget(id);
    }
  }, [id]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadBudget = async (budgetId: string) => {
    try {
      setLoading(true);
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      const { data: budgetItems, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budgetId);

      if (itemsError) throw itemsError;

      if (budget) {
        setFormData(budget);
      }
      if (budgetItems) {
        setItems(budgetItems);
      }
    } catch (error) {
      toast.error('Erro ao carregar orçamento');
      navigate('/budgets');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        margin: 0,
        total_price: 0,
        type: 'material'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    calculateTotal(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof BudgetItem, value: any) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Calculate total price for the item
    if (field === 'quantity' || field === 'unit_price' || field === 'margin') {
      const item = newItems[index];
      const basePrice = item.quantity * item.unit_price;
      const marginAmount = basePrice * (item.margin / 100);
      item.total_price = basePrice + marginAmount;
    }

    setItems(newItems);
    calculateTotal(newItems);
  };

  const calculateTotal = (currentItems: BudgetItem[]) => {
    const total = currentItems.reduce((sum, item) => sum + item.total_price, 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  };

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `budget-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('budget-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('budget-images')
        .getPublicUrl(filePath);

      handleItemChange(index, 'image_url', publicUrl);
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let budgetId = id;

      if (!budgetId) {
        // Create new budget
        const { data: budget, error: budgetError } = await supabase
          .from('budgets')
          .insert([formData])
          .select()
          .single();

        if (budgetError) throw budgetError;
        budgetId = budget.id;
      } else {
        // Update existing budget
        const { error: budgetError } = await supabase
          .from('budgets')
          .update(formData)
          .eq('id', budgetId);

        if (budgetError) throw budgetError;
      }

      // Handle budget items
      const itemsWithBudgetId = items.map(item => ({
        ...item,
        budget_id: budgetId
      }));

      if (id) {
        // Delete existing items
        await supabase
          .from('budget_items')
          .delete()
          .eq('budget_id', id);
      }

      // Insert new items
      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsWithBudgetId);

      if (itemsError) throw itemsError;

      toast.success('Orçamento salvo com sucesso');
      navigate('/budgets');
    } catch (error) {
      toast.error('Erro ao salvar orçamento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'Editar Orçamento' : 'Novo Orçamento'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cliente
              </label>
              <select
                required
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.brand ? `(${client.brand})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Título
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="draft">Rascunho</option>
                <option value="sent">Enviado</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Total
              </label>
              <input
                type="number"
                readOnly
                value={formData.total_amount}
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Itens do Orçamento</h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-700">
                    Item {index + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Descrição
                    </label>
                    <input
                      type="text"
                      required
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo
                    </label>
                    <select
                      value={item.type}
                      onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="material">Material</option>
                      <option value="extra">Extra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Preço Unitário
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Margem (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      required
                      value={item.margin}
                      onChange={(e) => handleItemChange(index, 'margin', Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Preço Total
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={item.total_price}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Imagem
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(index, file);
                        }
                      }}
                      className="mt-1 block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-medium
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100"
                    />
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt="Item preview"
                        className="mt-2 h-20 w-20 object-cover rounded-md"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}