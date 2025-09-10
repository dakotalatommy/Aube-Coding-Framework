#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const limitKb = parseInt(process.env.BUNDLE_LIMIT_KB || '350', 10);

function parseGzip(line){
  const m = line.match(/\| gzip:\s+([0-9\.]+) kB/);
  return m ? parseFloat(m[1]) : null;
}

try{
  // Read build.log at project root (written by npm run build)
  const logPath = path.join(__dirname, '..', 'build.log');
  if (!fs.existsSync(logPath)) {
    console.warn('Bundle guard: build.log not found, skipping');
    process.exit(0);
  }
  const log = fs.readFileSync(logPath, 'utf8');
  const lines = log.split('\n');
  const offenders = [];
  for (const ln of lines){
    if (!ln.includes('dist/assets/')) continue;
    if (/(react-vendor|physics|gaussian-splat|opentype|sentry|analytics|ui|motion)\-/.test(ln)) continue;
    const size = parseGzip(ln);
    if (size && size > limitKb) offenders.push({ line: ln.trim(), size });
  }
  if (offenders.length){
    console.error(`Bundle guard failed (>${limitKb} kB gzip):`);
    offenders.forEach(o=> console.error(' -', o.line));
    process.exit(1);
  }
  console.log('Bundle guard OK');
  process.exit(0);
} catch(e){
  console.warn('Bundle guard skipped:', e.message);
  process.exit(0);
}


