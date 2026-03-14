import { GoogleAuth } from "google-auth-library";

const project = process.env.VERTEX_PROJECT_ID;
const location = process.env.VERTEX_LOCATION || "us-central1";

const models = [
  ["gemini-3.1-pro-preview", "google"],
  ["gemini-3.1-flash-preview", "google"],
  ["gemini-3.1-flash-lite-preview", "google"],
  ["gemini-3.1-flash-image-preview", "google"],
  ["gemini-2.5-pro", "google"],
  ["gemini-2.5-flash", "google"],
  ["gemini-2.5-flash-lite", "google"],
  ["gemini-live-2.5-flash-native-audio", "google"],
  ["jules", "google"],
  ["imagen-4.0-generate-001", "google"],
  ["imagen-4.0-fast-generate-001", "google"],
  ["imagen-4.0-ultra-generate-001", "google"],
  ["veo-2.0-generate-001", "google"],
  ["veo-3.1", "google"],
  ["chirp-3-transcribe", "google"],
  ["chirp-3-instant-custom-voice", "google"],
  ["lyria", "google"],
  ["claude-sonnet-4-6", "anthropic"],
  ["claude-opus-4-6", "anthropic"],
  ["claude-sonnet-4-5", "anthropic"],
  ["claude-opus-4-5", "anthropic"],
  ["translation-llm", "google"],
  ["mistral-large", "mistralai"],
  ["mistral-small", "mistralai"],
  ["writer-ai", "external"],
  ["gemma-3-27b-it", "google"],
  ["gemma-3-12b-it", "google"],
  ["gemma-3-4b-it", "google"],
  ["llama-3.1-405b-instruct", "meta"],
  ["llama-3.3-70b-instruct", "meta"],
  ["llama-3.1-70b-instruct", "meta"],
  ["llama-3.1-8b-instruct", "meta"],
  ["llama-3.2-90b-vision-instruct", "meta"],
  ["mars7", "unknown"],
  ["mars8", "unknown"],
  ["nano-banana-pro", "unknown"],
  ["elevenlabs", "external"],
];

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const token = await client.getAccessToken();
const headers = { Authorization: `Bearer ${token.token}` };

console.log(`token=${token?.token ? "OK" : "MISSING"}`);
console.log("model\tpublisher\tstatus\tdetail");

for (const [id, publisher] of models) {
  if (publisher === "external" || publisher === "unknown") {
    console.log(`${id}\t${publisher}\tN/A\tnot-vertex-publisher`);
    continue;
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/${publisher}/models/${encodeURIComponent(id)}`;
  try {
    const response = await fetch(url, { headers });
    const body = await response.text();
    let detail = "";

    try {
      const parsed = JSON.parse(body);
      detail = parsed.displayName || parsed.error?.message || body;
    } catch {
      detail = body;
    }

    console.log(`${id}\t${publisher}\t${response.status}\t${compact(detail)}`);
  } catch (error) {
    console.log(`${id}\t${publisher}\tERR\t${compact(error?.message || error)}`);
  }
}
