const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Optional: Enable API key protection
const REQUIRE_API_KEY = false;
const VALID_API_KEY = process.env.API_KEY || 'your-secret-key';

// Check yt-dlp version at startup
exec('yt-dlp --version', (err, stdout) => {
  console.log('▶️ yt-dlp version:', stdout?.trim() || 'Not found');
});

// Middleware: API Key check (optional)
if (REQUIRE_API_KEY) {
  app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== VALID_API_KEY) {
      return res.status(403).json({ success: false, message: 'Forbidden: Invalid API key' });
    }
    next();
  });
}

app.post('/extract', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const allowedDomains = ['tiktok.com', 'instagram.com'];
  if (!allowedDomains.some(domain => url.includes(domain))) {
    return res.status(400).json({
      success: false,
      message: 'Only TikTok and Instagram URLs are supported.',
    });
  }

  const safeUrl = url.replace(/"/g, '\\"');
  let cmd = `yt-dlp -j --no-warnings --no-playlist --cookies cookies.txt "${safeUrl}"`;

  // Add headers for TikTok/Instagram
  if (url.includes('tiktok.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.tiktok.com/"`;
  } else if (url.includes('instagram.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
  }

  // Check if cookies.txt exists
  if (!fs.existsSync('cookies.txt')) {
    console.warn('⚠️ cookies.txt not found!');
  } else {
    console.log('✅ cookies.txt is present');
  }

  console.log(`📥 Executing: ${cmd}`);

  // Execute yt-dlp with timeout protection
  exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ yt-dlp failed (code ${error.code}): ${stderr || error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Extraction failed',
        error: stderr || error.message,
      });
    }

    try {
      const info = JSON.parse(stdout);
      const videoUrl = info.url;

      if (!videoUrl || !videoUrl.startsWith('http')) {
        return res.status(404).json({ success: false, message: 'No valid video URL found.' });
      }

      return res.json({
        success: true,
        url: videoUrl,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
      });
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse video data',
        error: parseError.toString(),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Video Extractor API running on port ${PORT}`);
});
