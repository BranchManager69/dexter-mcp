import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/x402-wallet.css';

import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef } from 'react';
import { useOpenAIGlobal } from '../sdk';

type WalletPayload = {
  address?: string;
  network?: string;
  networkName?: string;
  balances?: { sol: number; usdc: number };
  walletFile?: string;
  tip?: string;
  error?: string;
};

function generateQR(data: string, size: number): string {
  // Minimal QR-like visual using SVG grid pattern for the address
  // Real QR generation would use a library, but for iframe sandbox we use a visual placeholder
  const cells = 21;
  const cellSize = size / cells;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  // Hash the data into a deterministic pattern
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      // Position detection patterns (corners)
      const inTopLeft = row < 7 && col < 7;
      const inTopRight = row < 7 && col >= cells - 7;
      const inBottomLeft = row >= cells - 7 && col < 7;

      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = row % 7 < 1 || row % 7 > 5 || col % 7 < 1 || col % 7 > 5;
        const inner = row % 7 >= 2 && row % 7 <= 4 && col % 7 >= 2 && col % 7 <= 4;
        if (lr || inner) {
          svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
        }
        continue;
      }

      // Data cells from hash
      const seed = (hash ^ (row * 31 + col * 17)) & 0xffff;
      if (seed % 3 < 1) {
        svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  svg += '</svg>';
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function WalletDashboard() {
  const toolOutput = useOpenAIGlobal('toolOutput') as WalletPayload | null;
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    if (toolOutput?.address) {
      setQrSrc(generateQR(toolOutput.address, 140));
    }
  }, [toolOutput?.address]);

  if (!toolOutput) {
    return <div className="wallet"><div className="wallet-setup"><span className="wallet-setup__title">Loading wallet...</span></div></div>;
  }

  if (toolOutput.error && !toolOutput.address) {
    return (
      <div className="wallet">
        <div className="wallet-setup">
          <span className="wallet-setup__title">Wallet Not Configured</span>
          <span className="wallet-setup__cmd">npx @dexterai/mcp wallet</span>
          <span className="wallet-setup__hint">Or set DEXTER_PRIVATE_KEY environment variable</span>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    if (!toolOutput.address) return;
    try {
      await navigator.clipboard.writeText(toolOutput.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const hasUsdc = (toolOutput.balances?.usdc ?? 0) > 0;

  return (
    <div className="wallet">
      <div className="wallet-card">
        <div className="wallet-header">
          <span className="wallet-header__title">
            <span className="wallet-header__icon">◎</span>
            x402 Wallet
          </span>
          <span className="wallet-network">{toolOutput.networkName || 'Solana'}</span>
        </div>

        <div className="wallet-address" onClick={handleCopy} style={{ cursor: 'pointer' }}>
          <span className="wallet-address__text">{toolOutput.address}</span>
          <button className="wallet-address__copy">{copied ? 'Copied!' : 'Copy'}</button>
        </div>

        <div className="wallet-balances">
          <div className="wallet-balance">
            <span className="wallet-balance__label">USDC</span>
            <span className={`wallet-balance__value ${hasUsdc ? 'wallet-balance__value--usdc' : 'wallet-balance__value--zero'}`}>
              ${toolOutput.balances?.usdc.toFixed(2) ?? '0.00'}
            </span>
          </div>
          <div className="wallet-balance">
            <span className="wallet-balance__label">SOL</span>
            <span className="wallet-balance__value">
              {toolOutput.balances?.sol.toFixed(4) ?? '0.0000'}
              <span className="wallet-balance__unit"> SOL</span>
            </span>
          </div>
        </div>

        {toolOutput.tip && <div className="wallet-tip">{toolOutput.tip}</div>}

        {qrSrc && (
          <div className="wallet-qr">
            <img src={qrSrc} alt="Wallet QR" width={140} height={140} style={{ borderRadius: 12 }} />
          </div>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('x402-wallet-root');
if (root) createRoot(root).render(<WalletDashboard />);

export default WalletDashboard;
