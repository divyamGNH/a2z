export function githubProviders(credentials = {}) {
 const clientId = credentials.clientId ?? process.env.GITHUB_CLIENT_ID;
 const clientSecret = credentials.clientSecret ?? process.env.GITHUB_CLIENT_SECRET;
 if (!clientId && !clientSecret) return {};
 if (!clientId || !clientSecret) throw Error('Set both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the Node backend.');
 return { github: { clientId, clientSecret, disableDefaultScope: true, scope: ['read:user', 'user:email'] } };
}
