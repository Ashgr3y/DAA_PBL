# Knapsack Algorithm Lab

Open `index.html` in any modern browser. No install, server, or internet connection is needed.

Use **Load demo** for a ready-made dataset, or enter a capacity and items. **Run both algorithms** executes separate exact 0/1 Knapsack implementations:

- Backtracking: depth-first take/skip search with overweight pruning.
- Branch & Bound: best-first search with a fractional-knapsack upper bound.

The page reports the optimum, selected items, search nodes, pruned nodes, and measured runtime, then verifies that both answers agree. It deliberately does not use dynamic programming.
