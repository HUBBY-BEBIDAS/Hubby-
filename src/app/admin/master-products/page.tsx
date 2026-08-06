"use client";

import { useEffect, useState } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

type MasterProduct = {
  id: string;
  ean_code: string | null;
  brand: string;
  manufacturer: string | null;
  name: string;
  category: string;
  subcategory: string | null;
  unit_volume_ml: number;
  units_per_package: number;
  package_type: string;
  alcohol_percentage: number | null;
  status: string;
  images: { id: string; url: string; is_primary: boolean }[];
  _count: { matched_products: number; aliases: number };
};

export default function AdminMasterProductsPage() {
  const token = useApiToken();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    ean_code: "",
    brand: "",
    name: "",
    category: "beer",
    package_type: "lata",
    unit_volume_ml: 350,
    units_per_package: 1,
    primary_image_url: "",
  });

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set("q", search);
      const res = await apiFetch(`/api/admin/master-products?${query.toString()}`, { token });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.master_products || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiFetch("/api/admin/master-products", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          unit_volume_ml: Number(form.unit_volume_ml),
          units_per_package: Number(form.units_per_package),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback("✅ Produto adicionado com sucesso ao Catálogo Oficial!");
        setShowModal(false);
        setForm({
          ean_code: "",
          brand: "",
          name: "",
          category: "beer",
          package_type: "lata",
          unit_volume_ml: 350,
          units_per_package: 1,
          primary_image_url: "",
        });
        fetchProducts();
      } else {
        setFeedback(`❌ Erro: ${data.error || "Falha ao cadastrar"}`);
      }
    } catch {
      setFeedback("❌ Erro de conexão com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📦 Catálogo Oficial Hubby</span>
            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
              MasterProducts
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Base oficial de bebidas com imagens padronizadas e associação inteligente por EAN / atributos.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg transition flex items-center justify-center gap-2"
        >
          <span>+ Cadastrar SKU Oficial</span>
        </button>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700 text-sm">
          {feedback}
        </div>
      )}

      {/* Filtro e Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nome, marca ou EAN-13..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-96 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
      </div>

      {/* Tabela de MasterProducts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando catálogo oficial...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhum SKU encontrado no catálogo oficial.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Imagem</th>
                  <th className="px-6 py-4">SKU / Marca</th>
                  <th className="px-6 py-4">Embalagem</th>
                  <th className="px-6 py-4">EAN-13</th>
                  <th className="px-6 py-4">Vínculos</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {products.map((p) => {
                  const primaryImg = p.images.find((i) => i.is_primary)?.url || p.images[0]?.url;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4">
                        {primaryImg ? (
                          <img
                            src={primaryImg}
                            alt={p.name}
                            className="w-10 h-10 object-contain rounded bg-slate-950 p-1 border border-slate-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-xs text-slate-500">
                            Sem Foto
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.brand}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {p.package_type} · {p.unit_volume_ml}ml
                        {p.units_per_package > 1 && (
                          <span className="ml-1.5 text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            Pack {p.units_per_package}x
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {p.ean_code || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="text-emerald-400">{p._count.matched_products} distribuidora(s)</div>
                        <div className="text-slate-500">{p._count.aliases} apelido(s)</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full font-medium">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Novo SKU no Catálogo Oficial</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Heineken Long Neck 330ml"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Heineken"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Código EAN-13 (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: 7891991000833"
                    value={form.ean_code}
                    onChange={(e) => setForm({ ...form, ean_code: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Embalagem</label>
                  <select
                    value={form.package_type}
                    onChange={(e) => setForm({ ...form, package_type: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
                  >
                    <option value="lata">Lata</option>
                    <option value="garrafa">Garrafa</option>
                    <option value="barril">Barril</option>
                    <option value="caixa">Caixa</option>
                    <option value="fardo">Fardo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Volume (ml)</label>
                  <input
                    type="number"
                    required
                    value={form.unit_volume_ml}
                    onChange={(e) => setForm({ ...form, unit_volume_ml: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Unidades por Pack</label>
                  <input
                    type="number"
                    required
                    value={form.units_per_package}
                    onChange={(e) => setForm({ ...form, units_per_package: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">URL da Foto Oficial (S3 / CDN)</label>
                <input
                  type="url"
                  placeholder="https://cdn.hubby.com/master-products/heineken-330ml.webp"
                  value={form.primary_image_url}
                  onChange={(e) => setForm({ ...form, primary_image_url: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Salvando..." : "Salvar SKU"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
