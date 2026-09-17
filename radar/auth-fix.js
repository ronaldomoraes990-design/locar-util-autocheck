(() => {
  if (!window.supabase?.createClient) return;

  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const STORAGE_KEY = 'locar-util-radar-auth-v4';

  function timeoutError(message) {
    const err = new Error(message);
    err.code = 'RADAR_AUTH_TIMEOUT';
    return err;
  }

  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function directPasswordLogin(url, key, credentials) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.msg || payload.error_description || payload.error || `Falha no login (${response.status})`;
        return { data: { user: null, session: null }, error: new Error(message) };
      }

      return {
        data: {
          user: payload.user || null,
          session: {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expires_in: payload.expires_in,
            expires_at: payload.expires_at,
            token_type: payload.token_type,
            user: payload.user || null
          }
        },
        error: null
      };
    } finally {
      clearTimeout(timer);
    }
  }

  window.supabase.createClient = function patchedCreateClient(url, key, options = {}) {
    const client = originalCreateClient(url, key, {
      ...options,
      auth: {
        ...(options.auth || {}),
        storageKey: STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    const originalSignIn = client.auth.signInWithPassword.bind(client.auth);
    const originalGetSession = client.auth.getSession.bind(client.auth);

    client.auth.getSession = async (...args) => {
      try {
        return await withTimeout(originalGetSession(...args), 7000, 'Tempo excedido ao recuperar a sessão.');
      } catch (err) {
        if (err?.code === 'RADAR_AUTH_TIMEOUT') {
          try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
          return { data: { session: null }, error: null };
        }
        throw err;
      }
    };

    client.auth.signInWithPassword = async (credentials) => {
      try {
        return await withTimeout(originalSignIn(credentials), 9000, 'Tempo excedido no login.');
      } catch (err) {
        if (err?.code !== 'RADAR_AUTH_TIMEOUT') {
          return { data: { user: null, session: null }, error: err };
        }

        try {
          const fallback = await directPasswordLogin(url, key, credentials);
          if (fallback.error || !fallback.data?.session) return fallback;

          const session = fallback.data.session;
          const setResult = await withTimeout(
            client.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            }),
            9000,
            'Login confirmado, mas a sessão não pôde ser salva.'
          );

          return setResult?.data?.session ? setResult : fallback;
        } catch (fallbackError) {
          const message = fallbackError?.name === 'AbortError'
            ? 'O servidor de login não respondeu a tempo.'
            : (fallbackError?.message || 'Não foi possível concluir o login.');
          return { data: { user: null, session: null }, error: new Error(message) };
        }
      }
    };

    return client;
  };
})();