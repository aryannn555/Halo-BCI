import { describe, it, expect } from "vitest";
import {
  buildBalancedBinaryTree,
  getAllLeaves,
  findLeaf,
  buildKeyboardTree,
  buildCommandTree,
  HuffmanItem,
} from "./huffman";
import { getCharacterWeights } from "./language_model";

describe("Huffman Tree Builder", () => {
  it("builds a binary tree where all input leaves are reachable", () => {
    const items: HuffmanItem[] = [
      { id: "A", label: "A", weight: 8.0, type: "char" },
      { id: "B", label: "B", weight: 1.5, type: "char" },
      { id: "C", label: "C", weight: 3.0, type: "char" },
      { id: "D", label: "D", weight: 4.0, type: "char" },
      { id: "E", label: "E", weight: 12.0, type: "char" },
    ];

    const tree = buildBalancedBinaryTree(items);
    const leaves = getAllLeaves(tree);

    expect(leaves.length).toBe(items.length);

    items.forEach((item) => {
      const found = findLeaf(tree, item.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(item.id);
      expect(found?.path.length).toBe(found?.depth);
    });
  });

  it("assigns shallower depths to higher weight items", () => {
    const items: HuffmanItem[] = [
      { id: "FREQUENT", label: "Frequent Word", weight: 100.0, type: "suggestion" },
      { id: "COMMON", label: "Common", weight: 40.0, type: "char" },
      { id: "MEDIUM", label: "Medium", weight: 10.0, type: "char" },
      { id: "RARE_1", label: "Rare 1", weight: 1.0, type: "char" },
      { id: "RARE_2", label: "Rare 2", weight: 1.0, type: "char" },
      { id: "RARE_3", label: "Rare 3", weight: 0.5, type: "char" },
      { id: "RARE_4", label: "Rare 4", weight: 0.2, type: "char" },
    ];

    const tree = buildBalancedBinaryTree(items);

    const frequentLeaf = findLeaf(tree, "FREQUENT");
    const rareLeaf = findLeaf(tree, "RARE_4");

    expect(frequentLeaf).not.toBeNull();
    expect(rareLeaf).not.toBeNull();

    // High probability item should require fewer binary decisions than rare item
    expect(frequentLeaf!.depth).toBeLessThan(rareLeaf!.depth);
    expect(frequentLeaf!.depth).toBeLessThanOrEqual(2);
  });

  it("constructs full assistive keyboard tree with all 26 letters, space, backspace, period, and suggestions", () => {
    const suggestions = ["HELLO", "HELP", "HELMET"];
    const weights = getCharacterWeights("HEL");
    const tree = buildKeyboardTree("HEL", suggestions, weights);

    const leaves = getAllLeaves(tree);

    // 26 letters + 3 suggestions + space + backspace + period = 32 leaves
    expect(leaves.length).toBe(32);

    // Verify all keys reachable
    for (let c = 65; c <= 90; c++) {
      const ch = String.fromCharCode(c);
      expect(findLeaf(tree, ch)).not.toBeNull();
    }
    expect(findLeaf(tree, "SPACE")).not.toBeNull();
    expect(findLeaf(tree, "BACKSPACE")).not.toBeNull();
    expect(findLeaf(tree, ".")).not.toBeNull();
    suggestions.forEach((s) => {
      expect(findLeaf(tree, `SUGG_${s}`)).not.toBeNull();
    });

    // Top suggestion should be shallow
    const topSugg = findLeaf(tree, `SUGG_${suggestions[0]}`);
    const obscureChar = findLeaf(tree, "Z");
    expect(topSugg!.depth).toBeLessThan(obscureChar!.depth);
  });

  it("constructs caregiver command board where every command takes at most 3 decisions", () => {
    const commands = ["Yes", "No", "Water", "Help", "Lights", "Call family", "Pain", "Done"];
    const tree = buildCommandTree(commands);

    const leaves = getAllLeaves(tree);
    expect(leaves.length).toBe(8);

    leaves.forEach((leaf) => {
      // 8 items in a balanced binary tree have depths of exactly 3
      expect(leaf.depth).toBeLessThanOrEqual(3);
    });
  });
});
