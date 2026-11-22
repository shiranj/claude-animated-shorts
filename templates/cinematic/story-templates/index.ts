import { informative } from "./informative";
import { historical } from "./historical";
import { suspense } from "./suspense";
import { emotional } from "./emotional";
import { dialogue } from "./dialogue";
import { explainer } from "./explainer";
import type { Options, StorySpec } from "./spec";

/** All story templates. Each one is a function `(options) => StorySpec`: pure data, no React. */
export const TEMPLATES: Record<string, (o?: Partial<Options>) => StorySpec> = { informative, historical, suspense, emotional, dialogue, explainer };
export { informative, historical, suspense, emotional, dialogue, explainer };
export { toCheckData, pointTargets, DEFAULTS } from "./spec";
export type { StorySpec, Options } from "./spec";
