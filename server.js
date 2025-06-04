const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

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

  // Use --get-url instead of downloading
  let cmd = `yt-dlp --no-playlist --no-warnings -f best --cookies cookies.txt --get-url "${url}"`;

  // Custom headers for Instagram and TikTok
  if (url.includes('tiktok.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.tiktok.com/"`;
  } else if (url.includes('instagram.com')) {
    cmd += ` --add-header "User-Agent: Mozilla/5.0" --add-header "Referer: https://www.instagram.com/"`;
  }

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Extraction error: ${stderr || error.message}`);
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

    const directUrl = urls[0]; // Use video stream
    console.log(`✅ Extracted direct URL: ${directUrl}`);
    return res.json({ success: true, url: directUrl });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Video Extractor API running on port ${PORT}`);
});
