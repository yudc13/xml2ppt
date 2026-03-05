import { create } from "zustand";

import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type {
  ShapeAttributes,
  ShapeStyle,
  SlideDocumentModel,
  TableModel,
  TextPresetType,
  XmlNode,
  XmlValue,
} from "@/lib/slide-xml/types";
import { TEXT_PRESET_MAP } from "@/features/slide-editor/text-preset-config";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const MIN_SHAPE_SIZE = 12;
const DEFAULT_INSERT_WIDTH = 180;
const DEFAULT_INSERT_HEIGHT = 44;
const DEFAULT_SHAPE_SIZE = 160;
const DEFAULT_LINE_WIDTH = 280;
const DEFAULT_LINE_HEIGHT = 4;
const DEFAULT_TABLE_ROWS = 3;
const DEFAULT_TABLE_COLUMNS = 3;
const MAX_TABLE_GRID_SIZE = 10;
const HISTORY_LIMIT = 100;

export type InsertShapeType = "rect" | "ellipse" | "line" | "arrow";
type BorderLineStyle = "solid" | "dashed" | "dotted";
type SnapGuides = {
  vertical: number | null;
  horizontal: number | null;
};

export type PendingInsertion =
  | { type: "shape"; shapeType: InsertShapeType }
  | { type: "text"; preset: TextPresetType }
  | { type: "table"; rows: number; columns: number };

type EditableSlideShape = {
  id: string;
  attributes: ShapeAttributes;
  style: ShapeStyle;
  rawNode: XmlNode;
  contentHtml: string;
  zIndex: number;
};

type HistorySnapshot = {
  shapes: EditableSlideShape[];
  selectedShapeId: string | null;
  editingShapeId: string | null;
};

type SlideEditorState = {
  currentSlideIndex: number | null;
  currentSlideMeta: Pick<SlideDocumentModel, "slideId" | "rawSlideNode"> | null;
  isPreviewMode: boolean;
  shapes: EditableSlideShape[];
  clipboardShape: EditableSlideShape | null;
  selectedShapeId: string | null;
  editingShapeId: string | null;
  pendingInsertion: PendingInsertion | null;
  snapGuides: SnapGuides;
  initializeSlide: (slideIndex: number, model: SlideDocumentModel) => void;
  selectShape: (shapeId: string | null) => void;
  setEditingShape: (shapeId: string | null) => void;
  setPendingInsertion: (insertion: PendingInsertion | null) => void;
  setPreviewMode: (value: boolean) => void;
  updateShapePosition: (shapeId: string, topLeftX: number, topLeftY: number) => void;
  updateShapeSize: (shapeId: string, width: number, height: number) => void;
  updateShapeRotation: (shapeId: string, rotation: number) => void;
  updateShapeContent: (shapeId: string, contentHtml: string, contentNode?: XmlValue) => void;
  updateShapeFillColor: (shapeId: string, color: string) => void;
  updateShapeBorderStyle: (shapeId: string, style: BorderLineStyle) => void;
  updateShapeBorderColor: (shapeId: string, color: string) => void;
  updateShapeBorderWidth: (shapeId: string, width: number) => void;
  updateTableCell: (shapeId: string, rowIndex: number, colIndex: number, text: string) => void;
  insertTableRowAt: (shapeId: string, rowIndex: number, position: "before" | "after") => void;
  removeTableRowAt: (shapeId: string, rowIndex: number) => void;
  insertTableColumnAt: (shapeId: string, colIndex: number, position: "before" | "after") => void;
  removeTableColumnAt: (shapeId: string, colIndex: number) => void;
  copySelectedShape: () => void;
  pasteCopiedShape: () => void;
  deleteSelectedShape: () => void;
  insertTextPreset: (preset: TextPresetType, position?: { x: number; y: number }) => void;
  insertShape: (shapeType: InsertShapeType, position?: { x: number; y: number }) => void;
  insertTable: (rows?: number, columns?: number, position?: { x: number; y: number }) => void;
  setSnapGuides: (guides: SnapGuides) => void;
  clearSnapGuides: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  captureHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;
  buildSlideDocumentModel: () => SlideDocumentModel | null;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeRotation(value: number): number {
  const normalized = ((value % 360) + 360) % 360;
  return round2(normalized);
}

function normalizeShapeAttributes(attributes: ShapeAttributes): ShapeAttributes {
  const width = round2(clamp(attributes.width, MIN_SHAPE_SIZE, SLIDE_WIDTH));
  const height = round2(clamp(attributes.height, MIN_SHAPE_SIZE, SLIDE_HEIGHT));

  return {
    ...attributes,
    width,
    height,
    topLeftX: round2(clamp(attributes.topLeftX, 0, SLIDE_WIDTH - width)),
    topLeftY: round2(clamp(attributes.topLeftY, 0, SLIDE_HEIGHT - height)),
    rotation: normalizeRotation(attributes.rotation),
  };
}

function toHistorySnapshot(state: SlideEditorState): HistorySnapshot {
  return {
    shapes: structuredClone(state.shapes),
    selectedShapeId: state.selectedShapeId,
    editingShapeId: state.editingShapeId,
  };
}

function updateShape(
  shapes: EditableSlideShape[],
  shapeId: string,
  updater: (shape: EditableSlideShape) => EditableSlideShape,
): EditableSlideShape[] {
  return shapes.map((shape) => {
    if (shape.id !== shapeId) {
      return shape;
    }

    return updater(shape);
  });
}

function reorderZIndex(
  shapes: EditableSlideShape[],
  selectedShapeId: string,
  mode: "front" | "back",
): EditableSlideShape[] {
  const sorted = [...shapes].sort((a, b) => a.zIndex - b.zIndex);
  const selected = sorted.find((shape) => shape.id === selectedShapeId);
  if (!selected) {
    return shapes;
  }

  const others = sorted.filter((shape) => shape.id !== selectedShapeId);
  const reordered = mode === "front" ? [...others, selected] : [selected, ...others];

  return reordered.map((shape, index) => ({
    ...shape,
    zIndex: index,
  }));
}

function toXmlObject(value: XmlValue | undefined): XmlNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as XmlNode) };
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toInsertPosition(
  width: number,
  height: number,
  center?: { x: number; y: number },
): Pick<ShapeAttributes, "topLeftX" | "topLeftY"> {
  if (center) {
    return {
      topLeftX: round2(center.x - width / 2),
      topLeftY: round2(center.y - height / 2),
    };
  }

  return {
    topLeftX: round2((SLIDE_WIDTH - width) / 2),
    topLeftY: round2((SLIDE_HEIGHT - height) / 2),
  };
}

function getNextZIndex(shapes: EditableSlideShape[]): number {
  if (shapes.length === 0) {
    return 0;
  }

  return Math.max(...shapes.map((shape) => shape.zIndex)) + 1;
}

function buildTextPresetContentNode(preset: TextPresetType): XmlNode {
  const presetStyle = TEXT_PRESET_MAP[preset];
  const spanNode: XmlNode = {
    "#text": presetStyle.sampleText,
    "@_fontSize": presetStyle.fontSize,
    "@_fontFamily": presetStyle.fontFamily,
    "@_color": "rgba(31, 35, 41, 1)",
  };

  return {
    "@_verticalAlign": "top",
    p: {
      ...(presetStyle.bold ? { strong: { span: spanNode } } : { span: spanNode }),
    },
  };
}

function buildDefaultTableModel(rows: number, columns: number): TableModel {
  const safeRows = Math.min(MAX_TABLE_GRID_SIZE, Math.max(1, rows));
  const safeColumns = Math.min(MAX_TABLE_GRID_SIZE, Math.max(1, columns));

  return {
    rows: Array.from({ length: safeRows }, (_, rowIndex) => ({
      id: createId(`row-${rowIndex + 1}`),
      cells: Array.from({ length: safeColumns }, (_, colIndex) => ({
        id: createId(`cell-${rowIndex + 1}-${colIndex + 1}`),
        text: "",
      })),
    })),
  };
}

function buildTableContentNode(table: TableModel): XmlNode {
  return {
    table: {
      row: table.rows.map((row) => ({
        "@_id": row.id,
        cell: row.cells.map((cell) => ({
          "@_id": cell.id,
          "#text": cell.text,
        })),
      })),
    },
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseTableModel(contentNode: XmlValue | undefined): TableModel | null {
  if (!contentNode || typeof contentNode !== "object" || Array.isArray(contentNode)) {
    return null;
  }

  const content = contentNode as XmlNode;
  const tableValue = content.table;
  if (!tableValue || typeof tableValue !== "object" || Array.isArray(tableValue)) {
    return null;
  }

  const tableNode = tableValue as XmlNode;
  const rowNodes = toArray(tableNode.row as XmlValue | XmlValue[] | undefined);
  if (rowNodes.length === 0) {
    return null;
  }

  const rows = rowNodes
    .map((rowValue, rowIndex) => {
      if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) {
        return null;
      }

      const rowNode = rowValue as XmlNode;
      const rowId = typeof rowNode["@_id"] === "string" ? rowNode["@_id"] : createId(`row-${rowIndex + 1}`);
      const cellNodes = toArray(rowNode.cell as XmlValue | XmlValue[] | undefined);
      const cells = cellNodes
        .map((cellValue, colIndex) => {
          if (!cellValue || typeof cellValue !== "object" || Array.isArray(cellValue)) {
            return null;
          }

          const cellNode = cellValue as XmlNode;
          return {
            id:
              typeof cellNode["@_id"] === "string"
                ? cellNode["@_id"]
                : createId(`cell-${rowIndex + 1}-${colIndex + 1}`),
            text: typeof cellNode["#text"] === "string" ? cellNode["#text"] : "",
          };
        })
        .filter((cell): cell is { id: string; text: string } => Boolean(cell));

      if (cells.length === 0) {
        return null;
      }

      return {
        id: rowId,
        cells,
      };
    })
    .filter((row): row is TableModel["rows"][number] => Boolean(row));

  if (rows.length === 0) {
    return null;
  }

  return { rows };
}

function createEditableShape(params: {
  id: string;
  type: ShapeAttributes["type"];
  width: number;
  height: number;
  position?: { x: number; y: number };
  style?: ShapeStyle;
  rawNode: XmlNode;
  contentNode?: XmlNode;
  zIndex: number;
}): EditableSlideShape {
  const normalized = normalizeShapeAttributes({
    id: params.id,
    type: params.type,
    width: params.width,
    height: params.height,
    rotation: 0,
    ...toInsertPosition(params.width, params.height, params.position),
  });
  const mergedRawNode: XmlNode = {
    ...params.rawNode,
    "@_id": normalized.id,
    "@_type": normalized.type,
    "@_width": normalized.width,
    "@_height": normalized.height,
    "@_topLeftX": normalized.topLeftX,
    "@_topLeftY": normalized.topLeftY,
    "@_rotation": normalized.rotation,
  };

  if (params.contentNode) {
    mergedRawNode.content = params.contentNode;
  }

  return {
    id: normalized.id,
    attributes: normalized,
    style: params.style ?? {},
    rawNode: mergedRawNode,
    contentHtml: params.contentNode ? buildShapeContentHtml(params.contentNode) : "",
    zIndex: params.zIndex,
  };
}

function cloneShapeForDuplicate(source: EditableSlideShape, offset = 24): EditableSlideShape {
  const id = createId("shape-copy");
  const attributes = normalizeShapeAttributes({
    ...source.attributes,
    id,
    topLeftX: source.attributes.topLeftX + offset,
    topLeftY: source.attributes.topLeftY + offset,
  });
  const rawNode = structuredClone(source.rawNode);
  rawNode["@_id"] = attributes.id;
  rawNode["@_topLeftX"] = attributes.topLeftX;
  rawNode["@_topLeftY"] = attributes.topLeftY;
  rawNode["@_width"] = attributes.width;
  rawNode["@_height"] = attributes.height;
  rawNode["@_rotation"] = attributes.rotation;

  return {
    ...source,
    id,
    attributes,
    rawNode,
    zIndex: source.zIndex + 1,
  };
}

export const useSlideEditorStore = create<SlideEditorState>((set, get) => ({
  currentSlideIndex: null,
  currentSlideMeta: null,
  isPreviewMode: false,
  shapes: [],
  clipboardShape: null,
  selectedShapeId: null,
  editingShapeId: null,
  pendingInsertion: null,
  snapGuides: { vertical: null, horizontal: null },
  historyPast: [],
  historyFuture: [],
  initializeSlide: (slideIndex, model) => {
    set(() => {
      return {
        currentSlideIndex: slideIndex,
        currentSlideMeta: {
          slideId: model.slideId,
          rawSlideNode: model.rawSlideNode,
        },
        selectedShapeId: null,
        editingShapeId: null,
        pendingInsertion: null,
        snapGuides: { vertical: null, horizontal: null },
        historyPast: [],
        historyFuture: [],
        shapes: model.shapes.map((shape, index) => {
          const normalizedAttributes = normalizeShapeAttributes(shape.attributes);
          const normalizedRawNode = {
            ...shape.rawNode,
            "@_rotation": normalizedAttributes.rotation,
          };

          return {
            id: shape.attributes.id,
            attributes: normalizedAttributes,
            style: shape.style,
            rawNode: normalizedRawNode,
            contentHtml: shape.rawNode.content ? buildShapeContentHtml(shape.rawNode.content) : "",
            zIndex: index,
          };
        }),
      };
    });
  },
  selectShape: (shapeId) => {
    set(() => ({ selectedShapeId: shapeId }));
  },
  setEditingShape: (shapeId) => {
    set(() => ({ editingShapeId: shapeId }));
  },
  setPendingInsertion: (insertion) => {
    set(() => ({
      pendingInsertion: insertion,
      selectedShapeId: insertion ? null : get().selectedShapeId,
      editingShapeId: insertion ? null : get().editingShapeId,
    }));
  },
  setPreviewMode: (value) => {
    set(() => ({
      isPreviewMode: value,
      selectedShapeId: value ? null : get().selectedShapeId,
      editingShapeId: value ? null : get().editingShapeId,
    }));
  },
  updateShapePosition: (shapeId, topLeftX, topLeftY) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const width = shape.attributes.width;
        const height = shape.attributes.height;

        return {
          ...shape,
          attributes: {
            ...shape.attributes,
            topLeftX: round2(clamp(topLeftX, 0, SLIDE_WIDTH - width)),
            topLeftY: round2(clamp(topLeftY, 0, SLIDE_HEIGHT - height)),
          },
        };
      }),
    }));
  },
  updateShapeSize: (shapeId, width, height) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const isTextShape = shape.attributes.type === "text";
        const maxWidth = isTextShape ? Number.POSITIVE_INFINITY : SLIDE_WIDTH - shape.attributes.topLeftX;
        const maxHeight = isTextShape ? Number.POSITIVE_INFINITY : SLIDE_HEIGHT - shape.attributes.topLeftY;

        return {
          ...shape,
          attributes: {
            ...shape.attributes,
            width: round2(clamp(width, MIN_SHAPE_SIZE, maxWidth)),
            height: round2(clamp(height, MIN_SHAPE_SIZE, maxHeight)),
          },
        };
      }),
    }));
  },
  updateShapeRotation: (shapeId, rotation) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => ({
        ...shape,
        attributes: {
          ...shape.attributes,
          rotation: normalizeRotation(rotation),
        },
        rawNode: {
          ...shape.rawNode,
          "@_rotation": normalizeRotation(rotation),
        },
      })),
    }));
  },
  updateShapeContent: (shapeId, contentHtml, contentNode) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => ({
        ...shape,
        contentHtml,
        rawNode: {
          ...shape.rawNode,
          content: contentNode ?? shape.rawNode.content,
        },
      })),
    }));
  },
  updateShapeFillColor: (shapeId, color) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const fillNode = toXmlObject(shape.rawNode.fill);
        const fillColorNode = toXmlObject(fillNode.fillColor as XmlValue | undefined);

        return {
          ...shape,
          rawNode: {
            ...shape.rawNode,
            fill: {
              ...fillNode,
              fillColor: {
                ...fillColorNode,
                "@_color": color,
              },
            },
          },
        };
      }),
    }));
  },
  updateShapeBorderStyle: (shapeId, style) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const borderNode = toXmlObject(shape.rawNode.border);
        const hasColor = typeof borderNode["@_color"] === "string";
        const hasWidth = Number.isFinite(Number(borderNode["@_width"]));

        return {
          ...shape,
          rawNode: {
            ...shape.rawNode,
            border: {
              "@_color": hasColor ? borderNode["@_color"] : "rgba(31, 35, 41, 1)",
              "@_width": hasWidth ? Number(borderNode["@_width"]) : 1,
              ...borderNode,
              "@_style": style,
            },
          },
        };
      }),
    }));
  },
  updateShapeBorderColor: (shapeId, color) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const borderNode = toXmlObject(shape.rawNode.border);
        const hasWidth = Number.isFinite(Number(borderNode["@_width"]));

        return {
          ...shape,
          rawNode: {
            ...shape.rawNode,
            border: {
              "@_width": hasWidth ? Number(borderNode["@_width"]) : 1,
              ...borderNode,
              "@_color": color,
            },
          },
        };
      }),
    }));
  },
  updateShapeBorderWidth: (shapeId, width) => {
    const normalizedWidth = round2(clamp(width, 0, 24));
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        const borderNode = toXmlObject(shape.rawNode.border);
        const hasColor = typeof borderNode["@_color"] === "string";

        return {
          ...shape,
          rawNode: {
            ...shape.rawNode,
            border: {
              "@_color": hasColor ? borderNode["@_color"] : "rgba(31, 35, 41, 1)",
              ...borderNode,
              "@_width": normalizedWidth,
            },
          },
        };
      }),
    }));
  },
  updateTableCell: (shapeId, rowIndex, colIndex, text) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        if (shape.attributes.type !== "table") {
          return shape;
        }

        const tableModel = parseTableModel(shape.rawNode.content);
        if (!tableModel) {
          return shape;
        }

        const rows = tableModel.rows.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) {
            return row;
          }

          return {
            ...row,
            cells: row.cells.map((cell, currentColIndex) =>
              currentColIndex === colIndex ? { ...cell, text } : cell,
            ),
          };
        });

        return {
          ...shape,
          contentHtml: "",
          rawNode: {
            ...shape.rawNode,
            content: buildTableContentNode({ rows }),
          },
        };
      }),
    }));
  },
  insertTableRowAt: (shapeId, rowIndex, position) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        if (shape.attributes.type !== "table") {
          return shape;
        }

        const tableModel = parseTableModel(shape.rawNode.content) ?? buildDefaultTableModel(1, 1);
        const columnCount = Math.max(1, tableModel.rows[0]?.cells.length ?? 1);
        const safeRowIndex = clamp(rowIndex, 0, tableModel.rows.length - 1);
        const insertIndex = position === "before" ? safeRowIndex : safeRowIndex + 1;
        const nextRowIndex = insertIndex + 1;
        const nextRow = {
          id: createId(`row-${nextRowIndex}`),
          cells: Array.from({ length: columnCount }, (_, colIndex) => ({
            id: createId(`cell-${nextRowIndex}-${colIndex + 1}`),
            text: "",
          })),
        };
        const rows = [
          ...tableModel.rows.slice(0, insertIndex),
          nextRow,
          ...tableModel.rows.slice(insertIndex),
        ];

        return {
          ...shape,
          attributes: {
            ...shape.attributes,
            height: round2(clamp(Math.max(shape.attributes.height, rows.length * 44), MIN_SHAPE_SIZE, SLIDE_HEIGHT)),
          },
          contentHtml: "",
          rawNode: {
            ...shape.rawNode,
            content: buildTableContentNode({ rows }),
          },
        };
      }),
    }));
  },
  removeTableRowAt: (shapeId, rowIndex) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        if (shape.attributes.type !== "table") {
          return shape;
        }

        const tableModel = parseTableModel(shape.rawNode.content);
        if (!tableModel || tableModel.rows.length <= 1) {
          return shape;
        }

        const safeRowIndex = clamp(rowIndex, 0, tableModel.rows.length - 1);
        const rows = tableModel.rows.filter((_, currentIndex) => currentIndex !== safeRowIndex);
        return {
          ...shape,
          contentHtml: "",
          rawNode: {
            ...shape.rawNode,
            content: buildTableContentNode({ rows }),
          },
        };
      }),
    }));
  },
  insertTableColumnAt: (shapeId, colIndex, position) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        if (shape.attributes.type !== "table") {
          return shape;
        }

        const tableModel = parseTableModel(shape.rawNode.content) ?? buildDefaultTableModel(1, 1);
        const columnCount = Math.max(1, tableModel.rows[0]?.cells.length ?? 1);
        const safeColIndex = clamp(colIndex, 0, columnCount - 1);
        const insertIndex = position === "before" ? safeColIndex : safeColIndex + 1;
        const rows = tableModel.rows.map((row, rowIndex) => ({
          ...row,
          cells: [
            ...row.cells.slice(0, insertIndex),
            {
              id: createId(`cell-${rowIndex + 1}-${insertIndex + 1}`),
              text: "",
            },
            ...row.cells.slice(insertIndex),
          ],
        }));

        return {
          ...shape,
          attributes: {
            ...shape.attributes,
            width: round2(
              clamp(Math.max(shape.attributes.width, (rows[0]?.cells.length ?? 1) * 120), MIN_SHAPE_SIZE, SLIDE_WIDTH),
            ),
          },
          contentHtml: "",
          rawNode: {
            ...shape.rawNode,
            content: buildTableContentNode({ rows }),
          },
        };
      }),
    }));
  },
  removeTableColumnAt: (shapeId, colIndex) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => {
        if (shape.attributes.type !== "table") {
          return shape;
        }

        const tableModel = parseTableModel(shape.rawNode.content);
        const columnCount = tableModel?.rows[0]?.cells.length ?? 1;
        if (!tableModel || columnCount <= 1) {
          return shape;
        }

        const safeColIndex = clamp(colIndex, 0, columnCount - 1);
        const rows = tableModel.rows.map((row) => ({
          ...row,
          cells: row.cells.filter((_, currentIndex) => currentIndex !== safeColIndex),
        }));

        return {
          ...shape,
          contentHtml: "",
          rawNode: {
            ...shape.rawNode,
            content: buildTableContentNode({ rows }),
          },
        };
      }),
    }));
  },
  copySelectedShape: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      const selected = state.shapes.find((shape) => shape.id === state.selectedShapeId);
      if (!selected) {
        return state;
      }

      return {
        clipboardShape: structuredClone(selected),
      };
    });
  },
  pasteCopiedShape: () => {
    set((state) => {
      const source =
        state.clipboardShape ??
        (state.selectedShapeId ? state.shapes.find((shape) => shape.id === state.selectedShapeId) : null);
      if (!source) {
        return state;
      }

      const duplicated = cloneShapeForDuplicate(source);
      const nextZIndex = getNextZIndex(state.shapes);

      return {
        shapes: [...state.shapes, { ...duplicated, zIndex: nextZIndex }],
        selectedShapeId: duplicated.id,
        editingShapeId: duplicated.attributes.type === "table" ? duplicated.id : null,
        clipboardShape: structuredClone(source),
      };
    });
  },
  deleteSelectedShape: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      return {
        shapes: state.shapes.filter((shape) => shape.id !== state.selectedShapeId),
        selectedShapeId: null,
        editingShapeId: state.editingShapeId === state.selectedShapeId ? null : state.editingShapeId,
      };
    });
  },
  insertTextPreset: (preset, position) => {
    set((state) => {
      const shapeId = createId("shape-text");
      const contentNode = buildTextPresetContentNode(preset);
      const nextShape = createEditableShape({
        id: shapeId,
        type: "text",
        width: DEFAULT_INSERT_WIDTH,
        height: DEFAULT_INSERT_HEIGHT,
        position,
        rawNode: {
          fill: {
            fillColor: {
              "@_color": "rgba(255, 255, 255, 0)",
            },
          },
        },
        contentNode,
        zIndex: getNextZIndex(state.shapes),
      });

      return {
        shapes: [...state.shapes, nextShape],
        selectedShapeId: nextShape.id,
        editingShapeId: nextShape.id,
      };
    });
  },
  insertShape: (shapeType, position) => {
    set((state) => {
      const shapeId = createId(`shape-${shapeType}`);
      const isLineLike = shapeType === "line" || shapeType === "arrow";
      const width = isLineLike ? DEFAULT_LINE_WIDTH : DEFAULT_SHAPE_SIZE;
      const height = isLineLike ? DEFAULT_LINE_HEIGHT : DEFAULT_SHAPE_SIZE;
      const nextShape = createEditableShape({
        id: shapeId,
        type: shapeType,
        width,
        height,
        position,
        style: shapeType === "ellipse" ? { borderRadius: "9999px" } : {},
        rawNode: {
          fill: {
            fillColor: {
              "@_color": isLineLike ? "rgba(255, 255, 255, 0)" : "rgba(13, 116, 206, 0.08)",
            },
          },
          border: {
            "@_color": "rgba(13, 116, 206, 1)",
            "@_width": 2,
          },
        },
        zIndex: getNextZIndex(state.shapes),
      });

      return {
        shapes: [...state.shapes, nextShape],
        selectedShapeId: nextShape.id,
        editingShapeId: null,
      };
    });
  },
  insertTable: (rows = DEFAULT_TABLE_ROWS, columns = DEFAULT_TABLE_COLUMNS, position) => {
    set((state) => {
      const shapeId = createId("shape-table");
      const safeRows = Math.min(MAX_TABLE_GRID_SIZE, Math.max(1, rows));
      const safeColumns = Math.min(MAX_TABLE_GRID_SIZE, Math.max(1, columns));
      const tableModel = buildDefaultTableModel(safeRows, safeColumns);
      const width = round2(clamp(Math.max(260, safeColumns * 96), MIN_SHAPE_SIZE, SLIDE_WIDTH));
      const height = round2(clamp(Math.max(120, safeRows * 42), MIN_SHAPE_SIZE, SLIDE_HEIGHT));
      const nextShape = createEditableShape({
        id: shapeId,
        type: "table",
        width,
        height,
        position,
        rawNode: {
          border: {
            "@_color": "rgba(31, 35, 41, 0.25)",
            "@_width": 1,
          },
        },
        contentNode: buildTableContentNode(tableModel),
        zIndex: getNextZIndex(state.shapes),
      });

      return {
        shapes: [...state.shapes, nextShape],
        selectedShapeId: nextShape.id,
        editingShapeId: nextShape.id,
      };
    });
  },
  setSnapGuides: (guides) => {
    set(() => ({ snapGuides: guides }));
  },
  clearSnapGuides: () => {
    set(() => ({ snapGuides: { vertical: null, horizontal: null } }));
  },
  bringToFront: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      return {
        shapes: reorderZIndex(state.shapes, state.selectedShapeId, "front"),
      };
    });
  },
  sendToBack: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      return {
        shapes: reorderZIndex(state.shapes, state.selectedShapeId, "back"),
      };
    });
  },
  captureHistorySnapshot: () => {
    set((state) => ({
      historyPast: [...state.historyPast, toHistorySnapshot(state)].slice(-HISTORY_LIMIT),
      historyFuture: [],
    }));
  },
  undo: () => {
    set((state) => {
      if (state.historyPast.length === 0) {
        return state;
      }

      const previousSnapshot = state.historyPast[state.historyPast.length - 1];
      return {
        shapes: previousSnapshot.shapes,
        selectedShapeId: previousSnapshot.selectedShapeId,
        editingShapeId: previousSnapshot.editingShapeId,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [toHistorySnapshot(state), ...state.historyFuture].slice(0, HISTORY_LIMIT),
      };
    });
  },
  redo: () => {
    set((state) => {
      if (state.historyFuture.length === 0) {
        return state;
      }

      const [nextSnapshot, ...restFuture] = state.historyFuture;
      return {
        shapes: nextSnapshot.shapes,
        selectedShapeId: nextSnapshot.selectedShapeId,
        editingShapeId: nextSnapshot.editingShapeId,
        historyPast: [...state.historyPast, toHistorySnapshot(state)].slice(-HISTORY_LIMIT),
        historyFuture: restFuture,
      };
    });
  },
  buildSlideDocumentModel: () => {
    const state = get();
    if (!state.currentSlideMeta) {
      return null;
    }

    const orderedShapes = [...state.shapes]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((shape) => ({
        attributes: shape.attributes,
        style: shape.style,
        rawNode: shape.rawNode,
      }));

    return {
      slideId: state.currentSlideMeta.slideId,
      rawSlideNode: state.currentSlideMeta.rawSlideNode,
      shapes: orderedShapes,
    };
  },
}));

export type { EditableSlideShape };
