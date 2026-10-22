export const PACKAGING_LABEL_MAP: Record<string, string> = {
  garrafa: "Garrafa",
  lata: "Lata",
  barril: "Barril",
  caixa: "Caixa",
  fardo: "Fardo",
  tetra_pak: "Tetra Pak",
  other: "Outro",
};

export function getFamilyProductInfo(
  name: string,
  brand: string,
  packagingType: string
): { familyName: string; familyKey: string } {
  const typeLabel = PACKAGING_LABEL_MAP[packagingType] ?? packagingType;

  // Remapeia nome de produto removendo qualificadores de embalagem e volume para obter a sublinha pura
  let subline = name
    .replace(/\b(long\s+neck|lata|latão|garrafa|barril|caixa|fardo|tetra\s+pak|retornável|ks)\b/gi, "")
    .replace(/\b(\d+\.?\d*\s*(ml|l|litros?))\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!subline || subline.toLowerCase() === brand.toLowerCase()) {
    subline = brand;
  }

  // Nome unificado da família incluindo a embalagem (ex: "Heineken Garrafa", "Heineken Lata")
  const familyName = `${subline} ${typeLabel}`;
  const familyKey = `${brand.toLowerCase()}|${subline.toLowerCase()}|${packagingType.toLowerCase()}`;

  return { familyName, familyKey };
}
