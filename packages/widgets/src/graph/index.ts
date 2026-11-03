// The board graph's library chunk `board-graph` (molecules, design decision 13): the entry every
// widget that computes imports the board's graph through, by this file's path, which the view
// build maps to the chunk's one module instance, so that the WBS and the plan on a board read one
// live graph per draft update and one graph of the board as sent. Its modules are imported only
// through here, except as types.

export { type BoardGraph, liveGraph, sentGraph } from "./board-graph.ts";
