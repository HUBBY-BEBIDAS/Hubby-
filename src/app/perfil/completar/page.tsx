"use client";

import { useState, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CityAutocomplete, type CityOption } from "@/components/ui/CityAutocomplete";
import { StateSelect } from "@/components/ui/StateSelect";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";

const ESTABLISHMENT_TYPES = [
  { value: "bar",         label: "Bar" },
  { value: "restaurant",  label: "Restaurante" },
  { value: "adega",       label: "Adega" },
  { value: "hotel",       label: "Hotel" },
  { value: "nightclub",   label: "Casa Noturna" },
  { value: "supermarket", label: "Supermercado" },
  { value: "convenience", label: "Conveniência" },
  { value: "other",       label: "Outro" },
];

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatWhatsapp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export default function CompletarPerfilPage() {
  const { update } = useSession();
  const token = useApiToken();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [establishmentType, setEstablishmentType] = useState("bar");
  const [responsible, setResponsible] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Sessão expirada. Recarregue a página.");
      return;
    }

    setLoading(true);

    const res = await apiFetch("/api/profile/complete", {
      method: "POST",
      token,
      body: JSON.stringify({
        company_name: companyName,
        cnpj: cnpj.replace(/\D/g, ""),
        establishment_type: establishmentType,
        responsible_name: responsible,
        whatsapp: whatsapp.replace(/\D/g, ""),
        delivery_city: city,
        delivery_state: state.toUpperCase().slice(0, 2),
        delivery_address_full: address,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Erro ao salvar perfil. Tente novamente.");
      return;
    }

    // Atualiza o JWT (profileComplete → true) e faz hard-redirect para garantir
    // que o cookie atualizado seja enviado na próxima requisição ao proxy.
    await update();
    window.location.replace("/cotacao");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold text-[#2563EB]">SIC</span>
        </div>

        {/* Aviso */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Complete o cadastro do seu perfil antes de criar cotações.
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-display font-semibold text-gray-900">Complete seu perfil</h1>
          <p className="mb-6 text-sm text-gray-500">
            Precisamos de algumas informações sobre o seu estabelecimento.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Razão Social / Nome do estabelecimento"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />

            <Input
              label="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Tipo de estabelecimento
              </label>
              <select
                value={establishmentType}
                onChange={(e) => setEstablishmentType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {ESTABLISHMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <Input
              label="Nome do responsável"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              required
            />

            <Input
              label="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
              placeholder="(11) 99999-9999"
              required
            />

            <hr className="my-1" />

            <div className="flex gap-3">
              <CityAutocomplete
                label="Cidade de entrega"
                value={city}
                onSelect={(opt: CityOption) => {
                  if (opt.city) {
                    setCity(opt.city);
                    setState(opt.state);
                  }
                }}
                required
              />
              <StateSelect
                label="UF"
                value={state}
                onChange={(uf) => setState(uf)}
                required
                className="w-36"
              />
            </div>

            <Input
              label="Endereço completo"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro"
              required
            />

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg" disabled={!token}>
              Salvar e continuar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
