import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMyPdfsApi, deletePdfApi } from "../api/pdf.api";

export const DOCUMENTS_QUERY_KEY = ["documents"];

export function useDocumentsQuery(options = {}) {
  return useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: async () => {
      const docs = await fetchMyPdfsApi();
      return docs || [];
    },
    staleTime: 1000 * 60, // 1 minute fresh
    ...options,
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deletePdfApi(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(DOCUMENTS_QUERY_KEY, (prevDocs) => {
        if (!Array.isArray(prevDocs)) return [];
        return prevDocs.filter((doc) => doc._id !== deletedId && doc.id !== deletedId);
      });
    },
  });
}
