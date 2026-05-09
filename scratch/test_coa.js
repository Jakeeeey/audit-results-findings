
const DIRECTUS_URL = "https://vos.bi-ws.com";
const DIRECTUS_TOKEN = "your-token-here"; // I'll use the one from route.ts if I could see it, but I'll just check the response

async function test() {
  const collections = ["chart_of_accounts", "chart_of_account", "coa"];
  for (const c of collections) {
    console.log(`Testing ${c}...`);
    try {
      const res = await fetch(`${DIRECTUS_URL}/items/${c}?limit=1`, {
        headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` }
      });
      const json = await res.json();
      console.log(`${c} response:`, json);
    } catch (e) {
      console.log(`${c} error:`, e.message);
    }
  }
}

test();
