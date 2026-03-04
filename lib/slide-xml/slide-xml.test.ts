import { describe, expect, test } from "bun:test";

import { slides } from "@/mock/slides";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { serializeSlideDocument } from "@/lib/slide-xml/serializer";
import type { SlideDocumentModel, XmlNode, XmlValue } from "@/lib/slide-xml/types";

describe("slide xml data transformation", () => {
  test("parses shape numeric attributes as numbers", () => {
    const model = parseSlideXml(slides[0]);
    const shape = model.shapes[0];

    expect(typeof shape.attributes.topLeftX).toBe("number");
    expect(typeof shape.attributes.topLeftY).toBe("number");
    expect(typeof shape.attributes.width).toBe("number");
    expect(typeof shape.attributes.height).toBe("number");
    expect(typeof shape.attributes.rotation).toBe("number");
  });

  test("maps round-rect to borderRadius style", () => {
    const model = parseSlideXml(slides[1]);
    const roundRect = model.shapes.find((shape) => shape.attributes.type === "round-rect");

    expect(roundRect?.style.borderRadius).toBe("calc(var(--slide-unit) * 8)");
  });

  test("keeps p/span nesting after serialization", () => {
    const model = parseSlideXml(slides[0]);
    const xml = serializeSlideDocument(model);

    expect(xml).toContain("<p><strong><span");
    expect(xml).toContain("</span></strong></p>");
  });

  test("keeps new shape types after serialize -> parse roundtrip", () => {
    const model: SlideDocumentModel = {
      slideId: "roundtrip-slide",
      rawSlideNode: {
        "@_id": "roundtrip-slide",
        data: {},
      },
      shapes: [
        {
          attributes: {
            id: "shape-ellipse",
            type: "ellipse",
            width: 180,
            height: 180,
            topLeftX: 100,
            topLeftY: 60,
            rotation: 0,
          },
          style: { borderRadius: "9999px" },
          rawNode: {
            "@_id": "shape-ellipse",
            "@_type": "ellipse",
            "@_width": 180,
            "@_height": 180,
            "@_topLeftX": 100,
            "@_topLeftY": 60,
          },
        },
        {
          attributes: {
            id: "shape-arrow",
            type: "arrow",
            width: 300,
            height: 8,
            topLeftX: 220,
            topLeftY: 200,
            rotation: 0,
          },
          style: {},
          rawNode: {
            "@_id": "shape-arrow",
            "@_type": "arrow",
            "@_width": 300,
            "@_height": 8,
            "@_topLeftX": 220,
            "@_topLeftY": 200,
          },
        },
      ],
    };

    const xml = serializeSlideDocument(model);
    const parsed = parseSlideXml(xml);
    const types = parsed.shapes.map((shape) => shape.attributes.type);

    expect(types).toContain("ellipse");
    expect(types).toContain("arrow");
  });

  test("keeps table cell text after serialize -> parse roundtrip", () => {
    const tableContent: XmlNode = {
      table: {
        row: [
          {
            "@_id": "row-1",
            cell: [
              { "@_id": "cell-1-1", "#text": "A1" },
              { "@_id": "cell-1-2", "#text": "B1" },
            ],
          },
          {
            "@_id": "row-2",
            cell: [
              { "@_id": "cell-2-1", "#text": "A2" },
              { "@_id": "cell-2-2", "#text": "B2" },
            ],
          },
        ],
      },
    };

    const model: SlideDocumentModel = {
      slideId: "table-slide",
      rawSlideNode: {
        "@_id": "table-slide",
        data: {},
      },
      shapes: [
        {
          attributes: {
            id: "shape-table",
            type: "table",
            width: 420,
            height: 176,
            topLeftX: 120,
            topLeftY: 100,
            rotation: 0,
          },
          style: {},
          rawNode: {
            "@_id": "shape-table",
            "@_type": "table",
            "@_width": 420,
            "@_height": 176,
            "@_topLeftX": 120,
            "@_topLeftY": 100,
            content: tableContent,
          },
        },
      ],
    };

    const xml = serializeSlideDocument(model);
    const parsed = parseSlideXml(xml);
    const tableShape = parsed.shapes.find((shape) => shape.attributes.type === "table");
    const content = tableShape?.rawNode.content as XmlNode | undefined;
    const table = content?.table as XmlNode | undefined;
    const rows = table?.row as XmlValue[] | XmlNode | undefined;
    const rowList = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const firstRow = rowList[0] as XmlNode | undefined;
    const firstRowCells = firstRow?.cell as XmlNode[] | XmlNode | undefined;
    const firstCell = Array.isArray(firstRowCells) ? firstRowCells[0] : firstRowCells;

    expect(firstCell?.["#text"]).toBe("A1");
  });
});
