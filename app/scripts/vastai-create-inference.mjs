#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  console.log("Searching for compatible GPUs (24GB+, no Blackwell)...\n");

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
      gpu_ram: { gte: 24000 },
      dph_total: { lte: 1.50 },
      disk_space: { gte: 50 },
      reliability2: { gte: 0.95 }
    })
  }).then(r => r.json());

  // Filter out China, Blackwell (5090/5080), and old Pascal GPUs
  const blackwell = ['5090', '5080', 'B200', 'B100'];
  const tooOld = ['P40', 'P100', 'V100'];

  const offers = (result.offers || [])
    .filter(o => {
      const geo = o.geolocation || '';
      const gpu = o.gpu_name || '';
      if (geo.includes('CN')) return false;
      for (const b of blackwell) { if (gpu.includes(b)) return false; }
      for (const t of tooOld) { if (gpu.includes(t)) return false; }
      return true;
    })
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log(`Found ${offers.length} compatible offers:\n`);
  offers.slice(0, 20).forEach((o, i) => {
    const vram = Math.round(o.gpu_ram / 1024);
    const dl = o.inet_down ? o.inet_down.toFixed(0) : '?';
    const rel = (o.reliability2 * 100).toFixed(1);
    console.log(`  ${String(i + 1).padStart(2)}. ${o.gpu_name.padEnd(20)} ${vram}GB | $${o.dph_total.toFixed(3)}/hr | ${(o.geolocation || '?').padEnd(22)} | DL:${dl}Mbps | rel:${rel}% | id:${o.id}`);
  });

  if (offers.length === 0) {
    console.log("No offers found.");
    return;
  }

  // Prefer 4090 > A100 > L40S > A6000 > 3090
  const preferred = ['RTX 4090', 'A100', 'L40S', 'A6000', 'RTX 3090'];
  let pick = null;
  for (const pref of preferred) {
    pick = offers.find(o => o.gpu_name.includes(pref));
    if (pick) break;
  }
  if (!pick) pick = offers[0];

  console.log(`\nSelected: ${pick.gpu_name} @ $${pick.dph_total.toFixed(3)}/hr — ${pick.geolocation} (id: ${pick.id})`);
  console.log("Creating instance...");

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

  if (!createResult.success) {
    console.log("Failed:", JSON.stringify(createResult));
    return;
  }

  const contractId = createResult.new_contract;
  console.log(`Instance created: ${contractId}`);
  console.log("Waiting for instance to be ready...");

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const instData = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
      headers: { "Authorization": "Bearer " + VAST_API_KEY }
    }).then(r => r.json());

    const inst = (instData.instances || []).find(x => x.id === contractId);
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
  console.log("\nTimeout — check manually.");
}

main().catch(console.error);
