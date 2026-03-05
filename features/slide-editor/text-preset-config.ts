import type { TextPresetType } from "@/lib/slide-xml/types";

type TextPresetConfig = {
  label: string;
  sampleText: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 400 | 700;
  bold: boolean;
};

const TEXT_PRESET_ORDER: TextPresetType[] = ["display", "title", "subtitle", "body", "body-small"];

export const TEXT_PRESET_MAP: Record<TextPresetType, TextPresetConfig> = {
  display: {
    label: "大标题",
    sampleText: "大标题",
    fontSize: 44,
    fontFamily: "Montserrat",
    fontWeight: 700,
    bold: true,
  },
  title: {
    label: "标题",
    sampleText: "标题",
    fontSize: 32,
    fontFamily: "Montserrat",
    fontWeight: 700,
    bold: true,
  },
  subtitle: {
    label: "副标题",
    sampleText: "副标题",
    fontSize: 24,
    fontFamily: "Montserrat",
    fontWeight: 700,
    bold: true,
  },
  body: {
    label: "正文",
    sampleText: "正文",
    fontSize: 18,
    fontFamily: "Open Sans",
    fontWeight: 400,
    bold: false,
  },
  "body-small": {
    label: "小号正文",
    sampleText: "小号正文",
    fontSize: 14,
    fontFamily: "Open Sans",
    fontWeight: 400,
    bold: false,
  },
};

export const TEXT_PRESET_OPTIONS = TEXT_PRESET_ORDER.map((preset) => ({
  preset,
  ...TEXT_PRESET_MAP[preset],
}));
