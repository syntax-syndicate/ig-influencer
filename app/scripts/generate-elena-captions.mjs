#!/usr/bin/env node
/**
 * Generate caption files for Elena Z-Image LoRA training
 * Creates .txt file for each .png with trigger token and description
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.join(__dirname, '../../lora-dataset-elena-zimage/processed');

// Trigger token for LoRA
const TRIGGER = 'ohwx';  // Using rare token as recommended

// Base caption - describes Elena's consistent features
// The trigger token teaches the model "this is elena"
// The description helps with pose/scene variety
const BASE_CAPTION = `${TRIGGER}, woman, tan skin, hazel eyes, brunette with blonde highlights, beauty mark on right cheek`;

async function main() {
  console.log('Generating captions for Elena Z-Image dataset...');
  console.log(`Dataset: ${DATASET_DIR}`);
  console.log(`Trigger token: ${TRIGGER}\n`);

  // Get all PNG files
  const files = fs.readdirSync(DATASET_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  console.log(`Found ${files.length} images\n`);

  let created = 0;

  for (const file of files) {
    const baseName = file.replace('.png', '');
    const captionFile = `${baseName}.txt`;
    const captionPath = path.join(DATASET_DIR, captionFile);

    // Write caption file
    fs.writeFileSync(captionPath, BASE_CAPTION);
    console.log(`Created: ${captionFile}`);
    created++;
  }

  console.log(`\nDone! Created ${created} caption files`);
  console.log(`Trigger token: ${TRIGGER}`);
  console.log(`\nExample caption:\n${BASE_CAPTION}`);
}

main().catch(console.error);
