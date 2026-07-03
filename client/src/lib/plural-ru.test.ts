import { describe, expect, it } from "vitest";

import { pluralRu } from "./plural-ru";

describe("pluralRu", () => {
  it("uses one form for counts ending in one except teen counts", () => {
    expect(pluralRu(1, "список", "списка", "списков")).toBe("список");
    expect(pluralRu(21, "карточка", "карточки", "карточек")).toBe("карточка");
    expect(pluralRu(111, "участник", "участника", "участников")).toBe("участников");
  });

  it("uses few form for counts ending in two through four except teen counts", () => {
    expect(pluralRu(2, "список", "списка", "списков")).toBe("списка");
    expect(pluralRu(4, "карточка", "карточки", "карточек")).toBe("карточки");
    expect(pluralRu(24, "участник", "участника", "участников")).toBe("участника");
    expect(pluralRu(12, "метка", "метки", "меток")).toBe("меток");
  });

  it("uses many form for zero, five through twenty, and negatives", () => {
    expect(pluralRu(0, "список", "списка", "списков")).toBe("списков");
    expect(pluralRu(5, "карточка", "карточки", "карточек")).toBe("карточек");
    expect(pluralRu(19, "участник", "участника", "участников")).toBe("участников");
    expect(pluralRu(-2, "метка", "метки", "меток")).toBe("метки");
  });
});
