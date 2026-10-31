/**
 * Weight-Balanced Binary Selection Tree (Huffman-Style) for Assistive BCI.
 * 
 * Partitions items based on language-model probability weights so that frequent
 * next characters and high-confidence word suggestions require minimal binary decisions.
 */

export interface HuffmanItem {
  id: string;
  label: string;
  weight: number;
  type: "char" | "space" | "backspace" | "period" | "suggestion" | "command";
}

export type HuffmanNode = HuffmanBranch | HuffmanLeaf;

export interface HuffmanLeaf {
  isLeaf: true;
  id: string;
  label: string;
  weight: number;
  type: "char" | "space" | "backspace" | "period" | "suggestion" | "command";
  depth: number;
  path: ("left" | "right")[];
}

export interface HuffmanBranch {
  isLeaf: false;
  weight: number;
  depth: number;
  path: ("left" | "right")[];
  left: HuffmanNode;
  right: HuffmanNode;
  leftIds: string[];
  rightIds: string[];
  allLeaves: HuffmanLeaf[];
}

/**
 * Builds a weight-balanced binary tree where higher weight items get shallower leaf depths.
 */
export function buildBalancedBinaryTree(
  items: HuffmanItem[],
  depth = 0,
  path: ("left" | "right")[] = []
): HuffmanNode {
  if (items.length === 0) {
    throw new Error("Cannot build binary tree from empty items list.");
  }

  if (items.length === 1) {
    const item = items[0];
    return {
      isLeaf: true,
      id: item.id,
      label: item.label,
      weight: item.weight,
      type: item.type,
      depth,
      path,
    };
  }

  // Sort items descending by weight for optimal shallow allocation of high probabilities
  const sorted = [...items].sort((a, b) => b.weight - a.weight);

  // Find split point that minimizes absolute weight difference between left and right
  const totalWeight = sorted.reduce((sum, it) => sum + it.weight, 0);
  let bestSplit = 1;
  let minDiff = Infinity;
  let runningWeight = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    runningWeight += sorted[i].weight;
    const remainingWeight = totalWeight - runningWeight;
    const diff = Math.abs(runningWeight - remainingWeight);

    if (diff < minDiff) {
      minDiff = diff;
      bestSplit = i + 1;
    }
  }

  const leftItems = sorted.slice(0, bestSplit);
  const rightItems = sorted.slice(bestSplit);

  const leftNode = buildBalancedBinaryTree(leftItems, depth + 1, [...path, "left"]);
  const rightNode = buildBalancedBinaryTree(rightItems, depth + 1, [...path, "right"]);

  const leftLeaves = getAllLeaves(leftNode);
  const rightLeaves = getAllLeaves(rightNode);

  return {
    isLeaf: false,
    weight: totalWeight,
    depth,
    path,
    left: leftNode,
    right: rightNode,
    leftIds: leftLeaves.map((l) => l.id),
    rightIds: rightLeaves.map((l) => l.id),
    allLeaves: [...leftLeaves, ...rightLeaves],
  };
}

/**
 * Recursively collects all leaves under a node.
 */
export function getAllLeaves(node: HuffmanNode): HuffmanLeaf[] {
  if (node.isLeaf) return [node];
  return [...getAllLeaves(node.left), ...getAllLeaves(node.right)];
}

/**
 * Finds a leaf by its ID in the tree.
 */
export function findLeaf(node: HuffmanNode, id: string): HuffmanLeaf | null {
  if (node.isLeaf) {
    return node.id === id ? node : null;
  }
  return findLeaf(node.left, id) || findLeaf(node.right, id);
}

/**
 * Builds the binary selection tree for the assistive keyboard.
 * Includes A-Z, space, backspace, period, and 3 suggested words.
 */
export function buildKeyboardTree(
  currentText: string,
  suggestions: string[],
  charWeights: Record<string, number>
): HuffmanNode {
  const items: HuffmanItem[] = [];

  // 1. Suggestions (high weight so they land in 1-2 decisions)
  suggestions.forEach((word, idx) => {
    items.push({
      id: `SUGG_${word}`,
      label: word,
      weight: 22.0 - idx * 4.0, // e.g. 22, 18, 14
      type: "suggestion",
    });
  });

  // 2. Backspace
  items.push({
    id: "BACKSPACE",
    label: "⌫",
    weight: currentText.length > 0 ? 12.0 : 1.0,
    type: "backspace",
  });

  // 3. Space
  items.push({
    id: "SPACE",
    label: "␣",
    weight: charWeights[" "] ?? 10.0,
    type: "space",
  });

  // 4. Period
  items.push({
    id: ".",
    label: ".",
    weight: charWeights["."] ?? 3.0,
    type: "period",
  });

  // 5. Letters A-Z
  for (let c = 65; c <= 90; c++) {
    const ch = String.fromCharCode(c);
    items.push({
      id: ch,
      label: ch,
      weight: charWeights[ch] ?? 2.0,
      type: "char",
    });
  }

  return buildBalancedBinaryTree(items);
}

/**
 * Builds a balanced 3-decision binary tree for the 8 caregiver commands.
 */
export function buildCommandTree(commands: string[]): HuffmanNode {
  const items: HuffmanItem[] = commands.map((cmd) => ({
    id: cmd,
    label: cmd,
    weight: 10.0, // Equal prior probability
    type: "command",
  }));

  return buildBalancedBinaryTree(items);
}
