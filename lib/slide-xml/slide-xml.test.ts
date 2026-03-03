import { describe, expect, test } from "bun:test";

import { slides } from "@/mock/slides";
import { parseSlideXml } from "@/lib/slide-xml/parser";
import { serializeSlideDocument } from "@/lib/slide-xml/serializer";

describe("slide xml data transformation", () => {
  test("parses shape numeric attributes as numbers", () => {
    const model = parseSlideXml(slides[0]);
    const shape = model.shapes[0];

    expect(typeof shape.attributes.topLeftX).toBe("number");
    expect(typeof shape.attributes.topLeftY).toBe("number");
    expect(typeof shape.attributes.width).toBe("number");
    expect(typeof shape.attributes.height).toBe("number");
  });

  test("maps round-rect to borderRadius style", () => {
    const model = parseSlideXml(slides[1]);
    const roundRect = model.shapes.find((shape) => shape.attributes.type === "round-rect");

    expect(roundRect?.style.borderRadius).toBe("8px");
  });

  test("keeps p/span nesting after serialization", () => {
    const model = parseSlideXml(slides[0]);
    const xml = serializeSlideDocument(model);

    expect(xml).toContain("<p><strong><span");
    expect(xml).toContain("</span></strong></p>");
  });
});
