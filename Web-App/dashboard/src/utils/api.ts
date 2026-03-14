export async function analyzePageSpeed(url: string) {
  const apiKey = import.meta.env.VITE_PAGESPEED_API_KEY;
  if (!apiKey) throw new Error("PageSpeed API key missing");

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile`
  );
  
  if (!response.ok) throw new Error("API request failed");
  const data = await response.json();
  const lighthouse = data.lighthouseResult;
  
  return {
    performance: Math.round(lighthouse.categories.performance.score * 100),
    accessibility: Math.round(lighthouse.categories.accessibility.score * 100),
    seo: Math.round(lighthouse.categories.seo.score * 100),
    fcp: lighthouse.audits["first-contentful-paint"]?.displayValue || "N/A"
  };
}
