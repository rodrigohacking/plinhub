const axios = require('axios');

const PIPEFY_TOKEN_URL = process.env.PIPEFY_TOKEN_URL || 'https://app.pipefy.com/oauth/token';

/**
 * Cache em memória do access token atual.
 * Evita bater na API do Pipefy a cada requisição.
 */
let _cachedToken = null;
let _tokenExpiresAt = null; // timestamp em ms

/**
 * Verifica se o token em cache ainda é válido (com 60s de margem).
 */
function isCacheValid() {
    if (!_cachedToken || !_tokenExpiresAt) return false;
    return Date.now() < _tokenExpiresAt - 60_000; // 60s de buffer
}

/**
 * Busca um novo access token usando OAuth2 Client Credentials.
 * Requer PIPEFY_CLIENT_ID e PIPEFY_CLIENT_SECRET no .env.
 */
async function fetchNewToken() {
    const clientId = process.env.PIPEFY_CLIENT_ID;
    const clientSecret = process.env.PIPEFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            'PIPEFY_CLIENT_ID e PIPEFY_CLIENT_SECRET não estão configurados no .env. ' +
            'Adicione as credenciais da conta de serviço Pipefy.'
        );
    }

    const response = await axios.post(
        PIPEFY_TOKEN_URL,
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token || typeof access_token !== 'string') {
        throw new Error('OAuth2 não retornou um access_token válido. Verifique PIPEFY_CLIENT_ID e PIPEFY_CLIENT_SECRET.');
    }

    // Armazena no cache
    _cachedToken = access_token;
    _tokenExpiresAt = Date.now() + (expires_in || 3600) * 1000;

    console.log(`[PipefyToken] Novo token OAuth2 obtido. Expira em ${Math.round((expires_in || 3600) / 60)} minutos.`);

    return access_token;
}

/**
 * Retorna um token válido para usar na API do Pipefy.
 *
 * Ordem de prioridade:
 *  1. Cache em memória (se ainda válido)
 *  2. OAuth2 Client Credentials (PIPEFY_CLIENT_ID + PIPEFY_CLIENT_SECRET)
 *  3. Token pessoal estático (PIPEFY_TOKEN no .env) — fallback legado
 *  4. Token da integração do banco de dados passado como parâmetro
 *
 * @param {string|null} fallbackToken - Token decriptado do banco, usado como último recurso.
 */
async function getValidPipefyToken(fallbackToken = null) {
    // 1. Cache válido
    if (isCacheValid()) {
        return _cachedToken;
    }

    // 2. Token pessoal estático do .env (PAT — prioridade máxima, acesso total garantido)
    if (process.env.PIPEFY_TOKEN) {
        return process.env.PIPEFY_TOKEN;
    }

    // 3. OAuth2 Client Credentials (conta de serviço — usado quando não há PAT configurado)
    if (process.env.PIPEFY_CLIENT_ID && process.env.PIPEFY_CLIENT_SECRET) {
        try {
            return await fetchNewToken();
        } catch (err) {
            console.error('[PipefyToken] Falha ao renovar via OAuth2:', err.message);
            // Continua para fallbacks
        }
    }

    // 4. Token do banco de dados
    if (fallbackToken) {
        console.warn('[PipefyToken] Usando token do banco de dados (fallback legado).');
        return fallbackToken;
    }

    throw new Error('Nenhum token Pipefy disponível. Configure PIPEFY_TOKEN ou PIPEFY_CLIENT_ID/SECRET no .env.');
}

/**
 * Invalida o cache forçando renovação na próxima chamada.
 * Útil se receber um 401 da API do Pipefy.
 */
function invalidateCache() {
    _cachedToken = null;
    _tokenExpiresAt = null;
}

module.exports = { getValidPipefyToken, invalidateCache };
