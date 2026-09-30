/**
 * Async data hooks with loading / error state for the mock service layer.
 *
 * Each hook wraps a contractService call and returns { data, loading, error, retry }.
 * Skeletons render while `loading`; error panels render on `error`.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  AppError,
  Clause,
  ContractDetail,
  Reviewer,
  TemplateCatalogEntry,
} from "../models";
import { contractService, type ClauseFilter } from "../services/contractService";
import { getMockTemplateCatalog } from "../data/templateCatalog";
import { useContractsRefreshKey } from "../data/contractsRefresh";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
}

function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = []
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const run = useCallback(() => {
    setState({ data: null, loading: true, error: null });
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: AppError) =>
        setState({ data: null, loading: false, error })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, retry: run };
}

/**
 * Returns the client-side mock template catalog defined in
 * `data/templateCatalog.ts`. The three entries point at `.docx` files served
 * by the Vite dev server from `react/public/docx-templates/`; the bytes are
 * POSTed to the unchanged `<service>/api/documenteditor/Import` endpoint when
 * an editor mounts, so the server pipeline is unaffected.
 *
 * Cards on the Dashboard render from this hook. The error/retry path in
 * `UploadTemplatePanel` stays in place even though the data is local — the
 * Promise shape is preserved, so `loading` / `error` / `retry` keep working
 * identically to the old server fetch.
 */
export function useTemplateCatalog() {
  return useAsync<TemplateCatalogEntry[]>(() => getMockTemplateCatalog(), []);
}

export function useContract(id: string) {
  return useAsync<ContractDetail>(() => contractService.getContract(id), [id]);
}

/**
 * Fetches every contract visible on the All Documents page (seed catalogue
 * + uploaded DOCX stubs). Re-runs whenever the shared refresh key changes
 * (driven by `bumpContractsRefresh()` after an upload, or by a `storage`
 * event from a sibling tab) so every contract-derived view stays in sync
 * without a hard reload. A caller-supplied `refreshKey` is XOR-mixed with
 * the shared key so manual overrides still work.
 */
export function useContracts(refreshKey = 0) {
  const sharedKey = useContractsRefreshKey();
  return useAsync<ContractDetail[]>(
    () => contractService.listContracts(),
    [sharedKey ^ refreshKey]
  );
}

export function useClauses(filter?: ClauseFilter) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = JSON.stringify(filter ?? {});
  return useAsync<Clause[]>(() => contractService.getClauses(filter), [key]);
}

export function useReviewers() {
  return useAsync<Reviewer[]>(() => contractService.getReviewers());
}
