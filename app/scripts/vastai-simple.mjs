#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  // Destroy stuck instances
  console.log("Cleaning up stuck instances...");
  const instances = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
    headers: { "Authorization": "Bearer " + VAST_API_KEY }
  }).then(r => r.json());

  for (const inst of (instances.instances || [])) {
    if (inst.actual_status === 'loading' || inst.actual_status === 'running') {
      console.log(`  Destroying ${inst.id} (${inst.actual_status})...`);
      await fetch(`https://console.vast.ai/api/v0/instances/${inst.id}/`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + VAST_API_KEY }
      });
    }
  }
  console.log("Done cleanup.\n");

  // Search with simpler image (pytorch official)
  console.log("Searching for GPU offers...");
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
      gpu_ram: { gte: 24000 },
      dph_total: { lte: 0.25 },
      disk_space: { gte: 60 },
      reliability2: { gte: 0.98 }
    })
  }).then(r => r.json());

  const offers = (result.offers || [])
    .filter(o => !o.geolocation?.includes("CN"))
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log(`Found ${offers.length} offers:`);
  offers.slice(0, 5).forEach((o, i) => {
    console.log(`  ${i+1}. ${o.gpu_name} @ $${o.dph_total.toFixed(3)}/hr - ${o.geolocation} (${(o.reliability2*100).toFixed(1)}%)`);
  });

  if (offers.length === 0) {
    console.log("No offers available!");
    return;
  }

  // Try a simpler base image
  const best = offers[0];
  console.log(`\nCreating instance with simpler image from offer ${best.id}...`);

  const createResult = await fetch(`https://console.vast.ai/api/v0/asks/${best.id}/`, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      image: "pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel",  // Simpler official PyTorch image
      label: "chroma-simple",
      disk: 80,
      runtype: "ssh"
    })
  }).then(r => r.json());

  if (createResult.success) {
    console.log(`✅ Created instance: ${createResult.new_contract}`);
    console.log("\nWaiting for instance to be ready...");

    // Wait and poll
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      process.stdout.write(".");

      const status = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
        headers: { "Authorization": "Bearer " + VAST_API_KEY }
      }).then(r => r.json());

      const inst = status.instances?.find(i => i.id === createResult.new_contract);
      if (inst?.actual_status === 'running' && inst.ssh_host && inst.ssh_port) {
        console.log(`\n\n✅ Instance ready!`);
        console.log(`  SSH: ssh -p ${inst.ssh_port} root@${inst.ssh_host}`);
        console.log(`  GPU: ${inst.gpu_name}`);
        console.log(`  Price: $${inst.dph_total?.toFixed(3)}/hr`);
        return;
      }
    }
    console.log("\n⚠️ Timeout waiting for instance.");
  } else {
    console.log("Failed:", JSON.stringify(createResult));
  }
}

main().catch(console.error);
