import '../styles/global.css';

import { AppShell, Card, Field, Grid, EmptyState, Status } from '../components/AppShell';
import { formatValue, initialsFromLabel, abbreviateAddress } from '../components/utils';
import { registerReactComponent } from '../register';
import type { TokenLookupPayload, TokenLookupResult } from '../types';

function TokenLogo({ token }: { token: TokenLookupResult }) {
  const initials = initialsFromLabel(token.symbol || token.name || '');
  if (token.logoUri) {
    return <img src={token.logoUri} alt={token.symbol ?? token.name ?? 'Token'} className="dexter-token__logo" />;
  }
  return <div className="dexter-token__logo">{initials}</div>;
}

function TokenMetrics({ token }: { token: TokenLookupResult }) {
  return (
    <Grid columns={3}>
      <Field label="Category" value={formatValue(token.category || token.tokenType)} />
      <Field label="Decimals" value={formatValue(token.decimals)} />
      <Field label="Price (USD)" value={token.priceUsd ? `$${formatValue(token.priceUsd)}` : '—'} />
      <Field label="24h Change (%)" value={token.priceChange24hPct ? `${formatValue(token.priceChange24hPct)}%` : '—'} />
      <Field label="Liquidity (USD)" value={token.liquidityUsd ? `$${formatValue(token.liquidityUsd)}` : '—'} />
      <Field label="FDV (USD)" value={token.fdvUsd ? `$${formatValue(token.fdvUsd)}` : '—'} />
      <Field label="Volume 24h (USD)" value={token.volume24hUsd ? `$${formatValue(token.volume24hUsd)}` : '—'} />
    </Grid>
  );
}

registerReactComponent<TokenLookupPayload>('dexter-mcp/solana-token-lookup', (props) => {
  const tokens = Array.isArray(props.results) ? props.results : [];
  const query = props.query ?? '';

  return (
    <AppShell>
      <Card
        title="Solana Token Lookup"
        badge={{
          label: tokens.length ? `${tokens.length} result${tokens.length === 1 ? '' : 's'}` : 'No matches',
        }}
      >
        <Grid columns={2}>
          <Field label="Query" value={formatValue(query)} />
          <Field label="Limit" value={formatValue(props.limit ?? 'Auto')} />
        </Grid>
      </Card>
      {tokens.length ? (
        <div className="dexter-token-list">
          {tokens.map((token, index) => {
            const address = token.address ?? token.mintAddress ?? token.mint ?? '';
            return (
              <article key={`${address || index}`} className="dexter-token">
                <div className="dexter-token__header">
                  <TokenLogo token={token} />
                  <div className="dexter-token__title">
                    <span className="dexter-token__name">{formatValue(token.name || address)}</span>
                    <span className="dexter-token__symbol">{formatValue(token.symbol)}</span>
                  </div>
                </div>
                <Field label="Address" value={abbreviateAddress(address)} code />
                <TokenMetrics token={token} />
                {(token.websiteUrl || token.pairUrl || token.twitterUrl) && (
                  <Status>
                    {token.websiteUrl ? (
                      <a className="dexter-link" href={token.websiteUrl} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    ) : null}
                    {token.pairUrl ? (
                      <a className="dexter-link" href={token.pairUrl} target="_blank" rel="noreferrer">
                        View on Dexscreener
                      </a>
                    ) : null}
                    {token.twitterUrl ? (
                      <a className="dexter-link" href={token.twitterUrl} target="_blank" rel="noreferrer">
                        Twitter
                      </a>
                    ) : null}
                  </Status>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No tokens matched that query. Try broadening your search." />
      )}
    </AppShell>
  );
});
