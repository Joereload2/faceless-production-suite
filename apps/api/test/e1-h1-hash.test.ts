import { describe, expect, it } from "vitest";
import { canonicalJson, inputHash } from "@faceless/schema/hash";

const FIXTURE = { b: 1, a: [2, { z: 3, y: 4 }] };

describe("E1-H1", () => {
  it("hash fixture", () => {
    expect(canonicalJson(FIXTURE)).toBe('{"a":[2,{"y":4,"z":3}],"b":1}');
    expect(inputHash(FIXTURE)).toBe(
      "d7bc8a2a1c87d959f7699542056ae658f1b5fd120b835f51e702fe095d609c72",
    );
  });
});
