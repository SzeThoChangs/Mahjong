/**
 * Where the app's own files live, which is not always the root.
 *
 * A site served from `example.com/` finds its data at `/quiz/...`. A site served from
 * `user.github.io/which-tile/` does not: the same path lands on the account's root and 404s. Vite
 * knows the answer as `BASE_URL` - "/" for a normal build, "/which-tile/" when the build was told
 * where it would live - so every path the app fetches or shows goes through here rather than being
 * written with a leading slash.
 *
 * This is the whole of what it takes to move the app between hosts, and it was worth doing before a
 * host was chosen rather than after: the failure is silent in development, where the base is always
 * "/" and everything works right up until it is deployed somewhere it is not.
 */
const BASE = import.meta.env.BASE_URL || '/';

/** `asset('quiz/index.json')` -> `/quiz/index.json` or `/which-tile/quiz/index.json`. */
export const asset = (path: string): string => BASE + path.replace(/^\//, '');
