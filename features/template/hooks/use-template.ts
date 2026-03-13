"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { requestJson } from "@/features/shared/api/request-json";
import type { DeckItem } from "@/features/deck-list/types";
import type { TemplateItem, TemplateListResult, TemplatePreview } from "@/features/template/types";

const HOME_TEMPLATES_QUERY_KEY = ["templates", "home"] as const;

export function useHomeTemplates(initialTemplates: TemplateItem[]) {
  return useQuery({
    queryKey: HOME_TEMPLATES_QUERY_KEY,
    queryFn: async () => {
      const response = await requestJson<{ ok: true; templates: TemplateItem[] }>("/api/templates/home");
      return response.templates;
    },
    initialData: initialTemplates,
  });
}

export function useTemplateList(params: { scene?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ["templates", "list", params.scene ?? "all", params.page ?? 1, params.pageSize ?? 24] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.scene) {
        search.set("scene", params.scene);
      }
      if (params.page && params.page > 1) {
        search.set("page", String(params.page));
      }
      if (params.pageSize) {
        search.set("pageSize", String(params.pageSize));
      }

      const query = search.toString();
      const response = await requestJson<{ ok: true } & TemplateListResult>(
        `/api/templates${query ? `?${query}` : ""}`,
      );
      return {
        templates: response.templates,
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        scenes: response.scenes,
      } satisfies TemplateListResult;
    },
  });
}

export function useCreateDeckFromTemplate() {
  return useMutation({
    mutationFn: async (templateId: string) => {
      const response = await requestJson<{ ok: true; deck: DeckItem }>("/api/documents/from-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateId }),
      });

      return response.deck;
    },
  });
}

export function useTemplatePreview(templateId: string | null) {
  return useQuery({
    queryKey: ["templates", "preview", templateId] as const,
    queryFn: async () => {
      const response = await requestJson<{ ok: true; preview: TemplatePreview }>(
        `/api/templates/${templateId}/preview`,
      );
      return response.preview;
    },
    enabled: Boolean(templateId),
  });
}
