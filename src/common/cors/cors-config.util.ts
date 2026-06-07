/** Headers the H5 client may send (REST + WebSocket preflight). */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Activity-Id',
  'X-Request-Id',
] as const;

export type CorsOriginPolicy =
  | boolean
  | string[]
  | ((
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => void);

export type CorsOptions = {
  origin: CorsOriginPolicy;
  credentials: boolean;
  methods: string[];
  allowedHeaders?: string[];
};

function isProductionEnv(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production';
}

/** Parse `CORS_ORIGINS` (comma-separated). Empty / unset → `null`. */
export function parseCorsOrigins(
  raw = process.env.CORS_ORIGINS,
): string[] | null {
  const configured = raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configured?.length) {
    return null;
  }

  if (configured.length === 1 && configured[0] === '*') {
    return ['*'];
  }

  return configured;
}

export function resolveCorsOrigin(
  nodeEnv = process.env.NODE_ENV,
  corsOrigins = parseCorsOrigins(),
): CorsOriginPolicy {
  if (corsOrigins) {
    if (corsOrigins.length === 1 && corsOrigins[0] === '*') {
      return true;
    }
    return corsOrigins;
  }

  if (isProductionEnv(nodeEnv)) {
    return false;
  }

  // Dev: reflect any Origin (localhost any port, 127.0.0.1, LAN IP for phone testing)
  return true;
}

export function resolveCorsOptions(
  nodeEnv = process.env.NODE_ENV,
  corsOrigins = parseCorsOrigins(),
): CorsOptions {
  const options: CorsOptions = {
    origin: resolveCorsOrigin(nodeEnv, corsOrigins),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  };

  // Dev: omit allowedHeaders so cors echoes Access-Control-Request-Headers
  if (!isProductionEnv(nodeEnv)) {
    return options;
  }

  return {
    ...options,
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
  };
}

export function describeCorsPolicy(
  nodeEnv = process.env.NODE_ENV,
  corsOrigins = parseCorsOrigins(),
): string {
  if (corsOrigins) {
    if (corsOrigins.length === 1 && corsOrigins[0] === '*') {
      return 'CORS: allow all origins (*)';
    }
    return `CORS: whitelist ${corsOrigins.join(', ')}`;
  }

  if (isProductionEnv(nodeEnv)) {
    return 'CORS: disabled (set CORS_ORIGINS in production)';
  }

  return 'CORS: dev mode (reflect origin, echo preflight headers)';
}
