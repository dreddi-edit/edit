// Google APIs Suite - 15 Integrated Services
const apiKey = import.meta.env.VITE_PAGESPEED_API_KEY;

// API Key validation
if (!apiKey) {
  console.warn('Google APIs: VITE_PAGESPEED_API_KEY not found in environment variables');
}

// Helper function for API calls
const apiCall = async (url: string, options: RequestInit = {}) => {
  if (!apiKey) throw new Error('API key required');
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
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
  const data = await apiCall(
    `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${import.meta.env.VITE_GOOGLE_CX}&q=${encodeURIComponent(url)}`
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
  const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    usage: data.usageMetadata || { promptTokens: 0, candidatesTokens: 0 }
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
export const translateText = async (text: string, targetLang: string): Promise<TranslationData> => {
  const data = await apiCall(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      q: text,
      target: targetLang
    })
  });
  
  return {
    translatedText: data.data?.translations?.[0]?.translatedText || "",
    detectedSourceLanguage: data.data?.translations?.[0]?.detectedSourceLanguage || ""
  };
};

// 7. Cloud Speech-to-Text API
export const recognizeSpeech = async (audioBlob: Blob): Promise<SpeechData> => {
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
  const data = await apiCall(`https://documentai.googleapis.com/v1/projects/project-id/locations/us/processors/processor-id:process?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'projects/project-id/locations/us/processors/processor-id',
      rawDocument: { content: btoa(html), mimeType: 'text/html' }
    })
  });
  
  return {
    entities: data.document?.entities?.map((entity: any) => ({
      type: entity.type || '',
      text: entity.mentionText || '',
      confidence: entity.confidence || 0
    })) || []
  };
};

// 13. Firebase Hosting API
export const createSiteVersion = async (siteId: string): Promise<HostingData> => {
  const data = await apiCall(`https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      config: { target: 'default' }
    })
  });
  
  return {
    siteUrl: `https://${siteId}.web.app`,
    version: data.name?.split('/').pop() || 'v1',
    status: data.status || 'READY'
  };
};

// 14. Cloud Storage API
export const uploadFile = async (file: File, path: string): Promise<StorageData> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${path}?uploadType=media&name=${file.name}&key=${apiKey}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    return {
      fileUrl: data.mediaLink || '',
      bucket: path,
      size: file.size
    };
  } catch (error) {
    console.error('File upload failed:', error);
    return { fileUrl: '', bucket: path, size: 0 };
  }
};

// 15. BigQuery API
export const queryBigQuery = async (sql: string): Promise<BigQueryData> => {
  const data = await apiCall(`https://bigquery.googleapis.com/v2/projects/project-id/queries?key=${apiKey}`, {
    method: 'POST',
    body: JSON.stringify({ query: sql })
  });
  
  return {
    rows: data.rows?.map((row: any) => row.f?.map((cell: any) => cell.v)) || [],
    totalRows: parseInt(data.totalRows) || 0,
    schema: data.schema?.fields?.map((field: any) => ({
      name: field.name || '',
      type: field.type || ''
    })) || []
  };
};
