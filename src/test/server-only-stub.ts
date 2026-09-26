// Stands in for the `server-only` package, which Next.js aliases at build time to enforce
// that server modules are never imported from the client. Vitest resolves it to this empty
// module so tests can import server components without pulling in that build-time guard.
export {};
