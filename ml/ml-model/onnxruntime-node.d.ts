/** Type shim — runtime package lives in api/node_modules (see api/package.json). */
declare module 'onnxruntime-node' {
  export class Tensor {
    constructor(type: string, data: Float32Array, dims: number[]);
  }

  export namespace InferenceSession {
    type Feeds = Record<string, Tensor>;
    type ReturnType = Record<string, { data: ArrayLike<number> | BigInt64Array }>;
  }

  export class InferenceSession {
    static create(path: string): Promise<InferenceSession>;
    run(feeds: InferenceSession.Feeds): Promise<InferenceSession.ReturnType>;
  }
}
