#!/usr/bin/env node
/**
 * Start FLUX LoRA training on Replicate
 * Uses ostris/flux-dev-lora-trainer
 * Cost: ~$2-3 for 56 images, 20-30 min on H100
 */
import Replicate from 'replicate';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function uploadToReplicate(filePath) {
  console.log('Uploading dataset to Replicate...');
  const fileData = fs.readFileSync(filePath);

  // Use Replicate's file upload
  const file = await replicate.files.create(fileData, {
    filename: 'elena-flux-dataset.zip',
    content_type: 'application/zip',
  });

  console.log('Uploaded! File ID:', file.id);
  return file.urls.get;
}

async function main() {
  const datasetPath = '/tmp/elena-flux-dataset.zip';

  if (!fs.existsSync(datasetPath)) {
    console.error('Dataset not found:', datasetPath);
    process.exit(1);
  }

  console.log('Starting FLUX LoRA training on Replicate...');
  console.log('Dataset:', datasetPath);
  console.log('Size:', (fs.statSync(datasetPath).size / 1024 / 1024).toFixed(1), 'MB');
  console.log('');

  // Upload to Replicate first (they have their own file hosting)
  const datasetUrl = await uploadToReplicate(datasetPath);

  console.log('');
  console.log('Starting training...');
  console.log('This will take 20-30 minutes and cost ~$2-3');
  console.log('');

  try {
    // First, create the destination model if it doesn't exist
    const username = process.env.REPLICATE_USERNAME || 'edouardtiem';
    const modelName = 'elena-flux-lora';

    console.log(`Creating destination model: ${username}/${modelName}`);
    try {
      await replicate.models.create(username, modelName, {
        visibility: 'private',
        hardware: 'gpu-t4',
        description: 'Elena FLUX LoRA - character consistency model',
      });
      console.log('Model created!');
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('Model already exists, continuing...');
      } else {
        console.log('Note:', e.message);
      }
    }

    const training = await replicate.trainings.create(
      'ostris',
      'flux-dev-lora-trainer',
      '26dce37af90b9d997eeb970d92e47de3064d46c300504ae376c75bef6a9022d2',
      {
        destination: `${username}/${modelName}`,
        input: {
          input_images: datasetUrl,
          trigger_word: 'elena',
          steps: 4000,
          lora_rank: 32,
          learning_rate: 0.0001,
          batch_size: 1,
          resolution: '1024',
          autocaption: false,  // We have our own captions
          autocaption_prefix: '',
        },
      }
    );

    console.log('Training started!');
    console.log('Training ID:', training.id);
    console.log('Status:', training.status);
    console.log('');
    console.log('Monitor at: https://replicate.com/p/' + training.id);
    console.log('');
    console.log('When complete, the LoRA will be at:');
    console.log('https://replicate.com/edouardtiem/elena-flux-lora');

    // Save training ID for later reference
    fs.writeFileSync(
      path.join(__dirname, 'elena-flux-training-id.txt'),
      training.id
    );
    console.log('\nTraining ID saved to elena-flux-training-id.txt');

  } catch (error) {
    console.error('Error starting training:', error.message);
    if (error.response) {
      console.error('Response:', await error.response.text());
    }
    process.exit(1);
  }
}

main().catch(console.error);
