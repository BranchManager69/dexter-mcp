const DEFAULT_WIDGET_DOMAIN = 'dexter-mcp';

export function createWidgetMeta({
  templateUri,
  invoking,
  invoked,
  widgetDescription,
  widgetDomain = DEFAULT_WIDGET_DOMAIN,
  extra = {},
} = {}) {
  if (!templateUri) {
    throw new Error('createWidgetMeta requires a templateUri');
  }

  const meta = {
    'openai/outputTemplate': templateUri,
    'openai/resultCanProduceWidget': true,
    'openai/widgetAccessible': false,
    'openai/widgetDomain': widgetDomain,
    'openai/widgetPrefersBorder': true,
    ...extra,
  };

  if (invoking) meta['openai/toolInvocation/invoking'] = invoking;
  if (invoked) meta['openai/toolInvocation/invoked'] = invoked;
  if (widgetDescription) meta['openai/widgetDescription'] = widgetDescription;

  return meta;
}
