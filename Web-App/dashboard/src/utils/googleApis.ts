// Google APIs Suite - 15 Integrated Services
const apiKey =
  import.meta.env.VITE_GOOGLE_API_KEY ||
  import.meta.env.VITE_PAGESPEED_API_KEY ||
  import.meta.env.VITE_MAPS_API_KEY ||
  "";
const customSearchCx = import.meta.env.VITE_GOOGLE_CX || "";

// API Key validation
if (!apiKey) {
  console.warn('Google APIs: VITE_PAGESPEED_API_KEY not found in environment variables');
}

// Helper function for API calls
function readGoogleErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (Array.isArray(err.errors) && err.errors[0] && typeof err.errors[0] === "object") {
      const first = err.errors[0] as Record<string, unknown>;
      if (typeof first.message === "string") return first.message;
    }
  }
  return null;
}

function requireApiKey() {
  if (!apiKey) throw new Error('API key required');
}

function requireHttpUrl(url: string, label = "URL") {
  if (!/^https?:\/\//i.test(String(url || "").trim())) {
    throw new Error(`${label} must be a full http(s) URL.`);
  }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? (() => {
    try { return JSON.parse(text); } catch { return null; }
  })() : null;
  if (!response.ok) {
    const detail = readGoogleErrorMessage(payload) || text || `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return payload ?? {};
}

const apiCall = async (url: string, options: RequestInit = {}) => {
  requireApiKey();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await parseJsonResponse(response);
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

const backendCall = async (url: string, body: unknown) => {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await parseJsonResponse(response);
  const record = payload as Record<string, unknown>;
  if (record.ok === false) throw new Error(String(record.error || "Google service request failed."));
  return record;
};

// SEO/Performance APIs
export interface CrUXData { mobileP75: number; desktopP75: number; url: string }
export interface PageSpeedData { performance: number; accessibility: number; seo: number; fcp: string }
export interface SearchData { items: Array<{ title: string; link: string; snippet: string }> }

// AI Content APIs  
export interface GeminiData { text: string; usage: { promptTokens: number; candidatesTokens: number } }
export interface NLPData { entities: Array<{ name: string; type: string; salience: number }> }
export interface TranslationData { translatedText: string; detectedSourceLanguage: string }
export interface SpeechData { transcript: string; confidence: number }

// Images/Videos APIs
export interface VisionData { labels: Array<{ description: string; score: number }>; objects: Array<{ name: string; score: number }> }
export interface VideoData { shots: Array<{ start: number; end: number }>; labels: Array<{ entity: string; confidence: number }> }
export interface YouTubeData { items: Array<{ title: string; videoId: string; thumbnail: string }> }
export interface DeviceData { deviceSpecs: Array<{ name: string; type: string; capabilities: string[] }> }

// Export/Deploy APIs
export interface DocumentData { entities: Array<{ type: string; text: string; confidence: number }> }
export interface HostingData { siteUrl: string; version: string; status: string }
export interface StorageData { fileUrl: string; bucket: string; size: number }
export interface BigQueryData { rows: Array<Array<any>>; totalRows: number; schema: Array<{ name: string; type: string }> }

// 1. Chrome UX Report API
export const getCrUXMetrics = async (url: string): Promise<CrUXData> => {
  requireHttpUrl(url);
  const data = await apiCall(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({ request: { url } })
  });
  
  return {
    mobileP75: data.record?.metrics?.largest_contentful_paint?.percentiles?.p75 || 0,
    desktopP75: data.record?.metrics?.largest_contentful_paint?.percentiles?.p75 || 0,
    url
  };
};

// 2. PageSpeed Insights API
export const analyzePageSpeed = async (url: string): Promise<PageSpeedData> => {
  requireHttpUrl(url);
  const data = await apiCall(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=accessibility&category=seo&category=performance&category=best-practices`
  );
  
  const lighthouse = data?.lighthouseResult;
  return {
    performance: Math.round((lighthouse?.categories?.performance?.score ?? 0) * 100),
    accessibility: Math.round((lighthouse?.categories?.accessibility?.score ?? 0) * 100),
    seo: Math.round((lighthouse?.categories?.seo?.score ?? 0) * 100),
    fcp: lighthouse?.audits?.["first-contentful-paint"]?.displayValue || "N/A"
  };
};

// 3. Custom Search API
export const searchUrl = async (url: string): Promise<SearchData> => {
  requireHttpUrl(url);
  if (!customSearchCx) throw new Error("Custom Search is not configured. Set VITE_GOOGLE_CX first.");
  const data = await apiCall(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${customSearchCx}&q=${encodeURIComponent(url)}`
  );
  
  return {
    items: data.items?.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || ''
    })) || []
  };
};

// 4. Generative Language (Gemini) API
export const generateContent = async (prompt: string): Promise<GeminiData> => {
  const result = await backendCall("/api/google/gemini/generate", { prompt, model: "gemini-2.5-flash" });
  const data = (result.data || {}) as Record<string, any>;
  
  return {
    text: data.text || "",
    usage: data.usage || { promptTokens: 0, candidatesTokens: 0 }
  };
};

// 5. Cloud Natural Language API
export const analyzeEntities = async (text: string): Promise<NLPData> => {
  const data = await apiCall(`https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      document: { content: text, type: 'PLAIN_TEXT' },
      encodingType: 'UTF8'
    })
  });
  
  return {
    entities: data.entities?.map((entity: any) => ({
      name: entity.name || '',
      type: entity.type || '',
      salience: entity.salience || 0
    })) || []
  };
};

// 6. Cloud Translation API
export const translateTexts = async (
  texts: string[],
  targetLang: string,
  options: { format?: "text" | "html" } = {}
): Promise<TranslationData[]> => {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const allResults: TranslationData[] = []
  let batch: string[] = []
  let batchChars = 0

  const flush = async () => {
    if (!batch.length) return
    const data = await apiCall(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      body: JSON.stringify({
        q: batch,
        target: targetLang,
        format: options.format || "text",
      })
    });

    allResults.push(
      ...(data.data?.translations || []).map((entry: any) => ({
        translatedText: entry?.translatedText || "",
        detectedSourceLanguage: entry?.detectedSourceLanguage || "",
      }))
    )
    batch = []
    batchChars = 0
  }

  for (const text of texts) {
    const normalized = String(text || "")
    if (batch.length >= 32 || batchChars + normalized.length > 4500) {
      await flush()
    }
    batch.push(normalized)
    batchChars += normalized.length
  }

  await flush()
  return allResults
};

export const translateText = async (text: string, targetLang: string): Promise<TranslationData> => {
  const [translation] = await translateTexts([text], targetLang);
  return translation || {
    translatedText: "",
    detectedSourceLanguage: "",
  };
};

// 7. Cloud Speech-to-Text API
export const recognizeSpeech = async (audioBlob: Blob): Promise<SpeechData> => {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("Speech to Text needs a recorded audio file. The demo button has no audio attached yet.");
  }
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const data = await apiCall(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: 'POST',
      body: JSON.stringify({
        config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: 'en-US' },
        audio: { content: base64 }
      })
    });
    
    return {
      transcript: data.results?.[0]?.alternatives?.[0]?.transcript || "",
      confidence: data.results?.[0]?.alternatives?.[0]?.confidence || 0
    };
  } catch (error) {
    console.error('Speech recognition failed:', error);
    return { transcript: "", confidence: 0 };
  }
};

// 8. Cloud Vision API
export const analyzeImage = async (imageBase64: string): Promise<VisionData> => {
  const data = await apiCall(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        image: { content: imageBase64.split(',')[1] },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
        ]
      }]
    })
  });
  
  const response = data.responses?.[0] || {};
  return {
    labels: response.labelAnnotations?.map((label: any) => ({
      description: label.description || '',
      score: label.score || 0
    })) || [],
    objects: response.localizedObjectAnnotations?.map((obj: any) => ({
      name: obj.name || '',
      score: obj.score || 0
    })) || []
  };
};

// 9. Cloud Video Intelligence API
export const analyzeVideo = async (videoUrl: string): Promise<VideoData> => {
  if (!/^gs:\/\//i.test(videoUrl) && !/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(videoUrl)) {
    throw new Error("Video Intelligence needs a gs:// URI or a direct video file URL.");
  }
  const data = await apiCall(`https://videointelligence.googleapis.com/v1/videos:annotate?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      inputUri: videoUrl,
      features: ['SHOT_CHANGE_DETECTION', 'LABEL_DETECTION']
    })
  });
  
  return {
    shots: data.shotChanges?.map((shot: any, i: number) => ({
      start: shot.startTimeOffset || i * 1000,
      end: shot.endTimeOffset || (i + 1) * 1000
    })) || [],
    labels: data.segmentLabelAnnotations?.map((label: any) => ({
      entity: label.entity || '',
      confidence: label.confidence || 0
    })) || []
  };
};

// 10. YouTube Data API
export const searchVideos = async (query: string): Promise<YouTubeData> => {
  const data = await apiCall(
    `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}`
  );
  
  return {
    items: data.items?.map((item: any) => ({
      title: item.snippet?.title || '',
      videoId: item.id?.videoId || '',
      thumbnail: item.snippet?.thumbnails?.default?.url || ''
    })) || []
  };
};

// 11. Chrome Device Properties API (Mock)
export const getDeviceSpecs = async (): Promise<DeviceData> => {
  // Mock implementation - Chrome Device Properties requires special access
  return {
    deviceSpecs: [
      { name: 'Mobile', type: 'phone', capabilities: ['touch', 'gps', 'camera'] },
      { name: 'Tablet', type: 'tablet', capabilities: ['touch', 'camera', 'large-screen'] },
      { name: 'Desktop', type: 'desktop', capabilities: ['mouse', 'keyboard', 'large-screen'] }
    ]
  };
};

// 12. Document AI API
export const processDocument = async (html: string): Promise<DocumentData> => {
  const result = await backendCall("/api/google/documentai", { html });
  const data = (result.data || {}) as Record<string, unknown>;
  
  return {
    entities: ((data.document as Record<string, any> | undefined)?.entities || []).map((entity: any) => ({
      type: entity.type || '',
      text: entity.mentionText || '',
      confidence: entity.confidence || 0
    })) || []
  };
};

// 13. Firebase Hosting API
export const createSiteVersion = async (siteId: string): Promise<HostingData> => {
  const normalizedSiteId = String(siteId || "").trim();
  if (!normalizedSiteId || normalizedSiteId === "my-site") {
    throw new Error("Firebase Hosting needs a real site id.");
  }
  const result = await backendCall("/api/google/firebase/deploy", { siteId: normalizedSiteId });
  const data = (result.data || {}) as Record<string, any>;
  
  return {
    siteUrl: data?.config?.site || `https://${normalizedSiteId}.web.app`,
    version: data.name?.split('/').pop() || 'v1',
    status: data.status || 'READY'
  };
};

// 14. Cloud Storage API
export const uploadFile = async (file: File, path: string): Promise<StorageData> => {
  if (!file || file.size === 0) throw new Error("Cloud Storage upload needs a real file.");
  if (!path || path === "my-bucket") throw new Error("Cloud Storage bucket is not configured.");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const result = await backendCall("/api/google/storage/upload", {
    name: file.name,
    bucket: path,
    contentType: file.type || "application/octet-stream",
    contentBase64: btoa(binary),
  });
  const data = (result.data || {}) as Record<string, any>;
  return {
    fileUrl: data.fileUrl || "",
    bucket: data.bucket || path,
    size: Number(data.size || file.size),
  };
};

// 15. BigQuery API
export const queryBigQuery = async (sql: string): Promise<BigQueryData> => {
  if (/project-id|dataset\.table/i.test(sql)) {
    throw new Error("BigQuery needs a real project and table. The demo query still uses placeholders.");
  }
  const result = await backendCall("/api/google/bigquery/query", { query: sql });
  const data = (result.data || {}) as Record<string, any>;
  return {
    rows: (data.rows as Array<any> | undefined)?.map((row: any) => row.f?.map((cell: any) => cell.v)) || [],
    totalRows: parseInt(String(data.totalRows || "0"), 10) || 0,
    schema: (data.schema?.fields as Array<any> | undefined)?.map((field: any) => ({
      name: field.name || '',
      type: field.type || ''
    })) || []
  };
};
