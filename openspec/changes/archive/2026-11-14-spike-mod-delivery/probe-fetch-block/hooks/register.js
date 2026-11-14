// Refuses every $.http.fetch another mod makes, as a policy mod or an organization's web-fetch policy would.
export function register(on) {
  on('http.fetch', ($, e, next) =>
    next.origin.plugin === $.plugin.name ? next(e) : { deny: 'probe-fetch-block: network requests are refused by policy' },
  ).catch(() => ({ deny: 'probe-fetch-block: check failed, refused' }))
}
