#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const supportedAttributes = new Set(['resource-id', 'text']);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findNodeCenter(xml, attribute, value) {
  if (!supportedAttributes.has(attribute)) {
    throw new Error(`Unsupported Android UI attribute: ${attribute}`);
  }

  const escapedValue = escapeRegExp(value);
  const element = xml.match(new RegExp(`<node\\b(?=[^>]*\\b${attribute}="${escapedValue}")[^>]*>`));
  const bounds = element?.[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);

  if (!bounds) {
    return null;
  }

  return {
    x: Math.round((Number(bounds[1]) + Number(bounds[3])) / 2),
    y: Math.round((Number(bounds[2]) + Number(bounds[4])) / 2),
  };
}

function main() {
  const [, , xmlPath, attribute, value] = process.argv;
  if (!xmlPath || !attribute || value === undefined) {
    throw new Error('Usage: scripts/android-ui-bounds.mjs <xml-path> <text|resource-id> <value>');
  }

  const center = findNodeCenter(readFileSync(xmlPath, 'utf8'), attribute, value);
  if (center) {
    process.stdout.write(`${center.x} ${center.y}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
