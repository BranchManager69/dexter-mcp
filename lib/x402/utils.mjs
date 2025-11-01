function snakeToCamelCase(str) {
  return str.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function normalizeInputSchema(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'query_params':
        result.queryParams = value;
        break;
      case 'body_fields':
        result.bodyFields = value;
        break;
      case 'body_type':
        result.bodyType = value;
        break;
      case 'header_fields':
        result.headerFields = value;
        break;
      case 'body':
        if (!result.bodyFields) result.bodyFields = value;
        break;
      case 'query':
        if (!result.queryParams) result.queryParams = value;
        break;
      case 'headers':
        if (!result.headerFields) result.headerFields = value;
        break;
      default:
        result[key] = value;
        break;
    }
  }
  return result;
}

function normalizeOutputSchema(outputSchema) {
  if (!outputSchema || typeof outputSchema !== 'object' || Array.isArray(outputSchema)) {
    return outputSchema;
  }
  const result = {};
  for (const [key, value] of Object.entries(outputSchema)) {
    if (key === 'input') {
      result.input = normalizeInputSchema(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizeAcceptEntry(accept) {
  if (!accept || typeof accept !== 'object' || Array.isArray(accept)) {
    return accept;
  }
  const result = {};
  for (const [key, value] of Object.entries(accept)) {
    if (key === 'outputSchema' || key === 'output_schema') {
      result.outputSchema = normalizeOutputSchema(value);
    } else {
      const camelKey = snakeToCamelCase(key);
      result[camelKey] = value;
    }
  }
  return result;
}

export function normalizeX402Fields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'accepts' && Array.isArray(value)) {
      result.accepts = value.map((entry) => normalizeAcceptEntry(entry));
    } else {
      const camelKey = snakeToCamelCase(key);
      result[camelKey] = value;
    }
  }
  return result;
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

export function coerceNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function coerceString(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

export function trimUrl(candidate) {
  try {
    const url = new URL(candidate);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return candidate;
  }
}
