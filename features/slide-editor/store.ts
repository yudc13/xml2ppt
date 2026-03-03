import { create } from "zustand";

import { buildShapeContentHtml } from "@/lib/slide-xml/rich-text";
import type { ShapeAttributes, ShapeStyle, SlideDocumentModel, XmlNode } from "@/lib/slide-xml/types";

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;
const MIN_SHAPE_SIZE = 12;

type EditableSlideShape = {
  id: string;
  attributes: ShapeAttributes;
  style: ShapeStyle;
  rawNode: XmlNode;
  contentHtml: string;
  zIndex: number;
};

type SlideEditorState = {
  currentSlideIndex: number | null;
  shapes: EditableSlideShape[];
  selectedShapeId: string | null;
  editingShapeId: string | null;
  initializeSlide: (slideIndex: number, model: SlideDocumentModel) => void;
  selectShape: (shapeId: string | null) => void;
  setEditingShape: (shapeId: string | null) => void;
  updateShapePosition: (shapeId: string, topLeftX: number, topLeftY: number) => void;
  updateShapeSize: (shapeId: string, width: number, height: number) => void;
  updateShapeContentHtml: (shapeId: string, contentHtml: string) => void;
  bringToFront: () => void;
  sendToBack: () => void;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

export const useSlideEditorStore = create<SlideEditorState>((set) => ({
  currentSlideIndex: null,
  shapes: [],
  selectedShapeId: null,
  editingShapeId: null,
  initializeSlide: (slideIndex, model) => {
    set((state) => {
      if (state.currentSlideIndex === slideIndex) {
        return state;
      }

      return {
        currentSlideIndex: slideIndex,
        selectedShapeId: null,
        editingShapeId: null,
        shapes: model.shapes.map((shape, index) => ({
          id: shape.attributes.id,
          attributes: normalizeShapeAttributes(shape.attributes),
          style: shape.style,
          rawNode: shape.rawNode,
          contentHtml: shape.rawNode.content ? buildShapeContentHtml(shape.rawNode.content) : "",
          zIndex: index,
        })),
      };
    });
  },
  selectShape: (shapeId) => {
    set(() => ({ selectedShapeId: shapeId }));
  },
  setEditingShape: (shapeId) => {
    set(() => ({ editingShapeId: shapeId }));
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
        const maxWidth = SLIDE_WIDTH - shape.attributes.topLeftX;
        const maxHeight = SLIDE_HEIGHT - shape.attributes.topLeftY;

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
  updateShapeContentHtml: (shapeId, contentHtml) => {
    set((state) => ({
      shapes: updateShape(state.shapes, shapeId, (shape) => ({
        ...shape,
        contentHtml,
      })),
    }));
  },
  bringToFront: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      const currentMax = Math.max(...state.shapes.map((shape) => shape.zIndex), 0);
      return {
        shapes: updateShape(state.shapes, state.selectedShapeId, (shape) => ({
          ...shape,
          zIndex: currentMax + 1,
        })),
      };
    });
  },
  sendToBack: () => {
    set((state) => {
      if (!state.selectedShapeId) {
        return state;
      }

      const currentMin = Math.min(...state.shapes.map((shape) => shape.zIndex), 0);
      return {
        shapes: updateShape(state.shapes, state.selectedShapeId, (shape) => ({
          ...shape,
          zIndex: currentMin - 1,
        })),
      };
    });
  },
}));

export type { EditableSlideShape };
