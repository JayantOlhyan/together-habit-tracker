import { getStore } from '@netlify/blobs';
import { createRequestRuntime } from './request-runtime.mjs';
export const runtime=createRequestRuntime(getStore);
