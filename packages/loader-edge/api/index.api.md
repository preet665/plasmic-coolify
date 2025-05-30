## API Report File for "@plasmicapp/loader-edge"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { describeVariation } from '@plasmicapp/loader-splits';
import type { Split } from '@plasmicapp/loader-fetcher';

export { describeVariation }

// @public (undocumented)
export const generateAllPaths: (path: string, seedRange?: number) => string[];

// @public
export function generateAllPathsWithTraits(path: string, traitValues?: Record<string, string[]>, seedRange?: number): string[];

// @public (undocumented)
export const getActiveVariation: (opts: {
    splits: Split[];
    traits: Record<string, string | number | boolean>;
    path: string;
    enableUnseededExperiments?: boolean;
}) => Record<string, string>;

// @public (undocumented)
export const getMiddlewareResponse: (opts: {
    path: string;
    traits: Traits;
    cookies: Record<string, string>;
    seedRange?: number;
}) => {
    pathname: string;
    cookies: {
        key: string;
        value: string;
    }[];
};

// @public (undocumented)
export const rewriteWithoutTraits: (url: string) => {
    path: string;
    traits: {};
};

// @public (undocumented)
export const rewriteWithTraits: (path: string, traits: Traits) => string;

// (No @packageDocumentation comment for this package)

```
