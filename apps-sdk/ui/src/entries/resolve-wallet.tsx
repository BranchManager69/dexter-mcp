import '../styles/global.css';

import { AppShell, Card, Field, Grid, Status, Warning } from '../components/AppShell';
import { abbreviateAddress, formatTimestamp, formatValue } from '../components/utils';
import { registerReactComponent } from '../register';
import type { ResolveWalletPayload } from '../types';

registerReactComponent<ResolveWalletPayload>('dexter-mcp/resolve-wallet', (props) => {
  const resolvedAddress = props.wallet_address ?? '';
  const statusDetail = props.detail ? formatValue(props.detail) : null;
  const badges = [formatValue(props.source || 'unknown').toUpperCase()];
  if (props.bearer_source) {
    badges.push(`Bearer: ${formatValue(props.bearer_source)}`);
  }
  if (props.override_session) {
    badges.push(`Override: ${formatValue(props.override_session)}`);
  }

  return (
    <AppShell>
      <Card title="Active Dexter Wallet" badge={{ label: badges.join(' • ') }}>
        <Grid columns={2}>
          <Field label="Wallet Address" value={abbreviateAddress(resolvedAddress)} code />
          <Field label="User ID" value={formatValue(props.user_id)} />
          <Field label="Full Address" value={formatValue(resolvedAddress)} code />
          <Field label="Resolved Source" value={formatValue(props.source)} />
        </Grid>
        <Status>
          <span>Updated {formatTimestamp(Date.now())}</span>
          {statusDetail ? <span>{statusDetail}</span> : <span>Resolved via Dexter resolver.</span>}
          {props.override_session ? <Warning>Session override is active. Clear it with the `set_session_wallet_override` tool if needed.</Warning> : null}
        </Status>
      </Card>
    </AppShell>
  );
});
