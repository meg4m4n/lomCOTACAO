import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Calendar } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  brand: string | null;
}

interface BudgetItem {
  id?: string;
  description: string;
  supplier: string;
  quantity: number;
  unit: 'uni' | 'mt' | 'kg' | 'mil';
  unit_price: number;
  line_cost: number;
  type: 'material' | 'extra';
  has_moq: boolean;
  moq_quantity?: number;
  lead_time_days?: number;
}

interface Budget {
  id?: string;
  client_id: string;
  status: string;
  lomartex_ref?: string;
  client_ref?: string;
  collection?: string;
  size?: string;
  project_start_date?: string;
  estimated_end_date?: string;
  images?: string[];
}

const UNIT_OPTIONS = [
  { value: 'uni', label: 'Uni' },
  { value: 'mt', label: 'Mt' },
  { value: 'kg', label: 'Kg' },
  { value: 'mil', label: 'Milheiro' },
] as const;

export default function BudgetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [budget, setBudget] = useState<Budget>({
    client_id: '',
    status: 'draft',
    images: [],
  });
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    loadClients();
    if (id) {
      loadBudget(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, brand')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const loadBudget = async (budgetId: string) => {
    try {
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_id', budgetId);

      if (itemsError) throw itemsError;

      setBudget(budgetData);
      setItems(itemsData || []);
      if (budgetData.images) {
        setImageUrls(budgetData.images);
      }
    } catch (error) {
      toast.error('Erro ao carregar orçamento');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (files: FileList) => {
    const newFiles = Array.from(files);
    setUploadedImages(prev => [...prev, ...newFiles]);
    
    // Create temporary URLs for preview
    const newUrls = newFiles.map(file => URL.createObjectURL(file));
    setImageUrls(prev => [...prev, ...newUrls]);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    const uploadedUrls: string[] = [];

    for (const file of uploadedImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `budget-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('budget-images')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload da imagem ${file.name}`);
        continue;
      }

      const { data } = supabase.storage
        .from('budget-images')
        .getPublicUrl(filePath);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const setStartDateToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setBudget(prev => {
      const estimatedEnd = calculateEstimatedEndDate(today);
      return {
        ...prev,
        project_start_date: today,
        estimated_end_date: estimatedEnd
      };
    });
  };

  const calculateEstimatedEndDate = (startDate: string): string => {
    const start = new Date(startDate);
    let daysToAdd = 42; // 6 weeks * 7 days
    let currentDate = new Date(start);
    
    while (daysToAdd > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        daysToAdd--;
      }
    }

    return currentDate.toISOString().split('T')[0];
  };

  const handleStartDateChange = (date: string) => {
    setBudget(prev => ({
      ...prev,
      project_start_date: date,
      estimated_end_date: calculateEstimatedEndDate(date)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const total_amount = items.reduce((sum, item) => sum + (item.line_cost || 0), 0);
      
      // Upload new images
      const uploadedUrls = await uploadImages();
      const allImages = [...(budget.images || []), ...uploadedUrls];

      if (id) {
        // Update existing budget
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({ 
            ...budget,
            images: allImages,
            total_amount,
            updated_at: new Date()
          })
          .eq('id', id);

        if (budgetError) throw budgetError;

        // Update or create items
        for (const item of items) {
          if (item.id) {
            const { error } = await supabase
              .from('budget_items')
              .update(item)
              .eq('id', item.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('budget_items')
              .insert({ ...item, budget_id: id });
            if (error) throw error;
          }
        }
      } else {
        // Create new budget
        const { data: newBudget, error: budgetError } = await supabase
          .from('budgets')
          .insert([{
            ...budget,
            images: allImages,
            total_amount,
            user_id: userData.user.id
          }])
          .select()
          .single();

        if (budgetError) throw budgetError;

        // Create items
        if (newBudget) {
          const itemsWithBudgetId = items.map(item => ({
            ...item,
            budget_id: newBudget.id
          }));

          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert(itemsWithBudgetId);

          if (itemsError) throw itemsError;
        }
      }

      toast.success(id ? 'Orçamento atualizado com sucesso' : 'Orçamento criado com sucesso');
      navigate('/budgets');
    } catch (error) {
      toast.error('Erro ao salvar orçamento');
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        description: '',
        supplier: '',
        quantity: 1,
        unit: 'uni',
        unit_price: 0,
        line_cost: 0,
        type: 'material',
        has_moq: false
      }
    ]);
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: any) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };

    // Reset MOQ quantity when has_moq is set to false
    if (field === 'has_moq' && !value) {
      newItems[index].moq_quantity = undefined;
    }

    // Calculate line cost
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_cost = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {id ? 'Editar Orçamento' : 'Novo Orçamento'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cliente</label>
              <select
                required
                value={budget.client_id}
                onChange={(e) => setBudget({ ...budget, client_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.brand && `(${client.brand})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ref. Lomartex</label>
              <input
                type="text"
                value={budget.lomartex_ref || ''}
                onChange={(e) => setBudget({ ...budget, lomartex_ref: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ref. Cliente</label>
              <input
                type="text"
                value={budget.client_ref || ''}
                onChange={(e) => setBudget({ ...budget, client_ref: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Coleção</label>
              <input
                type="text"
                value={budget.collection || ''}
                onChange={(e) => setBudget({ ...budget, collection: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tamanho</label>
              <input
                type="text"
                value={budget.size || ''}
                onChange={(e) => setBudget({ ...budget, size: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={budget.status}
                onChange={(e) => setBudget({ ...budget, status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="draft">Rascunho</option>
                <option value="sent">Enviado</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Início</label>
              <div className="mt-1 flex space-x-2">
                <input
                  type="date"
                  value={budget.project_start_date?.split('T')[0] || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={setStartDateToToday}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                >
                  <Calendar className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data Prevista de Conclusão</label>
              <input
                type="date"
                value={budget.estimated_end_date?.split('T')[0] || ''}
                readOnly
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
              />
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imagens do Artigo
            </label>
            <div className="flex flex-wrap gap-4">
              {imageUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="h-24 w-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <label className="h-24 w-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                />
                <Plus className="h-8 w-8 text-gray-400" />
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Itens do Orçamento</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Adicionar Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-4 p-4 border rounded-lg md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Fornecedor</label>
                  <input
                    type="text"
                    required
                    value={item.supplier}
                    onChange={(e) => updateItem(index, 'supplier', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Unid</label>
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {UNIT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Preço Unit.</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Custo Total</label>
                  <input
                    type="number"
                    readOnly
                    value={item.line_cost}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">MOQ</label>
                  <div className="mt-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={item.has_moq}
                      onChange={(e) => updateItem(index, 'has_moq', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {item.has_moq && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Qtd. MOQ</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={item.moq_quantity || ''}
                      onChange={(e) => updateItem(index, 'moq_quantity', Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
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
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}