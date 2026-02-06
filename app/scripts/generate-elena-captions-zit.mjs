#!/usr/bin/env node
/**
 * Generate captions for Elena Z-Image Turbo LoRA training
 * Trigger token: <elena> (rare token for Z-Image Turbo)
 * Writes .txt files next to .jpg files in lora-dataset-elena-zimage/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_DIR = path.join(__dirname, '../../lora-dataset-elena-zimage');

const FACE_PREFIX = 'full pouty lips, high cheekbones, angular jawline, hazel-green eyes, tan skin, beauty mark on right cheek, brunette with blonde highlights';

const captions = {
  'elena_001': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, holding wine glass, looking down, relaxed expression, beige ribbed bodysuit, gold necklace, golden hour lighting, Paris rooftop balcony, Eiffel Tower in background, city skyline`,
  'elena_002': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, side profile, looking away, serene expression, beige ribbed bodysuit, gold necklace and bracelets, golden hour lighting, Paris rooftop balcony, Eiffel Tower in background`,
  'elena_003': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, front view, holding wine glass, neutral expression, beige ribbed bodysuit, gold necklace, golden hour lighting, Paris rooftop balcony, Eiffel Tower visible, city rooftops`,
  'elena_004': `<elena>, ${FACE_PREFIX}, 1woman, upper body portrait, front view, holding cocktail glass, bright smile showing teeth, black square neck dress, gold pendant necklace, warm ambient lighting, luxury bar interior, wooden bar counter`,
  'elena_005': `<elena>, ${FACE_PREFIX}, 1woman, upper body portrait, slight angle, holding cocktail glass, soft smile, black v-neck dress, gold pendant necklace, warm ambient lighting, luxury hotel bar, elegant interior`,
  'elena_006': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, side profile view, holding drink, natural expression, black low-cut dress, gold necklace and bracelet, warm ambient lighting, luxury bar interior, table lamps`,
  'elena_007': `<elena>, ${FACE_PREFIX}, 1woman, full body shot from behind, looking over shoulder, confident expression, black backless jumpsuit, gold bracelet, modern gallery lighting, art gallery interior, abstract paintings on walls`,
  'elena_008': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, side profile, eyes closed, peaceful expression, beige satin slip dress, gold necklace and bracelet, golden hour lighting, Paris rooftop terrace, coffee cup on table`,
  'elena_009': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, side profile, looking at horizon, contemplative expression, beige satin slip dress, gold jewelry, golden hour lighting, Paris rooftop terrace, city buildings background`,
  'elena_010': `<elena>, ${FACE_PREFIX}, 1woman, close up portrait, three quarter view, hand touching face, thoughtful expression, camel cashmere sweater, gold necklace, natural window light, luxury hotel room, city view through window`,
  'elena_011': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing by window, looking outside, relaxed pose, camel cashmere loungewear set, gold bracelet, natural daylight, luxury hotel suite, modern interior`,
  'elena_012': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body from behind, looking over shoulder, subtle smile, camel cashmere loungewear set, gold jewelry, natural daylight, luxury hotel lobby, marble floor`,
  'elena_013': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, front view, hands in hair, happy smile, pink satin camisole pajama set, gold pendant necklace, bright natural daylight, Paris apartment bedroom, white bedding`,
  'elena_014': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, profile view, arms stretched up, peaceful expression, pink satin pajama set, gold jewelry, morning natural light, Paris apartment bedroom, bed visible`,
  'elena_015': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, lying on bed, propped on elbows, warm smile, pink satin pajama set, gold bracelet, natural daylight, Paris apartment bedroom, white sheets`,
  'elena_016': `<elena>, ${FACE_PREFIX}, 1woman, close up selfie from above, looking up at camera, genuine smile, pink satin camisole, gold pendant necklace, soft natural light, bedroom setting, white pillows`,
  'elena_017': `<elena>, ${FACE_PREFIX}, 1woman, upper body selfie, sitting cross-legged, neutral expression, beige sports bra and leggings yoga outfit, gold necklace, natural indoor light, home yoga space, plants in background`,
  'elena_018': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, leaning on column, bright smile, black lace trim camisole, gold pendant necklace, natural daylight, European shopping gallery interior, ornate architecture`,
  'elena_019': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing pose, direct gaze, confident expression, black mesh panel bodysuit, gold necklace and bracelet, natural daylight, Galerie Vivienne Paris, mosaic floor`,
  'elena_020': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by pool edge, pouty expression, beige one piece swimsuit, gold jewelry, golden hour lighting, Bali infinity pool villa, rice terraces background`,
  'elena_021': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body from behind, looking over shoulder, serene expression, beige backless dress, gold bracelet, sunset lighting, Santorini terrace, ocean and flowers visible`,
  'elena_022': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by pool, coffee cup nearby, relaxed expression, beige one piece swimsuit, gold jewelry, soft morning light, Bali villa, rice terraces`,
  'elena_023': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by pool, looking at camera, neutral expression, beige one piece swimsuit, gold bracelet, morning golden light, Bali infinity pool, tropical setting`,
  'elena_024': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, back view looking over shoulder, soft smile, beige halter dress, gold jewelry, sunset golden hour, Santorini terrace, ocean and bougainvillea`,
  'elena_025': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by pool edge, direct gaze, beige one piece swimsuit, gold bracelets, golden hour lighting, Bali infinity pool, lush green rice terraces`,
  'elena_026': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing by pool, looking away, elegant pose, beige one piece swimsuit, gold necklace, golden hour misty light, Bali villa pool, rice terrace landscape`,
  'elena_027': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, front view, warm smile, beige ribbed crop top, gold pendant necklace, gallery lighting, modern art gallery at night, abstract paintings visible`,
  'elena_028': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by infinity pool, pouty expression, tan one piece swimsuit, gold pendant and bracelets, golden hour lighting, luxury villa, ocean view, palm trees`,
  'elena_029': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, sitting by pool, direct gaze, confident expression, tan one piece swimsuit, gold jewelry, golden hour lighting, luxury oceanfront villa, tropical setting`,
  'elena_030': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, lying on bed, happy smile, black silk camisole and shorts pajama set, gold necklace, soft natural daylight, Paris apartment bedroom, neutral bedding`,
  'elena_031': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing by pool, elegant pose, terracotta rust one piece swimsuit, gold bracelets, golden hour lighting, Bali villa, rice terraces and tropical plants`,
  'elena_032': `<elena>, ${FACE_PREFIX}, 1woman, full body shot from behind, looking over shoulder, playful smile, beige bodycon mini dress, gold bracelet, sunset lighting, Paris rooftop bar, Eiffel Tower background`,
  'elena_033': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing with hand on hip, confident expression, beige off-shoulder ribbed midi dress, gold bracelet, golden hour lighting, Paris rooftop, city skyline view`,
  'elena_034': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, leaning on railing, holding champagne, sultry expression, black triangle bikini, gold bracelets, golden hour sunset, luxury yacht, ocean background`,
  'elena_035': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, looking over shoulder, bright smile, black bikini top, gold necklace, sunset lighting, yacht deck, Mediterranean sea and coastline`,
  'elena_036': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, standing holding coffee mug, warm smile, white ribbed tank top, beige oversized cardigan, black pants, gold jewelry, natural daylight, modern kitchen, Christmas decor`,
  'elena_037': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, hand on hip, sultry expression, white ribbed tank top, beige oversized cardigan, gold necklace, natural window light, kitchen interior`,
  'elena_038': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, hand on hip, confident expression, white ribbed tank top, beige oversized cardigan, gold pendant necklace, soft natural light, modern kitchen`,
  'elena_039': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing pose, hand in hair, confident expression, black sports bra and bikini bottom, gold bracelet, bright natural light, luxury marble bathroom`,
  'elena_040': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, hand touching hair, soft smile, black sports bra bikini top, gold pendant necklace, soft warm lighting, bedroom setting, pink cushions`,
  'elena_041': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body from behind, walking pose, looking back, beige bodycon maxi dress, gold bracelet, golden hour lighting, desert landscape, luxury tent camp`,
  'elena_042': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, walking towards camera, direct gaze, beige bodycon midi dress, gold pendant necklace, golden hour lighting, desert dunes, glamping tent background`,
  'elena_043': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, arms raised up, joyful smile, white triangle bikini, tropical print kimono robe, gold necklace, sunrise lighting, Bali villa pool, rice terraces`,
  'elena_044': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing pose, relaxed expression, white bikini, tropical palm print kimono, gold jewelry, golden hour lighting, Bali infinity pool villa`,
  'elena_045': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, arms stretched up, happy smile, white bikini, tropical print open kimono, gold pendant, sunrise lighting, Bali villa poolside`,
  'elena_046': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, hand in hair, sultry expression, white bikini, tropical print kimono, gold necklace, golden hour lighting, Bali pool villa`,
  'elena_047': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, sitting on floor, relaxed smile, white ribbed tank top, black leggings, cream knit socks, gold jewelry, warm interior lighting, Paris apartment, Christmas tree`,
  'elena_048': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, reclining on bed, soft expression, cream oversized knit sweater, gold pendant necklace, warm ambient lighting, luxury bedroom, neutral decor`,
  'elena_049': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, hair in messy bun, applying skincare, soft smile, champagne satin robe, gold necklace and bracelet, warm vanity mirror lighting, bedroom setting`,
  'elena_050': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, sitting pose, genuine smile, white triangle bikini top, gold body chain and necklace, bright natural daylight, poolside, turquoise water background`,
  'elena_051': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing pose, direct gaze, white ribbed tank top, black high-waisted leggings, gold jewelry, natural daylight, Paris apartment living room, plants`,
  'elena_052': `<elena>, ${FACE_PREFIX}, 1woman, three quarter body shot, mirror selfie, holding phone, confident expression, black deep v bodysuit, gold pendant necklace, warm vanity lighting, Paris bedroom`,
  'elena_053': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing pose, hand on hip, confident expression, black deep v bodysuit, gold necklace, warm evening lighting, Paris apartment bedroom`,
  'elena_054': `<elena>, ${FACE_PREFIX}, 1woman, full body shot, standing with hands on hips, athletic pose, grey sports bra, olive green open jacket, grey leggings, gold jewelry, natural daylight, Paris apartment`,
  'elena_055': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, sitting at cafe, warm smile, black ribbed turtleneck sweater, layered gold necklaces, golden hour lighting, Paris outdoor cafe terrace, Haussmann buildings`,
  'elena_056': `<elena>, ${FACE_PREFIX}, 1woman, upper body shot, sitting at cafe, side profile, looking away, beige button cardigan crop top, cream pants, gold pendant necklace, natural daylight, Paris street cafe, rattan chairs`
};

async function main() {
  console.log('='.repeat(60));
  console.log('Elena Z-Image Turbo LoRA - Captions Generator');
  console.log('='.repeat(60));
  console.log(`Dataset: ${DATASET_DIR}`);
  console.log(`Trigger token: <elena>`);
  console.log(`Total captions: ${Object.keys(captions).length}\n`);

  let written = 0;

  for (const [filename, caption] of Object.entries(captions)) {
    const captionPath = path.join(DATASET_DIR, `${filename}.txt`);
    const imagePath = path.join(DATASET_DIR, `${filename}.jpg`);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠ Skipping ${filename} - no matching .jpg`);
      continue;
    }

    fs.writeFileSync(captionPath, caption);
    console.log(`✓ ${filename}.txt`);
    written++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done! Written ${written} caption files`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nExample caption (elena_001):`);
  console.log(captions['elena_001']);
}

main().catch(console.error);
