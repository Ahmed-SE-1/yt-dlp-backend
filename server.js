const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

exec('yt-dlp --version', (err, stdout) => {
  console.log('yt-dlp version:', stdout?.trim());
});

app.post('/extract', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  console.log(`📥 Received request to extract: ${url}`);

  // Check for cookies.txt (existing logic remains)
  if (!fs.existsSync('cookies.txt')) {
    console.warn('⚠️ cookies.txt not found in container!');
  } else {
    console.log('✅ cookies.txt is present in container');
  }

  // Base command remains the same
  let cmd = `yt-dlp --no-playlist --no-warnings -f best --cookies cookies.txt --get-url "${url}"`;

  // Enhanced TikTok-specific handling
  if (url.includes('tiktok.com')) {
    // 1. Add TikTok-specific headers
    cmd += ` --add-header "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`;
    cmd += ` --add-header "Referer: https://www.tiktok.com/"`;
    cmd += ` --add-header "Origin: https://www.tiktok.com"`;
    
    // 2. Force MP4 format and direct URL
    cmd += ` --format mp4 --force-generic-extractor`;
    
    // 3. Add timeout for TikTok (30 seconds)
    cmd = `timeout 30 ${cmd}`;
  } 
  // Existing Instagram/other platform logic remains unchanged
  else if (url.includes('instagram.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
  }

  // Existing execution logic remains the same
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Extraction error: ${stderr || error.message}`);
      // Enhanced TikTok error handling
      if (url.includes('tiktok.com')) {
        return res.status(500).json({
          success: false,
          message: 'TikTok download failed. Please try again or use a different video.',
          error: stderr || error.message
        });
      }
      // Existing error handling for other platforms
      return res.status(500).json({
        success: false,
        message: 'Extraction failed',
        error: stderr || error.message
      });
    }

    const urls = stdout.trim().split('\n').filter(u => u.startsWith('http'));
    if (urls.length === 0) {
      return res.status(404).json({ success: false, message: 'No downloadable video found.' });
    }

    const directUrl = urls[0];
    console.log(`✅ Extracted direct URL: ${directUrl}`);
    
    // TikTok-specific response verification
    if (url.includes('tiktok.com') && !directUrl.includes('.mp4')) {
      return res.status(500).json({ 
        success: false,
        message: 'TikTok video format not supported',
        error: 'Invalid video URL format'
      });
    }

    // Existing success response remains the same
    return res.json({ success: true, url: directUrl });
  });
});
