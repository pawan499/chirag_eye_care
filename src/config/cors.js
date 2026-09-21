export function createCorsOptions({ corsOrigin, nodeEnv }) {
  const origins = corsOrigin.split(',').map((value) => value.trim()).filter(Boolean);
  const wildcard = origins.includes('*');
  return {
    origin(origin, callback) {
      let localDevelopment = false;
      if (origin && nodeEnv === 'development') {
        try {
          const url = new URL(origin);
          localDevelopment = ['http:', 'https:'].includes(url.protocol)
            && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        } catch { /* Invalid origins are not allowed. */ }
      }
      callback(null, !origin || wildcard || origins.includes(origin) || localDevelopment);
    },
    credentials: !wildcard,
  };
}
