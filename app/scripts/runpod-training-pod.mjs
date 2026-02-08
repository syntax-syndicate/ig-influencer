#!/usr/bin/env node
/**
 * RunPod Training Pod - Create a new pod for LoRA training
 * Separate from the testing pod so we can continue testing while training
 *
 * Usage:
 *   node app/scripts/runpod-training-pod.mjs          # Create/start training pod
 *   node app/scripts/runpod-training-pod.mjs --stop   # Stop pod
 *   node app/scripts/runpod-training-pod.mjs --status # Check status
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const GRAPHQL_URL = 'https://api.runpod.io/graphql';

// Configuration for training pod
const CONFIG = {
  podName: 'elena-flux-lora-training',
  gpuType: 'NVIDIA RTX A5000',  // $0.16/hr - best value for training
  fallbackGpuTypes: ['NVIDIA A30', 'NVIDIA GeForce RTX 3090', 'NVIDIA RTX A6000', 'NVIDIA GeForce RTX 4090'],
  // Use official ai-toolkit image or PyTorch base
  imageName: 'runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04',
  volumeInGb: 50,  // Disk space for models + dataset
  ports: '22/tcp,8188/http,7860/http',  // SSH + ComfyUI + Gradio
  // Training will use a new volume (not shared with ComfyUI testing pod)
};

async function runpodQuery(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`
    },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
  }
  return result;
}

async function getMyPods() {
  const query = `
    query {
      myself {
        pods {
          id
          name
          desiredStatus
          runtime {
            uptimeInSeconds
            ports {
              ip
              isIpPublic
              privatePort
              publicPort
              type
            }
          }
          machine {
            gpuDisplayName
            dataCenterId
          }
        }
      }
    }
  `;
  return runpodQuery(query);
}

async function findTrainingPod() {
  const result = await getMyPods();
  const pods = result.data?.myself?.pods || [];

  return pods.find(p => p.name === CONFIG.podName);
}

async function createPod(gpuTypeId) {
  const query = `
    mutation {
      podFindAndDeployOnDemand(
        input: {
          name: "${CONFIG.podName}"
          imageName: "${CONFIG.imageName}"
          gpuTypeId: "${gpuTypeId}"
          volumeInGb: ${CONFIG.volumeInGb}
          containerDiskInGb: 20
          ports: "${CONFIG.ports}"
          dockerArgs: ""
          env: []
        }
      ) {
        id
        name
        desiredStatus
        machine {
          gpuDisplayName
          dataCenterId
        }
      }
    }
  `;
  return runpodQuery(query);
}

async function resumePod(podId) {
  const query = `
    mutation {
      podResume(input: { podId: "${podId}", gpuCount: 1 }) {
        id
        desiredStatus
      }
    }
  `;
  return runpodQuery(query);
}

async function stopPod(podId) {
  const query = `
    mutation {
      podStop(input: { podId: "${podId}" }) {
        id
        desiredStatus
      }
    }
  `;
  return runpodQuery(query);
}

async function waitForPodReady(podId, maxWaitMs = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await getMyPods();
    const pod = result.data?.myself?.pods?.find(p => p.id === podId);

    if (pod?.runtime?.ports?.length > 0) {
      return pod;
    }

    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error('Pod did not become ready in time');
}

function getSSHCommand(pod) {
  const sshPort = pod.runtime?.ports?.find(p => p.privatePort === 22);
  if (sshPort) {
    return `ssh -i ~/.runpod/ssh/RunPod-Key-Go root@${sshPort.ip} -p ${sshPort.publicPort}`;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);

  if (!RUNPOD_API_KEY) {
    console.error('ERROR: RUNPOD_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Check for existing training pod
  const existingPod = await findTrainingPod();

  if (args.includes('--status')) {
    const result = await getMyPods();
    const pods = result.data?.myself?.pods || [];

    console.log('\n📊 Your RunPod Pods:\n');
    for (const pod of pods) {
      console.log(`${pod.name} (${pod.id})`);
      console.log(`  Status: ${pod.desiredStatus}`);
      console.log(`  GPU: ${pod.machine?.gpuDisplayName || 'N/A'}`);
      console.log(`  Datacenter: ${pod.machine?.dataCenterId || 'N/A'}`);
      if (pod.runtime?.uptimeInSeconds) {
        console.log(`  Uptime: ${Math.round(pod.runtime.uptimeInSeconds / 60)} minutes`);
      }
      const sshCmd = getSSHCommand(pod);
      if (sshCmd) {
        console.log(`  SSH: ${sshCmd}`);
      }
      console.log();
    }
    return;
  }

  if (args.includes('--stop')) {
    if (!existingPod) {
      console.log('No training pod found');
      return;
    }

    console.log(`Stopping pod ${existingPod.id}...`);
    await stopPod(existingPod.id);
    console.log('✅ Pod stopped');
    return;
  }

  // Start or create training pod
  if (existingPod) {
    if (existingPod.desiredStatus === 'RUNNING') {
      console.log('✅ Training pod already running');
      const pod = await waitForPodReady(existingPod.id, 10000).catch(() => existingPod);
      console.log(`\nSSH: ${getSSHCommand(pod) || 'Waiting for SSH...'}`);
      console.log(`Pod ID: ${existingPod.id}`);
      return;
    }

    console.log(`Resuming existing training pod ${existingPod.id}...`);
    await resumePod(existingPod.id);
  } else {
    console.log('Creating new training pod...');
    console.log(`GPU: ${CONFIG.gpuType}`);
    console.log(`Image: ${CONFIG.imageName}`);
    console.log(`Volume: ${CONFIG.volumeInGb}GB`);

    const result = await createPod(CONFIG.gpuType);
    if (!result.data?.podFindAndDeployOnDemand?.id) {
      // Try fallback GPUs
      for (const fallbackGpu of CONFIG.fallbackGpuTypes) {
        console.log(`Trying fallback GPU: ${fallbackGpu}`);
        const fallbackResult = await createPod(fallbackGpu);
        if (fallbackResult.data?.podFindAndDeployOnDemand?.id) {
          console.log(`✅ Created with ${fallbackGpu}`);
          break;
        }
      }
    }
  }

  // Wait for pod to be ready
  console.log('\nWaiting for pod to start');
  const pod = await findTrainingPod();
  if (pod) {
    const readyPod = await waitForPodReady(pod.id);
    console.log('\n\n✅ Training pod ready!');
    console.log(`\nSSH: ${getSSHCommand(readyPod)}`);
    console.log(`Pod ID: ${readyPod.id}`);
    console.log(`\nNext steps:`);
    console.log(`1. SSH into the pod`);
    console.log(`2. Run: git clone https://github.com/ostris/ai-toolkit.git`);
    console.log(`3. Upload dataset with: scp -P <port> -r lora-dataset-elena-zimage/processed root@<ip>:/workspace/dataset`);
  }
}

main().catch(console.error);
