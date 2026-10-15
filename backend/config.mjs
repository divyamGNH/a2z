export function checkProductionConfig({ production, secret, frontend, baseURL, emailReady, githubEnabled }) {
 if (!production) return { emailPasswordEnabled: true, emailVerificationRequired: false };
 const missing = [];
 if (!secret || secret.length < 32) missing.push('BETTER_AUTH_SECRET must contain at least 32 characters');
 for (const [name, value] of [['FRONTEND_URL', frontend], ['BETTER_AUTH_URL', baseURL]]) {
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value.endsWith('/')) throw Error(); }
  catch { missing.push(`${name} must be an HTTPS origin without a path or trailing slash`); }
 }
 if (!emailReady && !githubEnabled) missing.push('configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or SMTP_HOST and MAIL_FROM');
 if (missing.length) throw Error(`Production configuration: ${missing.join('; ')}.`);
 return { emailPasswordEnabled: emailReady, emailVerificationRequired: emailReady };
}
