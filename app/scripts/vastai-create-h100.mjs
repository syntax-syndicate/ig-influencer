#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;
const OFFER_ID = process.argv[2] || '26679144'; // H100 SXM France $1.469/hr

async function main() {
  console.log(`Creating H100 SXM instance from offer ${OFFER_ID}...`);

  const createResult = await fetch(`https://console.vast.ai/api/v0/asks/${OFFER_ID}/`, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      image: "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel",
      label: "elena-lora-h100",
      disk: 80,
      runtype: "ssh"
    })
  }).then(r => r.json());

  if (createResult.success) {
    console.log(`Created instance: ${createResult.new_contract}`);
    console.log("\nWaiting for instance to be ready...");

    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 5000));
      process.stdout.write(".");

      const status = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
        headers: { "Authorization": "Bearer " + VAST_API_KEY }
      }).then(r => r.json());

      const inst = status.instances?.find(x => x.id === createResult.new_contract);
      if (inst?.actual_status === 'running' && inst.ssh_host && inst.ssh_port) {
        console.log(`\n\nInstance ready!`);
        console.log(`  SSH: ssh -p ${inst.ssh_port} root@${inst.ssh_host}`);
        console.log(`  GPU: ${inst.gpu_name} (${inst.gpu_ram}MB VRAM)`);
        console.log(`  Price: $${inst.dph_total?.toFixed(3)}/hr`);
        console.log(`  Instance ID: ${inst.id}`);
        return;
      }
    }
    console.log("\nTimeout waiting for instance.");
  } else {
    console.log("Failed:", JSON.stringify(createResult));

    // Try backup offer (H100 SXM France #2)
    console.log("\nTrying backup offer 28241208...");
    const backup = await fetch(`https://console.vast.ai/api/v0/asks/28241208/`, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + VAST_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        image: "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-devel",
        label: "elena-lora-h100",
        disk: 80,
        runtype: "ssh"
      })
    }).then(r => r.json());

    if (backup.success) {
      console.log(`Created backup instance: ${backup.new_contract}`);
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 5000));
        process.stdout.write(".");
        const status = await fetch("https://console.vast.ai/api/v0/instances?owner=me", {
          headers: { "Authorization": "Bearer " + VAST_API_KEY }
        }).then(r => r.json());
        const inst = status.instances?.find(x => x.id === backup.new_contract);
        if (inst?.actual_status === 'running' && inst.ssh_host && inst.ssh_port) {
          console.log(`\n\nInstance ready!`);
          console.log(`  SSH: ssh -p ${inst.ssh_port} root@${inst.ssh_host}`);
          console.log(`  GPU: ${inst.gpu_name} (${inst.gpu_ram}MB VRAM)`);
          console.log(`  Price: $${inst.dph_total?.toFixed(3)}/hr`);
          console.log(`  Instance ID: ${inst.id}`);
          return;
        }
      }
    } else {
      console.log("Backup also failed:", JSON.stringify(backup));
    }
  }
}

main().catch(console.error);
