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
  pricing_options?: PricingOption[];
}

interface PricingOption {
  id: number;
  quantity: number; // editável manualmente (informativo)
  marginPercentage: number;
  marginAmount: number;
  totalCost: number;
  clientPrice: number;
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
  const [extras, setExtras] = useState<BudgetItem[]>([]);
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([
    { id: 1, quantity: 1, marginPercentage: 10, marginAmount: 0, totalCost: 0, clientPrice: 0 },
    { id: 2, quantity: 1, marginPercentage: 15, marginAmount: 0, totalCost: 0, clientPrice: 0 },
    { id: 3, quantity: 1, marginPercentage: 20, marginAmount: 0, totalCost: 0, clientPrice: 0 },
  ]);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Carrega clientes e orçamento (se houver id) na montagem
  useEffect(() => {
    loadClients();
    if (id) {
      loadBudget(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  // Atualiza as opções de preço com base somente no custo dos itens (extras não influenciam)
  useEffect(() => {
    const baseCost = items.reduce((sum, item) => sum + item.line_cost, 0);
    setPricingOptions(prevOptions => prevOptions.map(opt => recalcOption(opt, baseCost)));
  }, [items]);

  // Recalcula a opção de preço (o campo quantity é editável, mas o cálculo ignora-o)
  const recalcOption = (option: PricingOption, baseCost: number): PricingOption => {
    const marginAmount = (baseCost * option.marginPercentage) / 100;
    const totalCost = baseCost + marginAmount;
    const clientPrice = totalCost; // quantidade é informativo, mas preço do cliente = total
    return { ...option, marginAmount, totalCost, clientPrice };
  };

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
      const materialItems = (itemsData || []).filter((item: BudgetItem) => item.type === 'material');
      const extraItems = (itemsData || []).filter((item: BudgetItem) => item.type === 'extra');
      setItems(materialItems);
      setExtras(extraItems);
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
    const newUrls = newFiles.map(file => URL.createObjectURL(file));
    setImageUrls(prev => [...prev, ...newUrls]);
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

  // Soma dos leadtimes (itens + extras); se 0, usa 42 (6 semanas úteis)
  const getTotalLeadTime = (): number => {
    const itemsLeadTime = items.reduce((sum, item) => sum + (item.lead_time_days || 0), 0);
    const extrasLeadTime = extras.reduce((sum, extra) => sum + (extra.lead_time_days || 0), 0);
    const total = itemsLeadTime + extrasLeadTime;
    return total > 0 ? total : 42;
  };

  // Calcula a data de conclusão a partir da data de início e dos dias úteis a adicionar
  const calculateEstimatedEndDate = (startDate: string, daysToAdd: number): string => {
    const start = new Date(startDate);
    let remaining = daysToAdd;
    let currentDate = new Date(start);
    while (remaining > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        remaining--;
      }
    }
    return currentDate.toISOString().split('T')[0];
  };

  // Atualiza a data de início para hoje e recalcula a data prevista
  const setStartDateToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setBudget(prev => ({
      ...prev,
      project_start_date: today,
      estimated_end_date: calculateEstimatedEndDate(today, getTotalLeadTime())
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');
      const baseCost = items.reduce((sum, item) => sum + item.line_cost, 0);
      const uploadedUrls = await uploadImages();
      const allImages = [...(budget.images || []), ...uploadedUrls];

      if (id) {
        const { error: budgetError } = await supabase
          .from('budgets')
          .update({
            ...budget,
            images: allImages,
            total_amount: baseCost,
            pricing_options: pricingOptions,
            updated_at: new Date(),
          })
          .eq('id', id);
        if (budgetError) throw budgetError;

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
        for (const extra of extras) {
          if (extra.id) {
            const { error } = await supabase
              .from('budget_items')
              .update(extra)
              .eq('id', extra.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('budget_items')
              .insert({ ...extra, budget_id: id });
            if (error) throw error;
          }
        }
      } else {
        const { data: newBudget, error: budgetError } = await supabase
          .from('budgets')
          .insert([
            {
              ...budget,
              images: allImages,
              total_amount: baseCost,
              pricing_options: pricingOptions,
              user_id: userData.user.id,
            },
          ])
          .select()
          .single();
        if (budgetError) throw budgetError;
        if (newBudget) {
          const materialItems = items.map(item => ({ ...item, budget_id: newBudget.id }));
          const extraItems = extras.map(extra => ({ ...extra, budget_id: newBudget.id }));
          const { error: itemsError } = await supabase
            .from('budget_items')
            .insert([...materialItems, ...extraItems]);
          if (itemsError) throw itemsError;
        }
      }
      toast.success(id ? 'Orçamento atualizado com sucesso' : 'Orçamento criado com sucesso');
      navigate('/budgets');
    } catch (error) {
      toast.error('Erro ao salvar orçamento');
    }
  };

  // Funções para manipular itens (materiais)
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
        has_moq: false,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].line_cost = newItems[index].quantity * newItems[index].unit_price;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Funções para manipular extras
  const addExtra = () => {
    setExtras([
      ...extras,
      {
        description: '',
        supplier: '',
        quantity: 1,
        unit: 'uni',
        unit_price: 0,
        line_cost: 0,
        type: 'extra',
        has_moq: false,
      },
    ]);
  };

  const updateExtra = (index: number, field: keyof BudgetItem, value: any) => {
    const newExtras = [...extras];
    newExtras[index] = { ...newExtras[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newExtras[index].line_cost = newExtras[index].quantity * newExtras[index].unit_price;
    }
    setExtras(newExtras);
  };

  const removeExtra = (index: number) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  // Atualiza as opções de preço (o campo quantity é editável manualmente)
  const updatePricingOption = (index: number, field: keyof PricingOption, value: any) => {
    const newOptions = [...pricingOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    const baseCost = items.reduce((sum, item) => sum + item.line_cost, 0);
    newOptions[index] = recalcOption(newOptions[index], baseCost);
    setPricingOptions(newOptions);
  };

  // Renderização dos campos gerais (cliente, referências, datas, upload de imagens)
  function renderGeneralFields() {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6 text-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block">Cliente</label>
            <select
              required
              value={budget.client_id}
              onChange={(e) => setBudget({ ...budget, client_id: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
            <label className="block">Ref. Lomartex</label>
            <input
              type="text"
              value={budget.lomartex_ref || ''}
              onChange={(e) => setBudget({ ...budget, lomartex_ref: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block">Ref. Cliente</label>
            <input
              type="text"
              value={budget.client_ref || ''}
              onChange={(e) => setBudget({ ...budget, client_ref: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block">Coleção</label>
            <input
              type="text"
              value={budget.collection || ''}
              onChange={(e) => setBudget({ ...budget, collection: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block">Tamanho</label>
            <input
              type="text"
              value={budget.size || ''}
              onChange={(e) => setBudget({ ...budget, size: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block">Status</label>
            <select
              value={budget.status}
              onChange={(e) => setBudget({ ...budget, status: e.target.value })}
              className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="draft">Rascunho</option>
              <option value="sent">Enviado</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
            </select>
          </div>
          <div>
            <label className="block">Data de Início</label>
            <div className="mt-1 flex space-x-2">
              <input
                type="date"
                value={budget.project_start_date || ''}
                onChange={(e) => {
                  const date = e.target.value;
                  setBudget(prev => ({
                    ...prev,
                    project_start_date: date,
                    estimated_end_date: calculateEstimatedEndDate(date, getTotalLeadTime()),
                  }));
                }}
                className="block w-full rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={setStartDateToToday}
                className="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block">Data Prevista de Conclusão</label>
            <input
              type="date"
              value={
                budget.project_start_date
                  ? calculateEstimatedEndDate(budget.project_start_date, getTotalLeadTime())
                  : ''
              }
              readOnly
              className="mt-1 block w-full rounded border-gray-300 bg-gray-50 shadow-sm"
            />
          </div>
        </div>
        {/* Upload de Imagens */}
        <div className="mt-4">
          <label className="block mb-2">Imagens do Artigo</label>
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="h-20 w-20 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImages(prev => prev.filter((_, i) => i !== index));
                    setImageUrls(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="h-20 w-20 flex items-center justify-center border-2 border-dashed rounded cursor-pointer hover:border-indigo-500">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
              />
              <Plus className="h-6 w-6 text-gray-400" />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // Renderização da tabela de Itens (Materiais) com layout estilo Excel, fonte reduzida e ordem atualizada
  function renderItemsTable() {
    const totalItemsLeadTime = items.reduce((sum, item) => sum + (item.lead_time_days || 0), 0);
    const totalItemsCost = items.reduce((sum, item) => sum + item.line_cost, 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1 w-1/2">Descrição</th>
              <th className="border px-2 py-1">Fornecedor</th>
              <th className="border px-2 py-1 w-16">QNT</th>
              <th className="border px-2 py-1">Unid</th>
              <th className="border px-2 py-1">Preço Unit. (€)</th>
              <th className="border px-2 py-1">Custo Total (€)</th>
              <th className="border px-2 py-1">MOQ</th>
              <th className="border px-2 py-1">Leadtime</th>
              <th className="border px-2 py-1">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-100">
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={item.supplier}
                    onChange={(e) => updateItem(index, 'supplier', e.target.value)}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                    className="w-full text-center text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className="w-full text-sm"
                  >
                    {UNIT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    readOnly
                    value={item.line_cost.toFixed(2)}
                    className="w-full bg-gray-50 text-center text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  {item.has_moq ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.moq_quantity || ''}
                      onChange={(e) => updateItem(index, 'moq_quantity', Number(e.target.value))}
                      className="w-full text-center text-sm"
                    />
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.lead_time_days || ''}
                    onChange={(e) => updateItem(index, 'lead_time_days', Number(e.target.value))}
                    className="w-full text-center text-sm"
                    placeholder="Dias"
                  />
                </td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 text-xs text-gray-700">
          Total Leadtime: {totalItemsLeadTime} dias | Total Custo: € {totalItemsCost.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex items-center px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Item
        </button>
      </div>
    );
  }

  // Renderização da tabela de Extras com layout estilo Excel, semelhante aos Itens
  function renderExtrasTable() {
    const totalExtrasLeadTime = extras.reduce((sum, extra) => sum + (extra.lead_time_days || 0), 0);
    const totalExtrasCost = extras.reduce((sum, extra) => sum + extra.line_cost, 0);
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-1">Descrição</th>
              <th className="border px-2 py-1">Fornecedor</th>
              <th className="border px-2 py-1 w-16">QNT</th>
              <th className="border px-2 py-1">Preço Unit. (€)</th>
              <th className="border px-2 py-1">Custo Total (€)</th>
              <th className="border px-2 py-1">Lead Time (dias)</th>
              <th className="border px-2 py-1">Ações</th>
            </tr>
          </thead>
          <tbody>
            {extras.map((extra, index) => (
              <tr key={index} className="hover:bg-gray-100">
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={extra.description}
                    onChange={(e) => updateExtra(index, 'description', e.target.value)}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="text"
                    value={extra.supplier}
                    onChange={(e) => updateExtra(index, 'supplier', e.target.value)}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extra.quantity}
                    onChange={(e) => updateExtra(index, 'quantity', Number(e.target.value))}
                    className="w-full text-center text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extra.unit_price}
                    onChange={(e) => updateExtra(index, 'unit_price', Number(e.target.value))}
                    className="w-full text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    readOnly
                    value={extra.line_cost.toFixed(2)}
                    className="w-full bg-gray-50 text-center text-sm"
                  />
                </td>
                <td className="border px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={extra.lead_time_days || ''}
                    onChange={(e) => updateExtra(index, 'lead_time_days', Number(e.target.value))}
                    className="w-full text-center text-sm"
                    placeholder="Dias"
                  />
                </td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => removeExtra(index)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 text-xs text-gray-700">
          Total Leadtime: {totalExtrasLeadTime} dias | Total Custo: € {totalExtrasCost.toFixed(2)}
        </div>
        <button
          type="button"
          onClick={addExtra}
          className="mt-2 flex items-center px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Extra
        </button>
      </div>
    );
  }

  // Renderização minimalista e organizada das Opções de Preço
  function renderPricingOptions() {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6 text-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Opções de Preço</h2>
        {/* Cabeçalho */}
        <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-500 border-b pb-2">
          <div className="text-center">Custo (€)</div>
          <div className="text-center">Quantidade</div>
          <div className="text-center">Margem (%)</div>
          <div className="text-center">Margem (€)</div>
          <div className="text-center">Total (€)</div>
          <div className="text-center">Preço do Cliente (€)</div>
        </div>
        {/* Linhas de opções */}
        {pricingOptions.map((option, index) => (
          <div
            key={option.id}
            className="grid grid-cols-6 gap-2 items-center py-2 border-b last:border-0"
          >
            <div className="text-center">
              <input
                type="number"
                readOnly
                value={(option.totalCost - option.marginAmount).toFixed(2)}
                className="w-full text-center bg-gray-50 border border-gray-300 rounded"
              />
            </div>
            <div className="text-center">
              <input
                type="number"
                min="0"
                step="0.01"
                value={option.quantity}
                onChange={(e) =>
                  updatePricingOption(index, 'quantity', Number(e.target.value))
                }
                className="w-full text-center border border-gray-300 rounded"
              />
            </div>
            <div className="text-center">
              <input
                type="number"
                min="0"
                value={option.marginPercentage}
                onChange={(e) =>
                  updatePricingOption(index, 'marginPercentage', Number(e.target.value))
                }
                className="w-full text-center border border-gray-300 rounded"
              />
            </div>
            <div className="text-center">
              <input
                type="number"
                readOnly
                value={option.marginAmount.toFixed(2)}
                className="w-full text-center bg-gray-50 border border-gray-300 rounded"
              />
            </div>
            <div className="text-center">
              <input
                type="number"
                readOnly
                value={option.totalCost.toFixed(2)}
                className="w-full text-center bg-gray-50 border border-gray-300 rounded"
              />
            </div>
            <div className="text-center">
              <input
                type="number"
                readOnly
                value={option.clientPrice.toFixed(2)}
                className="w-full text-center bg-gray-50 border border-gray-300 rounded"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-sm">Carregando...</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-4"> 
        {id ? 'Editar Orçamento' : 'Novo Orçamento'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {renderGeneralFields()}
        <div className="bg-white shadow-sm rounded-lg p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Itens do Orçamento</h2>
          {renderItemsTable()}
        </div>
        <div className="bg-white shadow-sm rounded-lg p-4">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Extras</h2>
          {renderExtrasTable()}
        </div>
        {renderPricingOptions()}
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => navigate('/budgets')}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
