import { Edge, Family, PathStep, TreeData } from "./types";

/**
 * Build a bidirectional adjacency map from family records.
 * - husband <-> wife: 'spouse'
 * - parent -> child: 'parent' (the source is the parent OF the target)
 * - child -> parent: 'child'  (the source is the child OF the target)
 */
export function buildAdjacency(families: Family[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();

  const add = (from: string, to: string, label: Edge["label"]) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ to, label });
  };

  for (const fam of families) {
    const parents = [fam.husbandId, fam.wifeId].filter(
      (p): p is string => !!p
    );

    // Spouse edges (both directions).
    if (fam.husbandId && fam.wifeId) {
      add(fam.husbandId, fam.wifeId, "spouse");
      add(fam.wifeId, fam.husbandId, "spouse");
    }

    // Parent/child edges.
    for (const childId of fam.childIds) {
      for (const parentId of parents) {
        add(parentId, childId, "parent");
        add(childId, parentId, "child");
      }
    }
  }

  return adj;
}

/**
 * Breadth-first search for the shortest relationship path between two people.
 * Returns an ordered list of steps where `relationToNext` describes how each
 * person relates to the following person, or `null` if no path exists.
 */
export function findPath(
  fromId: string,
  toId: string,
  treeData: TreeData
): PathStep[] | null {
  if (!treeData.individuals[fromId] || !treeData.individuals[toId]) return null;
  if (fromId === toId) return [{ individualId: fromId, relationToNext: null }];

  const adj = buildAdjacency(Object.values(treeData.families));
  const MAX_DEPTH = 20;

  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  // Map child -> { parent, label } to reconstruct the path.
  const cameFrom = new Map<string, { prev: string; label: Edge["label"] }>();
  const depth = new Map<string, number>([[fromId, 0]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if ((depth.get(current) ?? 0) >= MAX_DEPTH) continue;

    for (const edge of adj.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      cameFrom.set(edge.to, { prev: current, label: edge.label });
      depth.set(edge.to, (depth.get(current) ?? 0) + 1);

      if (edge.to === toId) {
        return reconstruct(fromId, toId, cameFrom);
      }
      queue.push(edge.to);
    }
  }

  return null;
}

function reconstruct(
  fromId: string,
  toId: string,
  cameFrom: Map<string, { prev: string; label: Edge["label"] }>
): PathStep[] {
  // Walk backwards collecting (node, labelIntoNode).
  const reverse: { id: string; label: Edge["label"] }[] = [];
  let node = toId;
  while (node !== fromId) {
    const info = cameFrom.get(node)!;
    reverse.push({ id: node, label: info.label });
    node = info.prev;
  }
  reverse.push({ id: fromId, label: "spouse" /* placeholder, unused */ });
  reverse.reverse();

  // Now reverse[i].label was the edge label from reverse[i-1] -> reverse[i].
  // Convert into PathStep where relationToNext lives on the source node.
  const steps: PathStep[] = [];
  for (let i = 0; i < reverse.length; i++) {
    const relationToNext =
      i < reverse.length - 1 ? reverse[i + 1].label : null;
    steps.push({ individualId: reverse[i].id, relationToNext });
  }
  return steps;
}
