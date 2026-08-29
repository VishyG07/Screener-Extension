const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  // It looks like: fetch(\https://query1.finance.yahoo.com/v8/finance/chart/\.NS?range=7d&interval=1d\);
  // And: return \`<svg ...
  // And: return \`${x},${y}\`;
  
  // Actually, I can just replace the whole buildSparkline function.
  const goodFunc = `
// --- Sparklines SVG Builder ---
async function buildSparkline(ticker) {
  try {
    const res = await fetch(\`https://query1.finance.yahoo.com/v8/finance/chart/\${ticker}.NS?range=7d&interval=1d\`);
    const data = await res.json();
    const prices = data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
    if (prices.length < 2) return '';

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    const width = 60;
    const height = 20;
    
    const points = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return \`\${x},\${y}\`;
    }).join(' ');

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#188038' : '#d93025';

    return \`<svg width="\${width}" height="\${height}" style="margin-top:4px;"><polyline fill="none" stroke="\${color}" stroke-width="1.5" points="\${points}"/></svg>\`;
  } catch(e) {
    return '';
  }
}
`;

  // Find where it starts
  const startIdx = content.indexOf('// --- Sparklines SVG Builder ---');
  if (startIdx > -1) {
    content = content.substring(0, startIdx) + goodFunc;
    fs.writeFileSync(file, content, 'utf8');
  }
}

fixFile('sidepanel.js');
fixFile('floating_widget.js');
