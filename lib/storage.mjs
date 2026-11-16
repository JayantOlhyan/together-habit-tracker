export class StorageUnavailableError extends Error {
  constructor(cause) {
    super('The shared store is temporarily unavailable. Please try again.', {cause});
    this.name='StorageUnavailableError';
  }
}

// Never send SDK internals, token details, or provider responses to the browser.
export function protectStore(store) {
  return Object.fromEntries(['get','getWithMetadata','set','setJSON'].map(method=>[
    method,
    async (...args)=>{
      try { return await store[method](...args); }
      catch(error) { throw new StorageUnavailableError(error); }
    }
  ]));
}
