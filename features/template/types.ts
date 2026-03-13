export type TemplateItem = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  sceneTag: string;
  lang: string;
  ratio: string;
  isFree: boolean;
  sortOrder: number;
};

export type TemplateListResult = {
  templates: TemplateItem[];
  total: number;
  page: number;
  pageSize: number;
  scenes: string[];
};

export type TemplatePreviewSlide = {
  position: number;
  xmlContent: string;
};

export type TemplatePreview = {
  id: string;
  title: string;
  sceneTag: string;
  ratio: string;
  slides: TemplatePreviewSlide[];
};
