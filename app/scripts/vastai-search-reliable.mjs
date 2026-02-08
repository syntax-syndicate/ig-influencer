#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  console.log("Searching for reliable GPUs (24GB+, 98%+ reliability, fast download)...\n");

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
      dph_total: { lte: 0.50 },
      disk_space: { gte: 50 },
      reliability2: { gte: 0.98 },
      inet_down: { gte: 200 }
    })
  }).then(r => r.json());

  const offers = (result.offers || [])
    .filter(o => {
      const geo = o.geolocation || '';
      return !geo.includes('CN');
    })
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log(`Found ${offers.length} offers:\n`);
  offers.slice(0, 15).forEach((o, i) => {
    const vram = Math.round(o.gpu_ram / 1024);
    const dl = o.inet_down ? o.inet_down.toFixed(0) : '?';
    const rel = (o.reliability2 * 100).toFixed(1);
    console.log(`  ${String(i+1).padStart(2)}. ${o.gpu_name.padEnd(20)} ${vram}GB | $${o.dph_total.toFixed(3)}/hr | ${(o.geolocation || '?').padEnd(20)} | rel:${rel}% | DL:${dl}Mbps | id:${o.id}`);
  });

  if (offers.length > 0) {
    // Pick first US-based offer, or cheapest
    const usOffer = offers.find(o => (o.geolocation || '').includes('US'));
    const pick = usOffer || offers[0];
    console.log(`\nBest pick: ${pick.gpu_name} @ $${pick.dph_total.toFixed(3)}/hr — ${pick.geolocation} (id: ${pick.id})`);

    console.log("\nCreating instance...");
    const createResult = await fetch(`https://console.vast.ai/api/v0/asks/${pick.id}/`, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        image: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
        label: "elena-zit-inference",
        disk: 60,
        runtype: "ssh"
      })
    }).then(r => r.json());

    if (createResult.success) {
      const contractId = createResult.new_contract;
      console.log(`Instance created: ${contractId}`);

      // Wait for ready
      console.log("Waiting for instance to be ready...");
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const instances = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
          headers: { "Authorization": "Bearer " + VAST_API_KEY }
        }).then(r => r.json());

        const inst = (instances.instances || []).find(x => x.id === contractId);
        if (inst && inst.actual_status === 'running' && inst.ssh_host && inst.ssh_port) {
          console.log(`\nREADY!`);
          console.log(`  SSH: ssh -p ${inst.ssh_port} root@${inst.ssh_host}`);
          console.log(`  GPU: ${inst.gpu_name}`);
          console.log(`  IP: ${inst.public_ipaddr || 'N/A'}`);
          console.log(`  Price: $${inst.dph_total?.toFixed(3)}/hr`);
          return;
        }
        process.stdout.write('.');
      }
      console.log("\nTimeout — check manually with --status");
    } else {
      console.log("Failed:", JSON.stringify(createResult));
    }
  }
}

main().catch(console.error);
