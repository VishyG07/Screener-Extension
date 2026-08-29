// --- Sparklines SVG Builder ---
async function buildSparkline(ticker) {
  try {
    const res = await fetch(\https://query1.finance.yahoo.com/v8/finance/chart/\.NS?range=7d&interval=1d\);
    const data = await res.json();
    const prices = data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
    if (prices.length < 2) return '';

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    // Draw SVG 60px wide, 20px high
    const width = 60;
    const height = 20;
    
    const points = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return \\,\\;
    }).join(' ');

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#188038' : '#d93025';

    return \<svg width="\" height="\" style="margin-top:4px;"><polyline fill="none" stroke="\" stroke-width="1.5" points="\"/></svg>\;
  } catch(e) {
    return '';
  }
}
