#!/usr/bin/env node
/**
 * Preprocess Elena Z-Image LoRA training dataset
 * - Resize to 1024x1024 (center crop)
 * - Convert to PNG format
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.join(__dirname, '../../lora-dataset-elena-zimage');
const OUTPUT_DIR = path.join(DATASET_DIR, 'processed');

function getImageDimensions(imagePath) {
  const output = execSync(`sips -g pixelWidth -g pixelHeight "${imagePath}"`, { encoding: 'utf8' });
  const widthMatch = output.match(/pixelWidth:\s*(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s*(\d+)/);
  return {
    width: parseInt(widthMatch[1]),
    height: parseInt(heightMatch[1]),
  };
}

function processImage(inputPath, outputPath) {
  const { width, height } = getImageDimensions(inputPath);

  // Calculate center crop dimensions
  const size = Math.min(width, height);
  const cropX = Math.floor((width - size) / 2);
  const cropY = Math.floor((height - size) / 2);

  // Create temp file for cropping
  const tempPath = inputPath.replace('.jpg', '_temp.jpg');

  try {
    // Step 1: Crop to square (center crop)
    if (width !== height) {
      execSync(`sips -c ${size} ${size} --cropOffset ${cropY} ${cropX} "${inputPath}" --out "${tempPath}"`, { encoding: 'utf8' });
    } else {
      // Already square, just copy
      fs.copyFileSync(inputPath, tempPath);
    }

    // Step 2: Resize to 1024x1024
    execSync(`sips -z 1024 1024 "${tempPath}" --out "${tempPath}"`, { encoding: 'utf8' });

    // Step 3: Convert to PNG
    execSync(`sips -s format png "${tempPath}" --out "${outputPath}"`, { encoding: 'utf8' });

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    return true;
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw err;
  }
}

async function main() {
  console.log('Preprocessing Elena Z-Image dataset...');
  console.log(`Input: ${DATASET_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all jpg files
  const files = fs.readdirSync(DATASET_DIR)
    .filter(f => f.endsWith('.jpg') && f.startsWith('elena_'))
    .sort();

  console.log(`Found ${files.length} images to process\n`);

  let processed = 0;
  let failed = 0;

  for (const file of files) {
    const inputPath = path.join(DATASET_DIR, file);
    const outputFile = file.replace('.jpg', '.png');
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    try {
      process.stdout.write(`[${processed + failed + 1}/${files.length}] ${file} → ${outputFile}... `);

      const { width, height } = getImageDimensions(inputPath);
      processImage(inputPath, outputPath);

      // Verify output
      const outDims = getImageDimensions(outputPath);
      if (outDims.width === 1024 && outDims.height === 1024) {
        console.log(`OK (${width}x${height} → 1024x1024)`);
        processed++;
      } else {
        console.log(`WARN: Output is ${outDims.width}x${outDims.height}`);
        processed++;
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`);
  console.log(`Output location: ${OUTPUT_DIR}`);
}

main().catch(console.error);
