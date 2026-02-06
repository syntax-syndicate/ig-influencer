#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  // Destroy any existing instances
  console.log("Cleaning up existing instances...");
  const instances = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
    headers: { "Authorization": "Bearer " + VAST_API_KEY }
  }).then(r => r.json());

  for (const inst of (instances.instances || [])) {
    console.log(`  Destroying ${inst.id} (${inst.gpu_name} - ${inst.actual_status})...`);
    await fetch(`https://console.vast.ai/api/v0/instances/${inst.id}/`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + VAST_API_KEY }
    });
  }

  // Search for FAST GPUs: H100, H200, A100 (40GB+ VRAM for speed)
  console.log("\nSearching for fast GPUs (H100/A100/L40S, 40GB+ VRAM)...");
  const result = await fetch("https://console.vast.ai/api/v0/bundles/", {
    method: "POST",
    headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: 100,
      type: "on-demand",
      verified: { eq: true },
      rentable: { eq: true },
      rented: { eq: false },
      num_gpus: { eq: 1 },
      gpu_ram: { gte: 40000 },
      dph_total: { lte: 4.00 },
      disk_space: { gte: 60 },
      reliability2: { gte: 0.95 }
    })
  }).then(r => r.json());

  const offers = (result.offers || [])
    .filter(o => {
      const geo = o.geolocation || '';
      if (geo.includes('CN')) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by GPU speed tier, then price
      const tier = (name) => {
        if (name.includes('H200')) return 0;
        if (name.includes('H100')) return 1;
        if (name.includes('A100') && name.includes('80')) return 2;
        if (name.includes('A100')) return 3;
        if (name.includes('L40S')) return 4;
        if (name.includes('L40')) return 5;
        if (name.includes('A6000')) return 6;
        if (name.includes('RTX 6000')) return 6;
        return 7;
      };
      const t = tier(a.gpu_name) - tier(b.gpu_name);
      if (t !== 0) return t;
      return a.dph_total - b.dph_total;
    });

  console.log(`Found ${offers.length} offers:\n`);
  offers.slice(0, 25).forEach((o, i) => {
    const dl = o.inet_down ? o.inet_down.toFixed(0) : '?';
    const rel = (o.reliability2 * 100).toFixed(1);
    console.log(`  ${String(i+1).padStart(2)}. ${o.gpu_name.padEnd(20)} ${String(o.gpu_ram).padStart(6)}MB VRAM | $${o.dph_total.toFixed(3)}/hr | ${o.geolocation?.padEnd(20)} | DL:${dl}Mbps | rel:${rel}% | id:${o.id}`);
  });

  // Also search 4090s (24GB but very fast for LoRA)
  console.log("\n\nAlso searching RTX 4090s (24GB, fast for LoRA)...");
  const result2 = await fetch("https://console.vast.ai/api/v0/bundles/", {
    method: "POST",
    headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: 50,
      type: "on-demand",
      verified: { eq: true },
      rentable: { eq: true },
      rented: { eq: false },
      num_gpus: { eq: 1 },
      gpu_name: { in: ["RTX_4090"] },
      dph_total: { lte: 0.60 },
      disk_space: { gte: 60 },
      reliability2: { gte: 0.95 },
      inet_down: { gte: 300 }
    })
  }).then(r => r.json());

  const offers2 = (result2.offers || [])
    .filter(o => {
      const geo = o.geolocation || '';
      return geo.includes('CN') === false;
    })
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log(`Found ${offers2.length} RTX 4090 offers:\n`);
  offers2.slice(0, 10).forEach((o, i) => {
    const dl = o.inet_down ? o.inet_down.toFixed(0) : '?';
    const rel = (o.reliability2 * 100).toFixed(1);
    console.log(`  ${String(i+1).padStart(2)}. ${o.gpu_name.padEnd(20)} ${String(o.gpu_ram).padStart(6)}MB VRAM | $${o.dph_total.toFixed(3)}/hr | ${o.geolocation?.padEnd(20)} | DL:${dl}Mbps | rel:${rel}% | id:${o.id}`);
  });
}

main().catch(console.error);
