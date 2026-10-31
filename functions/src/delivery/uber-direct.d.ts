// The published `uber-direct` package's own type declarations don't resolve under this
// project's TypeScript module resolution (its package.json only correctly points typings at
// its `exports` map, which requires `moduleResolution: "node16"/"bundler"`; the top-level
// "types" field points at a root `index.d.ts` that doesn't actually exist in the published
// package). Node's own require() resolves the package fine at runtime via `exports` — this
// is a compile-time-only gap. Declare the shape here instead of changing the project's
// shared moduleResolution setting; verified against the package's compiled dist/src/*.js.
declare module 'uber-direct' {
  export function getAccessToken(): Promise<string>

  export class DeliveriesClient {
    constructor(accessToken: string, customerID?: string)
    createQuote(req: Record<string, unknown>): Promise<Record<string, unknown>>
    createDelivery(req: Record<string, unknown>): Promise<Record<string, unknown>>
    getDelivery(deliveryId: string): Promise<Record<string, unknown>>
    listDeliveries(options?: Record<string, unknown>): Promise<Record<string, unknown>>
    cancelDelivery(deliveryId: string): Promise<Record<string, unknown>>
    updateDelivery(deliveryId: string, req: Record<string, unknown>): Promise<Record<string, unknown>>
    proofOfDelivery(deliveryId: string, req: Record<string, unknown>): Promise<Record<string, unknown>>
  }

  export function createDeliveriesClient(accessToken: string, customerID?: string): DeliveriesClient
}
