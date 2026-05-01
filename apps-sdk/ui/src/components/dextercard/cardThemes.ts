/**
 * Card theme registry — faithful copy of dexter-fe/app/lib/cardThemes.ts.
 *
 * Themes drive both the look and the issuer-relationship behavior. Mirroring
 * the dexter-fe registry one-for-one keeps the cards visually identical
 * across surfaces (web, MCP widgets, future product) and means a brand
 * tweak ships in two places, not one. When dextercard moves to a shared
 * package later, this file goes away in favor of the package import.
 */

export type CardThemeId = 'orange' | 'obsidian' | 'moonagents';

export type CardIssuer = 'crossmint-rain' | 'moonagents' | 'dexter-internal';

export type CardNetwork = 'visa' | 'mastercard';

export interface CardTheme {
  id: CardThemeId;
  label: string;
  issuer: CardIssuer;
  network: CardNetwork;
  background: string;
  edgeHighlight: string;
  edgeShadow: string;
  outerShadow: string;
  accent: string;
  accentLight: string;
  textPrimary: string;
  textSecondary: string;
  textureColor: string;
  brandTreatment: 'plain' | 'engraved';
  visaColor: string;
  visaOpacity: number;
  glareStrength: number;
}

export const CARD_THEMES: CardTheme[] = [
  {
    id: 'orange',
    label: 'Original',
    issuer: 'crossmint-rain',
    network: 'visa',
    background: `
      radial-gradient(ellipse 120% 80% at 0% 0%, rgba(255, 180, 110, 0.45) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 100% 100%, rgba(255, 60, 0, 0.45) 0%, transparent 60%),
      linear-gradient(135deg, #ff8a3a 0%, #f26b1a 35%, #c84510 75%, #8a2c08 100%)
    `,
    edgeHighlight: 'rgba(255, 255, 255, 0.18)',
    edgeShadow: 'rgba(0, 0, 0, 0.25)',
    outerShadow: 'rgba(200, 60, 0, 0.55)',
    accent: '#ffffff',
    accentLight: 'rgba(255, 255, 255, 0.7)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textureColor: 'rgba(255, 255, 255, 0.04)',
    brandTreatment: 'plain',
    visaColor: '#ffffff',
    visaOpacity: 1,
    glareStrength: 0.22,
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    issuer: 'dexter-internal',
    network: 'visa',
    background: `
      radial-gradient(ellipse 110% 70% at 8% 8%, rgba(60, 50, 40, 0.55) 0%, transparent 60%),
      radial-gradient(ellipse 90% 70% at 92% 92%, rgba(20, 24, 32, 0.85) 0%, transparent 65%),
      linear-gradient(135deg, #1a1a1c 0%, #121214 35%, #0a0a0c 70%, #050506 100%)
    `,
    edgeHighlight: 'rgba(255, 255, 255, 0.10)',
    edgeShadow: 'rgba(0, 0, 0, 0.65)',
    outerShadow: 'rgba(0, 0, 0, 0.65)',
    accent: '#d4b87e',
    accentLight: '#f0d9a3',
    textPrimary: '#e6dcc4',
    textSecondary: 'rgba(212, 184, 126, 0.55)',
    textureColor: 'rgba(212, 184, 126, 0.025)',
    brandTreatment: 'engraved',
    visaColor: '#e6dcc4',
    visaOpacity: 0.85,
    glareStrength: 0.10,
  },
  {
    id: 'moonagents',
    label: 'MoonAgents',
    issuer: 'moonagents',
    network: 'mastercard',
    background: `
      radial-gradient(ellipse 100% 70% at 88% 12%, rgba(180, 200, 230, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse 90% 70% at 8% 92%, rgba(10, 14, 24, 0.85) 0%, transparent 65%),
      linear-gradient(135deg, #2a3548 0%, #1c2434 35%, #131826 70%, #0a0d18 100%)
    `,
    edgeHighlight: 'rgba(255, 255, 255, 0.12)',
    edgeShadow: 'rgba(0, 0, 0, 0.55)',
    outerShadow: 'rgba(10, 14, 24, 0.6)',
    accent: '#c8d4e8',
    accentLight: '#e6eef8',
    textPrimary: '#e6eef8',
    textSecondary: 'rgba(200, 212, 232, 0.6)',
    textureColor: 'rgba(200, 212, 232, 0.04)',
    brandTreatment: 'plain',
    visaColor: '#ffffff',
    visaOpacity: 1,
    glareStrength: 0.14,
  },
];

export function getCardTheme(id: CardThemeId): CardTheme {
  const t = CARD_THEMES.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown card theme: ${id}`);
  return t;
}
