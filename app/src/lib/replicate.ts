import Replicate from 'replicate';
import { ContentTemplate } from '@/types';
import { CHARACTER } from '@/config/character';

/**
 * Replicate API for image generation with Nano Banana Pro
 */

let replicateClient: Replicate | null = null;

function getClient(): Replicate {
  if (!replicateClient) {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }
    replicateClient = new Replicate({ auth: apiToken });
  }
  return replicateClient;
}

interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Build prompt for image generation
 */
function buildPrompt(template: ContentTemplate): string {
  const { physical } = CHARACTER;
  
  return `A photorealistic Instagram photo of a ${physical.base}, ${physical.face}, ${physical.hair}, ${physical.eyes}, ${physical.skin}, ${physical.body}, wearing thin gold necklace with small star pendant. She is wearing ${template.clothing}. ${template.pose}. Setting: ${template.setting}. Shot on iPhone 15 Pro, natural Instagram aesthetic, warm tones, high resolution, sharp focus, natural skin texture. Same person, consistent identity.`;
}

/**
 * Negative prompt for better results
 */
const NEGATIVE_PROMPT = 'cartoon, illustration, anime, deformed, blurry, watermark, oversaturated, plastic skin, excessive makeup, bad anatomy, extra limbs, disfigured, ugly, low quality';


/**
 * Generate image using Nano Banana Pro (Google DeepMind)
 * State-of-the-art consistency and professional creative controls
 * Cost: TBD (testing phase)
 * Consistency: Excellent native consistency (supports up to 14 reference images!)
 */
export async function generateWithNanaBanana(
  template: ContentTemplate,
  referenceImages?: string[] // Array of up to 14 image URLs for reference
): Promise<GenerateImageResult> {
  try {
    const client = getClient();
    const prompt = buildPrompt(template);
    
    console.log('[Replicate] Generating with Nano Banana Pro...');
    console.log('[Replicate] Reference images:', referenceImages?.length || 0);
    console.log('[Replicate] Prompt:', prompt.slice(0, 200) + '...');
    
    const output = await client.run(
      "google/nano-banana-pro",
      {
        input: {
          prompt,
          image_input: referenceImages || [], // Up to 14 reference images!
          aspect_ratio: "4:5", // Instagram portrait
          output_format: "jpg",
          num_outputs: 1,
          resolution: "2K", // High quality for Instagram
          safety_filter_level: "block_only_high", // Most permissive
        }
      }
    );
    
    console.log('[Replicate] Nano Banana Pro raw output type:', typeof output);
    
    // Extract URL from output
    let imageUrl: string | undefined;
    
    if (typeof output === 'string') {
      imageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      imageUrl = typeof first === 'string' ? first : String(first);
    }
    
    // Try regex extraction if needed
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      const outputStr = String(output);
      const urlMatch = outputStr.match(/https?:\/\/[^\s"'\]]+/);
      if (urlMatch) {
        imageUrl = urlMatch[0];
      }
    }
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { success: false, error: `No image URL from Nano Banana Pro. Output: ${String(output).slice(0, 200)}` };
    }
    
    console.log('[Replicate] Nano Banana Pro image generated:', imageUrl);
    return { success: true, imageUrl };
    
  } catch (error) {
    console.error('[Replicate] Nano Banana Pro error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate image using Seedream 4.5 (ByteDance)
 * Excellent for portraits, realistic skin, lighting
 * Cost: ~$0.04/image
 * Supports up to 14 reference images
 */
export async function generateWithSeedream(
  template: ContentTemplate,
  referenceImages?: string[]
): Promise<GenerateImageResult> {
  try {
    const client = getClient();
    const prompt = buildPrompt(template);

    console.log('[Replicate] Generating with Seedream 4.5...');
    console.log('[Replicate] Reference images:', referenceImages?.length || 0);
    console.log('[Replicate] Prompt:', prompt.slice(0, 200) + '...');

    const output = await client.run("bytedance/seedream-4.5", {
      input: {
        prompt,
        image_input: referenceImages || [],
        aspect_ratio: "3:4", // Closest to 4:5 Instagram portrait
        size: "2K",
      }
    });

    console.log('[Replicate] Seedream 4.5 raw output type:', typeof output);

    // Same URL extraction logic as Nano Banana
    let imageUrl: string | undefined;
    if (typeof output === 'string') {
      imageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      imageUrl = typeof first === 'string' ? first : String(first);
    }

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      const outputStr = String(output);
      const urlMatch = outputStr.match(/https?:\/\/[^\s"'\]]+/);
      if (urlMatch) {
        imageUrl = urlMatch[0];
      }
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return { success: false, error: `No image URL from Seedream 4.5. Output: ${String(output).slice(0, 200)}` };
    }

    console.log('[Replicate] Seedream 4.5 image generated:', imageUrl);
    return { success: true, imageUrl };
  } catch (error) {
    console.error('[Replicate] Seedream 4.5 error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check API status
 */
export async function checkApiStatus(): Promise<{ ok: boolean; error?: string }> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return { ok: false, error: 'REPLICATE_API_TOKEN not configured' };
  }
  
  try {
    const client = getClient();
    // Simple check - list models to verify API key works
    await client.models.get("black-forest-labs", "flux-1.1-pro");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

