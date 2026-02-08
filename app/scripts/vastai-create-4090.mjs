#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  // Destroy current instance
  console.log("Destroying instance 31004973...");
  await fetch("https://console.vast.ai/api/v0/instances/31004973/", {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + VAST_API_KEY }
  });
  console.log("Destroyed.");

  // Search for RTX 4090 offers
  console.log("\nSearching for RTX 4090 offers...");
  const result = await fetch("https://console.vast.ai/api/v0/bundles/", {
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
      dph_total: { lte: 0.40 },
      disk_space: { gte: 60 },
      reliability2: { gte: 0.95 }
    })
  }).then(r => r.json());

  const offers = (result.offers || [])
    .filter(o => !o.geolocation?.includes("CN"))
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log("Found " + offers.length + " RTX 4090 offers:");
  offers.slice(0, 5).forEach((o, i) => {
    console.log(`  ${i+1}. RTX 4090 @ $${o.dph_total.toFixed(3)}/hr - ${o.geolocation} (${(o.reliability2*100).toFixed(1)}%)`);
  });

  if (offers.length > 0) {
    const best = offers[0];
    console.log(`\nCreating instance from offer ${best.id}...`);
    const createResult = await fetch(`https://console.vast.ai/api/v0/asks/${best.id}/`, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        image: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
        label: "chroma-4090",
        disk: 80,
        runtype: "ssh"
      })
    }).then(r => r.json());

    if (createResult.success) {
      console.log("Created instance: " + createResult.new_contract);
    } else {
      console.log("Failed:", JSON.stringify(createResult));
    }
  } else {
    console.log("\nNo RTX 4090 available.");
  }
}

main().catch(console.error);
