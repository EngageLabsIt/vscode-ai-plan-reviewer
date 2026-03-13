import { useMemo } from 'react';
import type { WebViewMessage } from '../../shared/messages';

interface VsCodeApi {
  postMessage(message: WebViewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;

let _api: VsCodeApi | undefined;

function getVsCodeApi(): VsCodeApi {
  if (!_api) {
    _api = acquireVsCodeApi();
  }
  return _api;
}

export function useVsCodeApi(): VsCodeApi {
  return useMemo(() => getVsCodeApi(), []);
}
