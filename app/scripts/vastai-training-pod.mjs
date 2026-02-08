#!/usr/bin/env node
/**
 * Create a Vast.ai instance for FLUX LoRA training
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const VAST_API_KEY = process.env.VAST_API_KEY;

async function main() {
  // Search for any GPU with 24GB+ VRAM (relaxed criteria)
  console.log('Searching for GPUs with 24GB+ VRAM...');
  const result = await fetch('https://console.vast.ai/api/v0/bundles/', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + VAST_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      limit: 50,
      type: 'on-demand',
      verified: { eq: true },
      rentable: { eq: true },
      rented: { eq: false },
      num_gpus: { eq: 1 },
      gpu_ram: { gte: 24000 },
      dph_total: { lte: 0.60 },
      disk_space: { gte: 50 },
      reliability2: { gte: 0.85 }
    })
  }).then(r => r.json());

  const badLocations = ['CN', 'China', 'Russia', 'RU'];
  const offers = (result.offers || [])
    .filter(o => o.geolocation && !badLocations.some(loc => o.geolocation.includes(loc)))
    .sort((a, b) => a.dph_total - b.dph_total);

  console.log('Found ' + offers.length + ' GPU offers:\n');
  offers.slice(0, 10).forEach((o, i) => {
    console.log(`${i+1}. ID:${o.id} - ${o.gpu_name} @ $${o.dph_total.toFixed(3)}/hr - ${o.geolocation} (${(o.reliability2*100).toFixed(1)}%)`);
  });

  if (offers.length > 0) {
    const best = offers[0];
    console.log('\nCreating instance from offer ' + best.id + '...');
    const createResult = await fetch('https://console.vast.ai/api/v0/asks/' + best.id + '/', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + VAST_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: 'runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04',
        label: 'elena-flux-lora-training',
        disk: 100,
        runtype: 'ssh'
      })
    }).then(r => r.json());

    if (createResult.success) {
      console.log('SUCCESS! Instance created: ' + createResult.new_contract);
      console.log('\nWaiting for instance to start...');

      // Wait and get SSH info
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const instances = await fetch('https://console.vast.ai/api/v0/instances?owner=me', {
          headers: { 'Authorization': 'Bearer ' + VAST_API_KEY }
        }).then(r => r.json());

        const inst = instances.instances?.find(x => x.id === createResult.new_contract);
        if (inst?.actual_status === 'running' && inst.ssh_port) {
          console.log('\n✅ Instance ready!');
          console.log(`SSH: ssh -p ${inst.ssh_port} root@${inst.ssh_host}`);
          console.log(`GPU: ${inst.gpu_name}`);
          console.log(`Cost: $${inst.dph_total?.toFixed(3)}/hr`);
          return;
        }
        process.stdout.write('.');
      }
    } else {
      console.log('Failed:', JSON.stringify(createResult));
    }
  } else {
    console.log('No suitable GPU available.');
  }
}

main().catch(console.error);
