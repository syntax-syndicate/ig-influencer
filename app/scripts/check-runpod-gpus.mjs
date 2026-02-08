#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

const query = `
  query {
    gpuTypes {
      id
      displayName
      memoryInGb
      secureCloud
      communityCloud
      lowestPrice(input: { gpuCount: 1 }) {
        minimumBidPrice
        uninterruptablePrice
      }
    }
  }
`;

const response = await fetch('https://api.runpod.io/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${RUNPOD_API_KEY}`
  },
  body: JSON.stringify({ query })
});

const result = await response.json();
const gpus = result.data?.gpuTypes?.filter(g =>
  g.lowestPrice?.uninterruptablePrice &&
  g.memoryInGb >= 24
) || [];

gpus.sort((a, b) => a.lowestPrice.uninterruptablePrice - b.lowestPrice.uninterruptablePrice);

console.log('Available GPUs with 24GB+ VRAM:\n');
for (const gpu of gpus.slice(0, 15)) {
  console.log(`${gpu.id} - ${gpu.displayName} (${gpu.memoryInGb}GB) - $${gpu.lowestPrice.uninterruptablePrice}/hr`);
}
