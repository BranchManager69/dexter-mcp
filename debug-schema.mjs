import { listX402Resources } from './registry/x402/index.mjs';

async function main() {
  console.log('Fetching resources...');
  const resources = await listX402Resources(true); // Force refresh
  
  const twitter = resources.find(r => r.resourceUrl.includes('twitter/analyze'));
  
  if (twitter) {
    console.log('Twitter Resource Found:', twitter.resourceUrl);
    console.log(JSON.stringify(twitter, null, 2));
    
    twitter.accepts.forEach((accept, i) => {
      console.log(`Accept[${i}] Input Schema:`, JSON.stringify(accept.outputSchema?.input, null, 2));
    });
  } else {
    console.error('Twitter resource not found in catalog');
  }
}

main().catch(console.error);

