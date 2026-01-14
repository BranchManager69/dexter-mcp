/**
 * Dexter Studio - Breaking News Generator
 * 
 * Creates newscast videos and infographics for marketing.
 * Superadmin only.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEXTER_API_URL = process.env.DEXTER_API_URL || 'https://api.dexter.cash';
const BRANCH_ADMIN_TOKEN = process.env.BRANCH_ADMIN_TOKEN || '';

// Default newscast scene template
const DEFAULT_SCENE = `Classic American news studio. Male anchor mid-50s with silver hair in charcoal suit and red striped tie sits at curved wooden desk. Large screen behind shows DEXTER REPORT logo. Smaller screens show market charts. Red white and blue color scheme throughout. Gold ticker bar scrolls: {{HEADLINE}}. Anchor looks directly at camera with serious expression.`;

const DEFAULT_STYLE = `Traditional American evening news broadcast. Professional warm lighting. Authoritative and trustworthy aesthetic. No voiceover. Clean readable graphics. Static medium shot.`;

/**
 * Generate a breaking news video via Sora
 */
export async function generateNewsVideo({
  headline,
  scene,
  style,
  referenceImageUrl,
  referenceImagePath,
  seconds = 12,
}) {
  if (!BRANCH_ADMIN_TOKEN) {
    throw new Error('BRANCH_ADMIN_TOKEN not configured');
  }

  const finalScene = (scene || DEFAULT_SCENE).replace('{{HEADLINE}}', headline);
  const finalStyle = style || DEFAULT_STYLE;

  const payload = {
    scene: finalScene,
    style: finalStyle,
    seconds,
    resolution: '1280x720',
  };

  // Add reference image if provided
  if (referenceImageUrl) {
    payload.referenceImageUrl = referenceImageUrl;
  }
  if (referenceImagePath) {
    payload.referenceImagePath = referenceImagePath;
  }

  console.log(`[breaking-news] Generating video: "${headline.slice(0, 50)}..."`);

  const res = await fetch(`${DEXTER_API_URL}/api/tools/sora/smoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  
  if (!data.jobId) {
    throw new Error(`Sora submission failed: ${JSON.stringify(data)}`);
  }

  console.log(`[breaking-news] Video job submitted: ${data.jobId}`);
  
  return {
    type: 'video',
    jobId: data.jobId,
    headline,
    status: 'submitted',
  };
}

/**
 * Generate a breaking news infographic via meme generator
 */
export async function generateNewsInfographic({
  headline,
  details,
  style,
  referenceImageUrls,
}) {
  if (!BRANCH_ADMIN_TOKEN) {
    throw new Error('BRANCH_ADMIN_TOKEN not configured');
  }

  const prompt = `Breaking news infographic for crypto news broadcast.

HEADLINE: ${headline}

${details ? `DETAILS:\n${details}` : ''}

Style: Professional news graphic. Bold typography. Clean layout.
Include the Dexter branding prominently.
Make it look like a cable news "BREAKING NEWS" graphic.
${style || ''}`;

  const payload = {
    prompt,
    action: 'breaking_news',
    style: 'news_infographic',
  };

  if (referenceImageUrls?.length) {
    payload.referenceImageUrls = referenceImageUrls;
  }

  console.log(`[breaking-news] Generating infographic: "${headline.slice(0, 50)}..."`);

  const res = await fetch(`${DEXTER_API_URL}/api/tools/meme/smoke`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  
  if (!data.jobId) {
    throw new Error(`Meme submission failed: ${JSON.stringify(data)}`);
  }

  console.log(`[breaking-news] Infographic job submitted: ${data.jobId}`);
  
  return {
    type: 'infographic',
    jobId: data.jobId,
    headline,
    status: 'submitted',
  };
}

/**
 * Post to Twitter (requires media to be ready)
 */
export async function postToTwitter({
  text,
  mediaJobId,
}) {
  if (!BRANCH_ADMIN_TOKEN) {
    throw new Error('BRANCH_ADMIN_TOKEN not configured');
  }

  // First check if media is ready
  const jobRes = await fetch(`${DEXTER_API_URL}/api/tools/jobs/${mediaJobId}`, {
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
    },
  });

  const job = await jobRes.json();
  
  if (job.status !== 'completed') {
    return {
      success: false,
      error: `Media not ready. Status: ${job.status}`,
      jobId: mediaJobId,
    };
  }

  // Get the media URL from artifacts
  const artifactsRes = await fetch(`${DEXTER_API_URL}/api/tools/jobs/${mediaJobId}/artifacts`, {
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
    },
  });

  const artifacts = await artifactsRes.json();
  const mediaUrl = artifacts?.[0]?.signedUrl;

  if (!mediaUrl) {
    return {
      success: false,
      error: 'No media artifact found',
      jobId: mediaJobId,
    };
  }

  // Post to Twitter via internal API
  const tweetRes = await fetch(`${DEXTER_API_URL}/api/internal/twitter/post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      mediaUrl,
    }),
  });

  const tweetData = await tweetRes.json();

  return {
    success: !!tweetData.tweetId,
    tweetId: tweetData.tweetId,
    error: tweetData.error,
  };
}

/**
 * Check job status
 */
export async function checkJobStatus(jobId) {
  if (!BRANCH_ADMIN_TOKEN) {
    throw new Error('BRANCH_ADMIN_TOKEN not configured');
  }

  const res = await fetch(`${DEXTER_API_URL}/api/tools/jobs/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${BRANCH_ADMIN_TOKEN}`,
    },
  });

  return await res.json();
}

export default {
  generateNewsVideo,
  generateNewsInfographic,
  postToTwitter,
  checkJobStatus,
};
