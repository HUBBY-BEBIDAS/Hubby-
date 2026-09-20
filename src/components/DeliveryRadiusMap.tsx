"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, Search, Check, AlertCircle, Crosshair, Sparkles } from "lucide-react";

interface DeliveryRadiusMapProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationChange?: (lat: number, lng: number) => void;
  addressHint?: string;
  readOnly?: boolean;
}

// Fallback: Centro de São Paulo (Praça da Sé)
const DEFAULT_LAT = -23.55052;
const DEFAULT_LNG = -46.633308;

const PRESET_KM = [5, 10, 20, 30, 50, 80, 100];

export function DeliveryRadiusMap({
  radiusKm,
  onRadiusChange,
  initialLat,
  initialLng,
  onLocationChange,
  addressHint,
  readOnly = false,
}: DeliveryRadiusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const [lat, setLat] = useState<number>(initialLat && initialLat !== 0 ? initialLat : DEFAULT_LAT);
  const [lng, setLng] = useState<number>(initialLng && initialLng !== 0 ? initialLng : DEFAULT_LNG);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Se as props iniciais mudarem após load
  useEffect(() => {
    if (initialLat && initialLng && initialLat !== 0 && initialLng !== 0) {
      setLat(initialLat);
      setLng(initialLng);
    }
  }, [initialLat, initialLng]);

  // ── 1. Inicialização do Mapa Leaflet ──────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!containerRef.current || mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      if (!isMounted || !containerRef.current) return;
      LRef.current = L;

      // Criação do mapa
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 11,
        scrollWheelZoom: "center",
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Camada de tiles OpenStreetMap padrão
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Ícone estilizado moderno em HTML DivIcon (verde Hubby com pino e pulso)
      const customPinIcon = L.divIcon({
        className: "hubby-pin-wrapper",
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -22px; margin-top: -22px;">
            <div style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; background: rgba(34, 197, 94, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background: #16A34A; border: 3px solid #FFFFFF; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      // Marcador central arrastável
      const marker = L.marker([lat, lng], {
        icon: customPinIcon,
        draggable: !readOnly,
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family: inherit; padding: 4px;">
          <strong style="color: #0F172A; font-size: 13px;">Sua Distribuidora</strong><br/>
          <span style="color: #64748B; font-size: 11px;">Ponto central do raio de entrega</span>
        </div>`
      );

      markerRef.current = marker;

      // Círculo de cobertura (raio em metros = radiusKm * 1000)
      const circle = L.circle([lat, lng], {
        radius: (radiusKm || 20) * 1000,
        color: "#16A34A",
        fillColor: "#22C55E",
        fillOpacity: 0.18,
        weight: 2.5,
        dashArray: "6, 8",
      }).addTo(map);

      circleRef.current = circle;
      mapInstanceRef.current = map;

      // Ajusta zoom para enquadrar o círculo
      try {
        map.fitBounds(circle.getBounds().pad(0.15));
      } catch {
        // Silencia erro se bounds forem inválidos
      }

      // Evento de arrasto do marcador
      if (!readOnly) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setLat(pos.lat);
          setLng(pos.lng);
          circle.setLatLng(pos);
          onLocationChange?.(pos.lat, pos.lng);
        });

        // Clique no mapa move o centro
        map.on("click", (e: any) => {
          const { lat: clickLat, lng: clickLng } = e.latlng;
          marker.setLatLng([clickLat, clickLng]);
          circle.setLatLng([clickLat, clickLng]);
          setLat(clickLat);
          setLng(clickLng);
          onLocationChange?.(clickLat, clickLng);
        });
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Executa uma única vez na montagem

  // ── 2. Atualização reativa do Raio e Posição ────────────────────────────────
  const updateMapVisuals = useCallback(
    (newLat: number, newLng: number, newRadiusKm: number, autoFit = false) => {
      const L = LRef.current;
      const map = mapInstanceRef.current;
      const marker = markerRef.current;
      const circle = circleRef.current;

      if (!L || !map || !marker || !circle) return;

      const pos: [number, number] = [newLat, newLng];
      marker.setLatLng(pos);
      circle.setLatLng(pos);
      circle.setRadius(Math.max(1, newRadiusKm) * 1000);

      if (autoFit) {
        try {
          map.fitBounds(circle.getBounds().pad(0.15), { animate: true });
        } catch {
          map.setView(pos, 11);
        }
      }
    },
    []
  );

  // Reage quando radiusKm muda via props
  useEffect(() => {
    updateMapVisuals(lat, lng, radiusKm, false);
  }, [radiusKm, lat, lng, updateMapVisuals]);

  // ── 3. Solicitação de Geolocalização do Dispositivo ──────────────────────────
  const requestDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Seu dispositivo ou navegador não possui suporte a geolocalização.");
      return;
    }

    setIsLocating(true);
    setGeoStatus(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        setLat(userLat);
        setLng(userLng);
        setIsLocating(false);
        setGeoStatus("Localização do dispositivo detectada com sucesso!");

        updateMapVisuals(userLat, userLng, radiusKm, true);
        onLocationChange?.(userLat, userLng);

        setTimeout(() => setGeoStatus(null), 4000);
      },
      (error) => {
        setIsLocating(false);
        let msg = "Não foi possível obter sua localização.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Permissão de localização negada pelo dispositivo ou navegador.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Informações de localização indisponíveis no momento.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Tempo esgotado ao buscar localização do dispositivo.";
        }
        setGeoStatus(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // ── 4. Busca por Endereço / CEP ─────────────────────────────────────────────
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim() || addressHint;
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const cleanCep = query.replace(/\D/g, "");
      let foundLat: number | null = null;
      let foundLng: number | null = null;

      if (cleanCep.length === 8) {
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
          if (r.ok) {
            const d = await r.json();
            const bLat = parseFloat(d.location?.coordinates?.latitude);
            const bLng = parseFloat(d.location?.coordinates?.longitude);
            if (!isNaN(bLat) && !isNaN(bLng) && bLat !== 0) {
              foundLat = bLat;
              foundLng = bLng;
            }
          }
        } catch {
          // fallback para nominatim
        }
      }

      if (!foundLat || !foundLng) {
        const encoded = encodeURIComponent(`${query}, Brasil`);
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`,
          { headers: { "User-Agent": "HubbySaaS/1.0 (contact@hubby.com.br)" } }
        );
        if (r.ok) {
          const resArr = await r.json();
          if (Array.isArray(resArr) && resArr.length > 0) {
            foundLat = parseFloat(resArr[0].lat);
            foundLng = parseFloat(resArr[0].lon);
          }
        }
      }

      if (foundLat && foundLng) {
        setLat(foundLat);
        setLng(foundLng);
        updateMapVisuals(foundLat, foundLng, radiusKm, true);
        onLocationChange?.(foundLat, foundLng);
        setSearchQuery("");
      } else {
        setSearchError("Endereço ou CEP não localizado no mapa.");
      }
    } catch {
      setSearchError("Erro ao buscar coordenadas do endereço.");
    } finally {
      setIsSearching(false);
    }
  };

  // ── 5. Recentralizar mapa na cobertura ──────────────────────────────────────
  const handleRecenter = () => {
    updateMapVisuals(lat, lng, radiusKm, true);
  };

  const estimatedAreaKm2 = Math.round(Math.PI * radiusKm * radiusKm);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Barra de Ações Rápidas: Localização do Dispositivo & Busca */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Botão de Localização do Dispositivo */}
          <button
            type="button"
            onClick={requestDeviceLocation}
            disabled={isLocating}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:from-[#15803D] hover:to-[#16A34A] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            <Navigation size={15} className={isLocating ? "animate-spin" : "stroke-[2.5]"} />
            {isLocating ? "Obtendo GPS do dispositivo..." : "Usar localização do meu dispositivo (GPS)"}
          </button>

          {/* Busca rápida de endereço/CEP */}
          <div className="flex items-center gap-1.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={addressHint ? `Ex: ${addressHint}` : "Buscar por CEP ou endereço..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchAddress()}
                className="w-full rounded-xl border border-[#DBEAFE] bg-white py-2 pl-3 pr-8 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#22C55E] focus:outline-none"
              />
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => handleSearchAddress()}
              disabled={isSearching}
              className="rounded-xl border border-[#DBEAFE] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              {isSearching ? "Buscando..." : "Localizar"}
            </button>
          </div>
        </div>
      )}

      {/* Alertas de Geolocalização ou Busca */}
      {geoStatus && (
        <div
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${
            geoStatus.includes("sucesso")
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {geoStatus.includes("sucesso") ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{geoStatus}</span>
        </div>
      )}

      {searchError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs text-red-700">
          <AlertCircle size={14} />
          <span>{searchError}</span>
        </div>
      )}

      {/* ── Container do Mapa Leaflet ────────────────────────────────────────── */}
      <div className="relative w-full h-[380px] sm:h-[420px] rounded-2xl border-2 border-[#22C55E]/30 overflow-hidden shadow-sm bg-slate-100">
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* Overlay Superior: Badge com Raio & Área de Cobertura */}
        <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/95 backdrop-blur-md px-3.5 py-2 shadow-md border border-slate-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16A34A]"></span>
            </span>
            <div className="text-xs">
              <span className="text-slate-500 font-medium">Raio Visual: </span>
              <strong className="text-[#0F172A] font-extrabold text-sm">{radiusKm} km</strong>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-white/90 backdrop-blur-md px-3 py-2 shadow-md border border-slate-200 text-xs text-slate-600">
            <Sparkles size={13} className="text-emerald-600" />
            <span>Cobertura: <strong>~{estimatedAreaKm2.toLocaleString("pt-BR")} km²</strong></span>
          </div>
        </div>

        {/* Overlay Inferior Esquerdo: Coordenadas e Dica */}
        <div className="absolute bottom-3 left-3 z-[400] max-w-[280px] sm:max-w-xs">
          <div className="rounded-xl bg-white/90 backdrop-blur-md px-3 py-1.5 shadow-sm border border-slate-200 text-[11px] text-slate-600">
            {!readOnly ? (
              <span>💡 <strong>Dica:</strong> Clique no mapa ou arraste o pino verde para definir seu galpão.</span>
            ) : (
              <span>Centro: Lat {lat.toFixed(4)}, Lng {lng.toFixed(4)}</span>
            )}
          </div>
        </div>

        {/* Botão Flutuante de Enquadramento */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Centralizar mapa no círculo de entrega"
          className="absolute top-3 right-3 z-[400] flex items-center justify-center h-9 w-9 rounded-xl bg-white/95 shadow-md border border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-white active:scale-95 transition"
        >
          <Crosshair size={18} />
        </button>
      </div>

      {/* ── Controles de Raio: Slider Interativo + Atalhos ────────────────────── */}
      {!readOnly && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#DBEAFE] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                Ajustar Raio de Entrega
              </label>
              <p className="text-xs text-slate-500">
                Arraste o controle ou clique nos atalhos para ver o círculo se ajustar em tempo real.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xl font-extrabold text-[#16A34A]">{radiusKm}</span>
              <span className="text-xs font-bold text-slate-500">km</span>
            </div>
          </div>

          {/* Slider de KM */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400">1 km</span>
            <input
              type="range"
              min={1}
              max={150}
              step={1}
              value={radiusKm}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#16A34A]"
            />
            <span className="text-[11px] font-bold text-slate-400">150 km</span>
          </div>

          {/* Atalhos Rápidos de Raio */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-medium mr-1">Atalhos rápidos:</span>
            {PRESET_KM.map((km) => {
              const active = radiusKm === km;
              return (
                <button
                  key={km}
                  type="button"
                  onClick={() => onRadiusChange(km)}
                  className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "bg-[#16A34A] text-white shadow-sm ring-2 ring-[#22C55E]/40"
                      : "bg-[#F5F7FB] border border-[#DBEAFE] text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {active && <Check size={12} className="stroke-[3]" />}
                  {km} km
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
