"use client";

import { useState, FormEvent, useEffect } from "react";
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
  const [streetNumber, setStreetNumber] = useState("");
  const [complement, setComplement] = useState("");

  const [cnpjValidating, setCnpjValidating] = useState(false);
  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
  const [cnpjError, setCnpjError] = useState("");
  const [cnpjOfficialName, setCnpjOfficialName] = useState("");

  // Valida o CNPJ na ReceitaWS quando atinge 14 dígitos e preenche a razão social
  useEffect(() => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      setCnpjValid(null);
      setCnpjError("");
      setCnpjOfficialName("");
      return;
    }

    const timer = setTimeout(async () => {
      setCnpjValidating(true);
      setCnpjError("");
      setCnpjValid(null);
      try {
        const res = await fetch(`/api/cnpj/validate?cnpj=${clean}`);
        const data = await res.json() as { valid: boolean; message?: string; data?: { razao_social: string } };
        setCnpjValidating(false);
        if (res.ok && data.valid) {
          setCnpjValid(true);
          const officialName = data.data?.razao_social ?? "";
          setCnpjOfficialName(officialName);
          if (officialName) {
            setCompanyName(officialName);
          }
        } else {
          setCnpjValid(false);
          setCnpjError(data.message ?? "CNPJ inválido ou inativo na Receita Federal.");
        }
      } catch {
        setCnpjValidating(false);
        setCnpjValid(false);
        setCnpjError("Erro ao conectar ao serviço de consulta de CNPJ.");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [cnpj]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Impede envio se o CNPJ ainda estiver sendo verificado ou for inválido
    const cleanCnpjStr = cnpj.replace(/\D/g, "");
    if (cleanCnpjStr.length === 14) {
      if (cnpjValidating) {
        setError("Aguarde a validação do CNPJ na Receita Federal...");
        return;
      }
      if (cnpjValid !== true) {
        setError(cnpjError || "Por favor, informe um CNPJ ativo na Receita Federal.");
        return;
      }
    } else {
      setError("Por favor, preencha o CNPJ completo.");
      return;
    }

    if (!streetNumber.trim()) {
      setError("Por favor, informe o número do estabelecimento que receberá a bebida.");
      return;
    }

    if (!token) {
      setError("Sessão expirada. Recarregue a página.");
      return;
    }

    setLoading(true);

    const fullAddress = `${address.trim()}, nº ${streetNumber.trim()}${complement.trim() ? ` (${complement.trim()})` : ""} - ${city}/${state}`;

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
        delivery_address_full: fullAddress,
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
              disabled
              placeholder="Preenchido automaticamente pelo CNPJ"
              required
            />

            <Input
              label="CNPJ"
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              required
            />

            {cnpj.replace(/\D/g, "").length === 14 && (
              <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
                cnpjValidating 
                  ? "border-blue-200 bg-blue-50/50" 
                  : cnpjValid === true
                    ? "border-[#22C55E]/30 bg-[#22C55E]/5"
                    : "border-red-200 bg-red-50/50"
              }`}>
                {cnpjValidating ? (
                  <>
                    <span className="mt-1 h-3.5 w-3.5 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                    <div>
                      <p className="text-xs font-bold text-blue-700">Verificando CNPJ na Receita Federal...</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">Consultando situação cadastral do estabelecimento.</p>
                    </div>
                  </>
                ) : cnpjValid === true ? (
                  <>
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 1.5L2 4v4c0 3.31 2.55 5.91 6 6.5 3.45-.59 6-3.19 6-6.5V4L8 1.5Z" fill="#16A34A" opacity=".2" stroke="#16A34A" strokeWidth="1.2" strokeLinejoin="round"/>
                      <path d="M5.5 8l2 2 3-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-[#16A34A]">CNPJ ATIVO na Receita Federal</p>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-700 truncate max-w-[280px]">
                        {cnpjOfficialName}
                      </p>
                      <p className="text-[10px] text-slate-400">Razão Social e situação cadastral confirmados.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-red-700">Falha na verificação do CNPJ</p>
                      <p className="mt-0.5 text-[11px] font-medium text-red-600">{cnpjError || "CNPJ inativo ou inexistente."}</p>
                    </div>
                  </>
                )}
              </div>
            )}

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
                stateFilter={state}
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
              label="Rua / Logradouro / Avenida"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Rua Augusta"
              required
            />

            <div className="flex gap-3">
              <Input
                label="Número do Estabelecimento"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                placeholder="Ex: 500 ou S/N"
                required
                className="flex-1 font-semibold"
              />
              <Input
                label="Complemento (opcional)"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Ex: Sala 12, Galpão B"
                className="flex-1"
              />
            </div>

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
